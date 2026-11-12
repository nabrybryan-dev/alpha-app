import { useState } from 'react'
import { catalogoRepo } from '../../data/catalogo/catalogoRepo'
import { db, hoyIso, useDbVersion } from '../../data/dbInstance'
import { claveDe, type ItemDespensa } from '../../domain/nutricion/despensa'
import { palabrasDeBusqueda, textoDePedido } from '../../domain/nutricion/mercado'
import type { AlimentoIndice } from '../../domain/nutricion/busqueda'

/**
 * «Mi mercado» con el aspecto de la maqueta (build-v8/3t-v14-mercado.js:67-80 y 1i-v10.css:26-42),
 * sobre la despensa que YA existe: `db.despensa` (tablas 0024 y 0042, con su sincronización).
 *
 * Qué hace: la lista de compras del plan, cada línea con un interruptor «Compré esto»;
 * al activarlo, la persona elige a qué alimento del catálogo corresponde y ese alimento
 * entra a «En casa». Además puede añadir algo que ya tenía o pedir lo que no está.
 *
 * Reglas heredadas, no se tocan aquí:
 * - PRESENCIA, NO SALDO: no hay cantidades ni se descuenta nada (ver `domain/nutricion/despensa.ts`).
 * - El pedido sin tabla entra «sin datos» y el motor no lo usa.
 * - Aislamiento: todo se lee y escribe con el `asesoradoId` que llega por props, nunca con otro.
 *
 * Fuera a propósito (necesita motor o datos nuevos, ver docs de la pieza C5): las opciones
 * «con lo que tienes» dentro de las comidas y el sello de «vetado».
 *
 * Lo marcado en las líneas del plan vive solo en pantalla: marcar «compré» no guarda nada,
 * lo que se guarda es el alimento que la persona confirma.
 */

interface MiMercadoProps {
  asesoradoId: string
  /** Las líneas de `plan.listaCompras`, tal cual las escribió el coach. */
  lineas: readonly string[]
}

const CHIP =
  'press min-h-11 rounded-full border border-linea bg-surface-2 px-3 text-sm font-semibold text-texto'

function candidatosDe(linea: string): AlimentoIndice[] {
  const vistos = new Set<string>()
  const salida: AlimentoIndice[] = []
  for (const palabra of palabrasDeBusqueda(linea)) {
    for (const a of catalogoRepo.buscar(palabra, {}, 3)) {
      if (!vistos.has(a.id)) {
        vistos.add(a.id)
        salida.push(a)
      }
    }
  }
  return salida.slice(0, 6)
}

