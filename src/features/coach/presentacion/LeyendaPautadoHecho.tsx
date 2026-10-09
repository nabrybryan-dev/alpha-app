/** Qué es cada pieza de la escena (la misma leyenda para la escena SVG y para la WebGL). */
export function LeyendaPautadoHecho({ pie, cinta = false }: { pie: string; cinta?: boolean }) {
  return (
    <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-tenue">
      <span className="flex flex-wrap gap-x-4 gap-y-1">
        <span>
          <span
            className="mr-1.5 inline-block h-2.5 w-4 rounded-sm border border-dashed border-silver-500 bg-silver-500/25 align-middle"
            aria-hidden="true"
          />
          Lo que te pedimos
        </span>
        <span>
          <span className="mr-1.5 inline-block h-2.5 w-4 rounded-sm bg-rojo align-middle" aria-hidden="true" />
          Lo que hiciste
        </span>
        {cinta && (
          <span>
            <span className="mr-1.5 inline-block h-[3px] w-4 rounded-full bg-[#ff6b6b] align-middle shadow-[0_0_6px_#ff1e1e]" aria-hidden="true" />
            Tu tendencia
          </span>
        )}
      </span>
      <span>{pie}</span>
    </figcaption>
  )
}
