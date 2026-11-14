import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useDisenoFinal } from '../../app/organizacionViva'

/** Filas de «Alpha · Rediseño» (maqueta 7, `salida.html:1336-1337`) que llevan a donde vive cada cosa. */
const FILAS_DE_LA_MAQUETA = [
  { a: '/logros', titulo: 'Logros', linea: 'Nivel, racha y medallas' },
  { a: '/progreso', titulo: 'Mapa de fatiga', linea: 'Cómo llegas a cada sesión' },
] as const

function FilasDeLaMaqueta() {
  return (
    <>
      {FILAS_DE_LA_MAQUETA.map((f) => (
        <Link key={f.a} to={f.a} className="press hoy-tarjeta flex items-center justify-between gap-3 !py-3">
          <span className="min-w-0">
            <span className="hoy-fila-titulo block">{f.titulo}</span>
            <small className="text-xs text-tenue">{f.linea}</small>
          </span>
          <span aria-hidden="true" className="text-tenue">›</span>
        </Link>
      ))}
    </>
  )
}

/**
 * La banda 3 de Hoy (04 §3.2): lo que la app tiene de más —tu bloque, tus cifras, el álbum,
 * el radar, el mapa de fatiga y los contenidos— plegado detrás de un toque. Nada se quita:
 * el contenido se queda montado y solo se oculta (`hidden`), así que el estado de cada pieza
 * no se pierde al plegar y un lector de pantalla no lo recorre mientras está cerrado.
 */
export function ElResto({ children, disenoFinal }: { children: ReactNode; disenoFinal?: boolean }) {
  const [abierto, setAbierto] = useState(false)
  // Con el diseño final, el texto y las filas de la maqueta 7 (13-nov-2026); las demás cuentas, como siempre.
  const final = useDisenoFinal(disenoFinal)
  const id = useId()
  return (
    <section className="entrada entrada-6 flex flex-col gap-3" aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className="hoy-banda-titulo !mb-0 !mt-2">
        El resto
      </h3>
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((a) => !a)}
        className="press hoy-resto-cabecera"
      >
        <span>
          <span className="sr-only">El resto: </span>
          {final ? 'Tu bloque, logros, álbum, radar y contenidos' : 'Tu bloque, cifras, álbum, radar y contenidos'}
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
      {/* `hidden` solo no basta: una clase `flex` lo anula (se vio en la captura del 24-oct). */}
      <div id={id} hidden={!abierto} className={abierto ? 'flex flex-col gap-4' : 'hidden'}>
        {final && <FilasDeLaMaqueta />}
        {children}
      </div>
    </section>
  )
}
