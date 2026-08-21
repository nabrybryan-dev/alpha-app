import { useState } from 'react'
import { useMovimientoReducido } from './movimientoReducido'

interface FondoLoopProps {
  /** Imagen fija. Es lo que se ve primero, siempre, y lo único si no hay vídeo. */
  poster: string
  /** Loop de 8 s. `null` mientras no exista: así no se pide un archivo que da 404. */
  video?: string | null
  /** `none` fuera del splash: el resto de pantallas no deben pagar la descarga. */
  preload?: 'none' | 'metadata' | 'auto'
  /**
   * `high` solo donde el fondo ES el contenido. En el login compite con el
   * formulario, que es lo que la persona ha venido a usar.
   */
  prioridad?: 'high' | 'auto' | 'low'
  anchura?: number
  altura?: number
  /** Clases del encaje. Se aplican igual a la imagen y al vídeo, para que coincidan. */
  className?: string
}

/**
 * Fondo de marca: póster fijo con un loop opcional encima.
 *
 * Tres reglas que vienen del dossier de dirección y no son decorativas:
 *
 * - **Peso.** El póster se ve primero y el vídeo solo se pide donde toca. Un loop
 *   de 8 s pesa mucho más que la portada entera; este repo ya se quemó con un
 *   `@import` de fuentes de 314 KB bloqueando el primer pintado.
 * - **Movimiento.** Quien pide menos movimiento en su sistema ve el póster fijo,
 *   no un bucle infinito. No es una preferencia estética: hay gente a la que el
 *   movimiento continuo le provoca mareo.
 * - **Degradación.** Si el vídeo falla —red mala, formato no soportado, archivo
 *   que aún no existe— se retira y queda el póster. Nunca un hueco negro.
 */
export function FondoLoop({
  poster,
  video = null,
  preload = 'none',
  prioridad = 'auto',
  anchura,
  altura,
  className,
}: FondoLoopProps) {
  const movimientoReducido = useMovimientoReducido()
  const [falloElVideo, setFalloElVideo] = useState(false)

  const conVideo = Boolean(video) && !movimientoReducido && !falloElVideo

  return (
    <>
      <img
        src={poster}
        alt=""
        aria-hidden="true"
        width={anchura}
        height={altura}
        fetchPriority={prioridad}
        decoding="async"
        className={className}
      />

      {conVideo && (
        <video
          src={video ?? undefined}
          poster={poster}
          preload={preload}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          onError={() => setFalloElVideo(true)}
          className={className}
        />
      )}
    </>
  )
}
