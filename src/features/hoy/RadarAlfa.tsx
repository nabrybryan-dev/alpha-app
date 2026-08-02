import type { NoticiaRadar } from '../../data/contenido/radarAlfa'

interface Props {
  noticias: readonly NoticiaRadar[]
  /** Número de semana ISO que rotula la tanda. */
  semana: number
}

/** Ticker de ciencia y fitness: una afirmación por fila, sin titulares. */
export function RadarAlfa({ noticias, semana }: Props) {
  if (noticias.length === 0) return null

  return (
    <section className="overflow-hidden rounded-tarjeta border border-linea bg-surface-1 shadow-sm">
      <div className="flex items-center gap-2 px-3.5 py-3">
        <span className="punto-vivo h-1.5 w-1.5 shrink-0 rounded-full bg-rojo" aria-hidden="true" />
        <h2 className="flex-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-tenue">
          Radar Alfa · ciencia y fitness
        </h2>
        <span className="cifras text-[10.5px] text-tenue">Sem {semana}</span>
      </div>
      <ul className="flex flex-col">
        {noticias.map((n) => (
          <li key={n.id} className="flex items-start gap-3 border-t border-linea px-3.5 py-3">
            <span className="mt-0.5 shrink-0 rounded-tag bg-rojo/10 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-rojo">
              {n.categoria}
            </span>
            <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-texto">{n.texto}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
