import type { Competencia, GradoCompetencia } from '../../../domain/rutaEntrenamiento'
import { gradoDeCompetencia } from '../../../domain/rutaEntrenamiento'

/** Rojo cuando está lograda, plata a medio camino, ámbar cuando es el punto débil. */
const COLOR: Record<GradoCompetencia, { texto: string; barra: string }> = {
  alto: { texto: 'text-accion', barra: 'bg-accion' },
  medio: { texto: 'text-silver-200', barra: 'bg-silver-200' },
  bajo: { texto: 'text-ambar', barra: 'bg-ambar' },
}

export function CompetenciasEvaluadas({ competencias }: { competencias: readonly Competencia[] }) {
  // Sin datos registrados no hay nada que valorar: mejor que no salga la
  // sección a que salga vacía o con cifras que no son de nadie.
  if (competencias.length === 0) return null

  return (
    <section>
      <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-silver-500">
        Competencias evaluadas
      </h3>
      <div className="flex flex-col gap-2.5">
        {competencias.map((c) => {
          const color = COLOR[gradoDeCompetencia(c.pct)]
          return (
            <article key={c.id} className="rounded-[13px] border border-ink-500 bg-ink-800 px-3.5 py-3">
              <div className="flex items-baseline justify-between gap-2.5">
                <h4 className="text-[13.5px] font-bold text-silver-100">{c.nombre}</h4>
                <span className={`cifras text-[13px] font-bold ${color.texto}`}>{c.pct}%</span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={c.pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={c.nombre}
                className="mt-2.5 h-[5px] overflow-hidden rounded-full bg-ink-500"
              >
                <span
                  className={`block h-full rounded-full transition-[width] duration-700 ease-salida ${color.barra}`}
                  style={{ width: `${c.pct}%` }}
                />
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-silver-400">{c.nota}</p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
