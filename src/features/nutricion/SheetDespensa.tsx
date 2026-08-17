import { useState } from 'react'
import { Sheet } from '../../components/ui/Sheet'
import { catalogoRepo } from '../../data/catalogo/catalogoRepo'
import { db, useDbVersion } from '../../data/dbInstance'
import { claveDe, estaVieja, type ItemDespensa } from '../../domain/nutricion/despensa'
import type { Respuestas } from '../../domain/nutricion/encuesta'
import { SheetBuscarAlimento } from './SheetBuscarAlimento'

/**
 * Lo que el asesorado tiene en casa.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PARA QUÉ SIRVE, QUE NO ES OBVIO
 * ─────────────────────────────────────────────────────────────────────────────
 * Para que el motor deje de proponer comida que no está. Hoy «Mi plan» sugiere
 * cambios mirando solo la tabla nutricional: puede ofrecerle salmón a quien
 * compró huevos. Con esto puede mirar antes qué hay en la cocina.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PRESENCIA, NO SALDO. Y DE MOMENTO, SOLO PRESENCIA
 * ─────────────────────────────────────────────────────────────────────────────
 * Aquí no se descuenta nada comida a comida: un inventario que se descuenta se
 * desincroniza en tres días —nadie anota el pollo que se comió su pareja— y a
 * partir de ahí el motor recomienda comida que no está.
 *
 * Y las CANTIDADES todavía no se piden. La decisión del 2026-08-16 fue que las
 * diga la persona en sus propias unidades («una bandeja», «media libra»), y eso
 * necesita una columna que la 0024 no tiene: `cantidad_g` es numérica y de 1.198
 * alimentos solo 357 tienen medida casera. Pedir gramos sería pedir lo que la
 * gente no sabe, y estimarlos sería fabricar un número con pinta de medido.
 *
 * Mientras tanto «hay pollo» ya sostiene la decisión que importa: no proponer lo
 * que no está. Ver `docs/specs/2026-08-16-de-donde-sale-la-lista-de-compra.md`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SACAR ALGO NO LO BORRA
 * ─────────────────────────────────────────────────────────────────────────────
 * Marca la fila como borrada (0042). La cola de sincronización no sabe borrar, y
 * sin esa columna sacar el pollo desde el móvil no llegaría nunca al servidor:
 * la persona lo vería desaparecer y volvería en la siguiente hidratación.
 */

interface SheetDespensaProps {
  asesoradoId: string
  abierto: boolean
  onCerrar: () => void
}

/** Cada cuántos días hace mercado, según dijo en la encuesta. */
function cicloDe(respuestas: Respuestas): number | undefined {
  const dicho = Number(respuestas.cicloCompra)
  return Number.isFinite(dicho) && dicho > 0 ? dicho : undefined
}

const hoyIso = () => new Date().toISOString().slice(0, 10)

export function SheetDespensa({ asesoradoId, abierto, onCerrar }: SheetDespensaProps) {
  useDbVersion()
  const [buscando, setBuscando] = useState(false)

  if (!abierto) return null

  const despensa = db.despensa.byUsuario(asesoradoId)
  const respuestas = (db.perfilNutricion.byUsuario(asesoradoId)?.respuestas ?? {}) as Respuestas
  const vieja = estaVieja(despensa, hoyIso(), cicloDe(respuestas))

  const nombreDe = (item: ItemDespensa) =>
    item.alimentoId ? (catalogoRepo.porId(item.alimentoId)?.nombre ?? item.alimentoId) : item.textoPedido

  return (
    <Sheet abierto titulo="Lo que tienes en casa" onCerrar={onCerrar}>
      {vieja && (
        <p className="rounded-2xl border border-linea bg-surface-2 p-3 text-[11px] leading-snug text-texto">
          Tu despensa lleva más de un ciclo de compra sin tocarse. Si ya hiciste mercado,
          actualízala: mientras diga lo de la vez pasada, el plan te propondrá comida que
          quizá ya no tienes.
        </p>
      )}

      <button
        type="button"
        onClick={() => setBuscando(true)}
        className="press mt-3 w-full rounded-2xl bg-accion py-3 text-xs font-semibold uppercase tracking-wide text-white"
      >
        Añadir lo que compré
      </button>

      <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
        En casa ({despensa.length})
      </p>

      {despensa.length === 0 ? (
        <p className="mt-2 text-[11px] leading-snug text-tenue">
          Todavía nada. Mientras esté vacía, el plan te propone cambios sin saber qué
          tienes en la cocina.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {despensa.map((item) => (
            <li
              key={claveDe(item)}
              className="flex items-center gap-2 rounded-2xl border border-linea bg-surface-1 p-2"
            >
              <span className="min-w-0 flex-1 text-sm leading-snug text-texto">
                {nombreDe(item)}
                {/* Un pedido no tiene tabla nutricional, así que el motor lo
                    deja fuera de todo cálculo. Se dice, en vez de que la
                    persona se pregunte por qué ese no cuenta. */}
                {!item.alimentoId && (
                  <span className="mt-0.5 block text-[11px] text-tenue">
                    Sin datos todavía · lo está revisando el equipo
                  </span>
                )}
              </span>
              <button
                type="button"
                aria-label={`Quitar ${nombreDe(item)}`}
                onClick={() => db.despensa.quitar(asesoradoId, claveDe(item))}
                className="press shrink-0 rounded-full border border-linea px-3 py-1 text-[11px] font-semibold text-tenue"
              >
                Se acabó
              </button>
            </li>
          ))}
        </ul>
      )}

      <SheetBuscarAlimento
        abierto={buscando}
        onCerrar={() => setBuscando(false)}
        onElegir={(alimento) => {
          db.despensa.agregar(asesoradoId, {
            alimentoId: alimento.id,
            cantidadG: null,
            agregadoEn: hoyIso(),
            origen: 'compra',
          })
          setBuscando(false)
        }}
      />
    </Sheet>
  )
}