export function MiMercado({ asesoradoId, lineas }: MiMercadoProps) {
  useDbVersion()
  const [marcadas, setMarcadas] = useState<ReadonlySet<number>>(new Set())
  const [abierta, setAbierta] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const despensa = db.despensa.byUsuario(asesoradoId)
  const enCasa = (id: string) => despensa.some((i) => i.alimentoId === id)

  const nombreDe = (item: ItemDespensa) =>
    item.alimentoId ? (catalogoRepo.porId(item.alimentoId)?.nombre ?? item.alimentoId) : item.textoPedido

  const meter = (alimentoId: string | null, textoPedido: string | undefined, origen: 'compra' | 'ya_tenia') =>
    db.despensa.agregar(asesoradoId, {
      alimentoId,
      ...(textoPedido === undefined ? {} : { textoPedido }),
      cantidadG: null,
      agregadoEn: hoyIso(),
      origen,
    })

  const alternar = (indice: number, activo: boolean) => {
    setMarcadas((prev) => {
      const sig = new Set(prev)
      if (activo) sig.add(indice)
      else sig.delete(indice)
      return sig
    })
    setAbierta(activo ? indice : null)
  }

  const elegir = (a: AlimentoIndice) => {
    if (enCasa(a.id)) db.despensa.quitar(asesoradoId, a.id)
    else meter(a.id, undefined, 'compra')
  }

  const consulta = busqueda.trim()
  const hallados = consulta.length >= 2 ? catalogoRepo.buscar(consulta, {}, 4) : []
  const pedido = textoDePedido(consulta)

  return (
    <section
      aria-label="Mi mercado"
      className="flex flex-col gap-3 rounded-[22px] border border-linea bg-surface-1 p-4 [box-shadow:var(--brillo),var(--sombra-card)]"
    >
      <header className="flex flex-wrap items-baseline gap-x-2">
        <h2 className="font-display text-base text-texto">Mi mercado</h2>
        <p className="text-xs text-tenue">Marca lo que compraste y di a qué alimento corresponde</p>
      </header>

      <ul className="flex flex-col gap-1.5">
        {lineas.map((linea, i) => (
          <li key={`${i}-${linea}`}>
            <label className="flex min-h-11 items-center justify-between gap-3 rounded-[18px] border border-linea bg-surface-2 px-3 py-2 text-sm text-texto">
              <span className="min-w-0 flex-1 leading-snug">{linea}</span>
              <input
                type="checkbox"
                role="switch"
                aria-label={`Compré ${linea}`}
                checked={marcadas.has(i)}
                onChange={(e) => alternar(i, e.target.checked)}
                className="h-6 w-6 shrink-0 accent-accion"
              />
            </label>
            {abierta === i && (
              <div className="mt-1.5 flex flex-col gap-1.5 px-1">
                <p className="text-xs text-tenue">¿Qué compraste de esta línea? Toca lo que corresponde.</p>
                <div className="flex flex-wrap gap-1.5">
                  {candidatosDe(linea).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      aria-pressed={enCasa(a.id)}
                      onClick={() => elegir(a)}
                      className={`${CHIP} aria-pressed:outline aria-pressed:outline-2 aria-pressed:outline-texto`}
                    >
                      {a.nombre}
                    </button>
                  ))}
                  {candidatosDe(linea).length === 0 && (
                    <p className="text-xs text-tenue">No encontré un alimento que corresponda. Búscalo abajo.</p>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Añadir algo que ya tenías…"
        autoComplete="off"
        aria-label="Añadir algo que ya tenías"
        className="min-h-11 w-full rounded-[18px] border border-linea bg-surface-2 px-4 text-base text-texto placeholder:text-tenue focus:border-accion focus:outline-none"
      />
      {consulta.length >= 2 && (
        <div className="flex flex-wrap gap-1.5">
          {hallados.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-label={`Añadir ${a.nombre}`}
              onClick={() => {
                meter(a.id, undefined, 'ya_tenia')
                setBusqueda('')
              }}
              className={CHIP}
            >
              {a.nombre}
            </button>
          ))}
          {hallados.length === 0 && pedido && (
            <button
              type="button"
              onClick={() => {
                meter(null, pedido, 'ya_tenia')
                setBusqueda('')
              }}
              className={CHIP}
            >
              No está: pedirlo
            </button>
          )}
        </div>
      )}

      <div>
        <p className="text-sm text-texto">
          <b>En casa</b>
          <span className="text-xs text-tenue"> · lo que tienes, no cuánto: no se descuenta</span>
        </p>
        {despensa.length === 0 ? (
          <p className="mt-1 text-xs text-tenue">Todavía nada.</p>
        ) : (
          <ul className="mt-1.5 flex flex-col gap-1">
            {despensa.map((item) => (
              <li key={claveDe(item)} className="flex items-center justify-between gap-2 text-sm text-texto">
                <span className="min-w-0 flex-1 leading-snug">
                  {nombreDe(item)}
                  {!item.alimentoId && (
                    <span className="ml-1.5 rounded-full border border-linea px-1.5 py-0.5 text-xs text-tenue">
                      sin datos
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  aria-label={`Quitar ${nombreDe(item)}`}
                  onClick={() => db.despensa.quitar(asesoradoId, claveDe(item))}
                  className="press min-h-11 shrink-0 px-3 text-xs font-semibold text-tenue"
                >
                  Se acabó
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
