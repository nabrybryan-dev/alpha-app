import type { RepeticionMedida } from '../../domain/serieMedida'

/**
 * Velocidad de cada repetición, en barras.
 *
 * La barra que marca el corte lleva **borde y punto**, no solo color: en Alpha
 * el rojo es la marca —está en el botón de acción y en el logo— y si además
 * significara «atención» dejaría de significar nada. Y quien no distingue bien
 * los colores tiene que poder leer la pantalla igual.
 */
export function BarrasVelocidad({
  velocidades,
  perdidaPct,
  umbralPct,
}: {
  velocidades: RepeticionMedida[]
  perdidaPct: number
  umbralPct: number
}) {
  const maxima = Math.max(...velocidades.map((v) => v.velocidadMs), 0.01)
  const cortaste = perdidaPct >= umbralPct
  const iCorte = velocidades.length - 1

  return (
    <section className="rounded-2xl border border-hairline bg-surface-2 p-4">
      <header className="flex items-baseline justify-between">
        <h3 className="font-display text-sm uppercase tracking-[0.14em] text-silver-300">
          Velocidad
        </h3>
        <p
          className={[
            'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold',
            cortaste
              ? 'border border-ambar/35 bg-ambar/15 text-ambar'
              : 'border border-hairline bg-surface-3 text-silver-400',
          ].join(' ')}
        >
          {cortaste && <span aria-hidden className="size-1.5 rounded-full bg-ambar" />}
          Pérdida {perdidaPct} %
        </p>
      </header>

      <ol className="mt-4 flex items-end gap-1.5" role="list">
        {velocidades.map((v) => {
          const alto = Math.max(6, (v.velocidadMs / maxima) * 100)
          const esCorte = cortaste && v.indice === iCorte + 1
          return (
            <li key={v.indice} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="font-mono text-[10px] tabular-nums text-silver-400">
                {v.velocidadMs.toFixed(2).replace('.', ',')}
              </span>
              <div
                className={[
                  'w-full rounded-t-sm',
                  esCorte ? 'border border-b-0 border-ambar bg-ambar/30' : 'bg-silver-400/70',
                ].join(' ')}
                style={{ height: `${alto}px` }}
                role="img"
                aria-label={`Repetición ${v.indice}: ${v.velocidadMs.toFixed(2)} metros por segundo`}
              />
              <span className="font-mono text-[10px] tabular-nums text-silver-500">
                {String(v.indice).padStart(2, '0')}
              </span>
            </li>
          )
        })}
      </ol>

      <p className="mt-3 text-[13px] leading-snug text-silver-400">
        {cortaste ? (
          <>
            Cortaste en el <b className="text-silver-100">{perdidaPct} %</b> de pérdida. Tu umbral
            es {umbralPct} %.
          </>
        ) : (
          <>
            Te quedaste en el <b className="text-silver-100">{perdidaPct} %</b> de pérdida, por
            debajo de tu umbral del {umbralPct} %.
          </>
        )}
      </p>
    </section>
  )
}
