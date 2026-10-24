import { useId, useState, type ReactNode } from 'react'

/**
 * La banda 3 de Hoy (04 §3.2): lo que la app tiene de más —tu bloque, tus cifras, el álbum,
 * el radar, el mapa de fatiga y los contenidos— plegado detrás de un toque. Nada se quita:
 * el contenido se queda montado y solo se oculta (`hidden`), así que el estado de cada pieza
 * no se pierde al plegar y un lector de pantalla no lo recorre mientras está cerrado.
 */
export function ElResto({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  const id = useId()
  return (
    <section className="entrada entrada-6 flex flex-col gap-3" aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className="text-[15px] font-extrabold text-texto">
        El resto
      </h3>
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((a) => !a)}
        className="press flex min-h-11 items-center justify-between gap-3 rounded-tarjeta border border-linea bg-surface-1 px-4 py-3 text-left text-sm text-texto shadow-sm"
      >
        <span>
          <span className="sr-only">El resto: </span>
          Tu bloque, cifras, álbum, radar y contenidos
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-5 w-5 shrink-0 text-tenue transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div id={id} hidden={!abierto} className="flex flex-col gap-4">
        {children}
      </div>
    </section>
  )
}
