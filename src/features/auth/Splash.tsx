import { useEffect, useState } from 'react'
import { AguilaInteractiva } from '../entrenar/AguilaInteractiva'

const DURACION_MS = 2300

/**
 * Entrada de marca: emblema, barrido metálico sobre el nombre y lema, con una
 * barra de carga abajo. Se va sola a los 2,3 s o al primer toque.
 *
 * Va SOLO antes del login, como en el prototipo. A quien ya tiene sesión no se
 * le cobran 2,3 s cada vez que abre la app en mitad del entrenamiento.
 */
export function Splash({ onListo }: { onListo: () => void }) {
  const [saliendo, setSaliendo] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSaliendo(true)
      onListo()
    }, DURACION_MS)
    return () => window.clearTimeout(id)
  }, [onListo])

  const saltar = () => {
    if (saliendo) return
    setSaliendo(true)
    onListo()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Saltar la introducción"
      onClick={saltar}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') saltar()
      }}
      className="fixed inset-0 z-50 grid place-items-center px-8"
      style={{ background: 'radial-gradient(120% 90% at 50% 25%, #1f2327 0%, #08090a 72%)' }}
    >
      <div className="flex w-full max-w-xs flex-col items-center">
        <AguilaInteractiva entrada className="h-28 w-28" />
        <h1 className="brillo-marca mt-5 font-display text-2xl text-silver-100">Alpha Athletics</h1>
        <p className="entrada-lema mt-2 text-[11px] font-bold uppercase tracking-[0.28em] text-silver-500">
          Forjado para rendir
        </p>
        <div className="mt-8 h-[3px] w-full overflow-hidden rounded-full bg-ink-600">
          <span className="barra-carga block h-full rounded-full bg-accion" />
        </div>
      </div>
    </div>
  )
}
