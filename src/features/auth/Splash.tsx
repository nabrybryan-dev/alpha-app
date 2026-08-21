import { useEffect, useState } from 'react'
import { FondoVideo } from '../../components/ui/FondoVideo'
import { AguilaInteractiva } from '../entrenar/AguilaInteractiva'
import { heroDespiece } from './heroDespiece'

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
      style={{ backgroundColor: '#08090a' }}
    >
      <FondoVideo {...heroDespiece} className="absolute inset-0" encuadre="center 28%" />
      {/* El velo hace dos cosas a la vez: conserva el degradado radial que tenía
          esta pantalla y garantiza que el nombre y el lema se lean por encima
          del vídeo. El fotograma ya reserva su franja inferior en negro, pero
          esto no sobra: si algún día se regenera y se olvida la franja, el velo
          es lo único que salva la lectura. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 25%, rgba(31,35,39,0.55) 0%, rgba(8,9,10,0.82) 62%), linear-gradient(180deg, rgba(8,9,10,0.45) 0%, rgba(8,9,10,0.30) 40%, rgba(8,9,10,0.95) 100%)',
        }}
      />

      <div className="relative flex w-full max-w-xs flex-col items-center">
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
