import { useRef, useState } from 'react'
import type { Receta } from '../../data/recetas'

/**
 * El reel vertical de la receta. Silenciado, en bucle y sin controles de más:
 * quien abre esto quiere ver cómo se hace, no operar un reproductor.
 *
 * Sin `videoUrl` no se rompe nada: se queda el póster con el aviso de que el
 * reel vive en Instagram. Nunca un layout roto.
 */
export function ReelPlayer({ media, handle }: { media: Receta['media']; handle: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const [enMarcha, setEnMarcha] = useState(false)

  const alternar = () => {
    const v = video.current
    if (!v) return
    if (v.paused) {
      void v.play().then(() => setEnMarcha(true)).catch(() => setEnMarcha(false))
    } else {
      v.pause()
      setEnMarcha(false)
    }
  }

  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-tarjeta bg-ink-900">
      {media.videoUrl ? (
        <video
          ref={video}
          src={media.videoUrl}
          poster={media.thumbnail}
          muted
          loop
          playsInline
          autoPlay
          onPlay={() => setEnMarcha(true)}
          onPause={() => setEnMarcha(false)}
          onClick={alternar}
          className="h-full w-full object-cover"
          aria-label={`Reel de ${handle}`}
        />
      ) : (
        <>
          <img src={media.thumbnail} alt="" className="h-full w-full object-cover" />
          <span className="cifras absolute inset-x-0 bottom-0 bg-ink-900/80 px-3 py-2 text-center text-[10px] font-bold text-silver-300">
            Reel disponible en Instagram
          </span>
        </>
      )}

      {media.videoUrl && !enMarcha && (
        <button
          type="button"
          onClick={alternar}
          aria-label="Reproducir reel"
          className="press absolute inset-0 grid place-items-center bg-ink-900/35"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-accion text-ink-900">
            <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-6 w-6">
              <path d="m8 5 11 7-11 7Z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  )
}
