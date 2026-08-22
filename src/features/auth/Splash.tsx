import { useEffect, useState } from 'react'
import { AguilaInteractiva } from '../entrenar/AguilaInteractiva'
import { FondoLoop } from '../../components/ui/FondoLoop'
import { LOOP_HERO, POSTER_SPLASH } from './fondoHero'

const DURACION_MS = 2300

/**
 * Entrada de marca: la torre del rack al fondo, emblema, barrido metálico sobre
 * el nombre y lema, con una barra de carga abajo. Se va sola a los 2,3 s o al
 * primer toque.
 *
 * Va SOLO antes del login, como en el prototipo. A quien ya tiene sesión no se
 * le cobran 2,3 s cada vez que abre la app en mitad del entrenamiento.
 *
 * El fondo va en `object-contain` anclado arriba, no en `cover`: la imagen es
 * 9:16 nativo y trae su propio negro, que es el mismo del lienzo, así que
 * contener nunca recorta la torre por muy alargada que sea la pantalla. Con
 * `cover` se la comía en cuanto la proporción se apartaba de 9:16.
 *
 * Es la única pantalla que precarga el loop (`preload="auto"`): aquí el vídeo es
 * el contenido, y son los 2,3 s en los que se puede descargar sin estorbar.
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
      className="fixed inset-0 z-50 overflow-hidden bg-[#08090a]"
    >
      <FondoLoop
        poster={POSTER_SPLASH}
        video={LOOP_HERO}
        preload="auto"
        prioridad="high"
        anchura={1080}
        altura={1920}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain object-top"
      />

      {/* Colchón bajo el banco: asegura el contraste de la marca aunque la
          pantalla sea corta y la foto baje más de lo previsto. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#08090a] via-[#08090a]/90 to-transparent"
      />

      <div className="relative flex h-full flex-col items-center justify-end px-8 pb-[16vh]">
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
    </div>
  )
}
