import { useEffect, useState } from 'react'
import type { PasoDelEsquema, PlanoDelEsquema } from '../../../app/unToquePraxis'
import { useMovimientoReducido } from '../../../components/ui/movimientoReducido'
import { TEXTOS_PENDIENTES as P } from './textos'

/** Lo que tarda en aparecer cada paso del esquema (diseño: 3 pasos de 150 ms y el plano). */
export const MS_POR_PASO = 150

const NIVEL_TEXTO: Record<string, string> = { libre: 'libre', asignada: 'del coach', fija: 'fija', equipo: 'del equipo' }

/**
 * El esquema de orden: muestra qué entendió Praxis, qué reglas aplicó y qué va a tocar, paso a paso, y un plano
 * de la pantalla con la pieza afectada. Todos los pasos están en el DOM desde el primer cuadro (un lector de
 * pantalla los lee completos); lo que cambia con el tiempo es solo su aparición. Con «reducir movimiento»
 * aparecen de una vez y `alCompletar` se llama en el primer efecto.
 */
export function EsquemaDeOrden({ pasos, plano, alCompletar }: { pasos: readonly PasoDelEsquema[]; plano?: PlanoDelEsquema; alCompletar?: () => void }) {
  const reducido = useMovimientoReducido()
  const total = pasos.length + (plano ? 1 : 0)
  const [vistos, setVistos] = useState(0)
  const visibles = reducido ? total : vistos

  useEffect(() => {
    if (reducido || vistos >= total) return
    const t = setTimeout(() => setVistos((v) => v + 1), MS_POR_PASO)
    return () => clearTimeout(t)
  }, [reducido, vistos, total])

  const completo = visibles >= total
  useEffect(() => {
    if (completo) alCompletar?.()
    // `alCompletar` se llama una sola vez por esquema: la capa lo entrega estable por turno.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completo])

  if (total === 0) return null
  const aparece = (i: number) => (i < visibles ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2.5')

  return (
    <section aria-label={P.esquemaTitulo} className="rounded-tarjeta border border-hairline-fuerte bg-surface-1 p-3">
      <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-tenue">{P.esquemaTitulo}</p>
      <ol className="m-0 grid list-none gap-1.5 p-0">
        {pasos.map((p, i) => (
          <li
            key={`${p.titulo}-${i}`}
            data-paso={i + 1}
            className={`grid grid-cols-[1.5rem_1fr_auto] items-start gap-2 transition-all duration-base ease-salida motion-reduce:transition-none ${aparece(i)}`}
          >
            <span
              aria-hidden="true"
              className={`grid h-[22px] w-[22px] place-items-center rounded-full font-mono text-[11px] ${
                i < visibles ? (p.alerta ? 'bg-rojo text-white' : 'bg-texto text-bg') : 'bg-surface-3 text-texto'
              }`}
            >
              {i + 1}
            </span>
            <div>
              <b className="block text-sm font-extrabold leading-tight">{p.titulo}</b>
              <span className="block text-sm leading-snug text-tenue">{p.detalle}</span>
            </div>
            {p.origen ? <em className="font-mono text-[11px] not-italic text-tenue">{p.origen}</em> : null}
          </li>
        ))}
      </ol>
      {plano ? <Plano plano={plano} visible={pasos.length < visibles} /> : null}
    </section>
  )
}

function Plano({ plano, visible }: { plano: PlanoDelEsquema; visible: boolean }) {
  return (
    <div data-plano className={`mt-2.5 rounded-xl bg-surface-2 p-2 transition-opacity duration-base motion-reduce:transition-none ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <p className="mx-0.5 mb-1.5 flex justify-between text-[11px] font-extrabold uppercase tracking-[0.1em] text-tenue">
        <span>{plano.titulo}</span>
        <span>{P.ocultasCuenta(plano.ocultas)}</span>
      </p>
      <ul className="m-0 grid list-none gap-1 p-0">
        {plano.filas.map((f) => {
          const foco = f.id === plano.foco
          const tachada = foco && plano.modo === 'oculta'
          return (
            <li
              key={f.id}
              data-fila={f.id}
              data-foco={foco ? plano.modo : undefined}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1 text-[13px] font-semibold ${
                foco ? (plano.modo === 'no' ? 'border-texto' : 'border-rojo bg-rojo/10') : 'border-hairline bg-surface-1'
              } ${tachada ? 'border-dashed line-through opacity-60' : ''}`}
            >
              <i aria-hidden="true" className={`h-[7px] w-[7px] flex-none rounded-full border border-silver-500 ${f.nivel === 'fija' ? 'bg-texto' : f.nivel === 'asignada' ? 'bg-silver-500' : 'bg-surface-3'}`} />
              <span className="min-w-0 truncate">{f.nombre}</span>
              <em className="ml-auto text-[11px] font-bold not-italic text-tenue">{NIVEL_TEXTO[f.nivel] ?? f.nivel}</em>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
