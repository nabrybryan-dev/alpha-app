import { useMovimientoReducido } from './movimientoReducido'

interface FondoVideoProps {
  /** Fotograma fijo. Es la base, no un respaldo: tiene que aguantar solo. */
  poster: string
  /** Loop en WebM (AV1 o VP9). El ligero, y el que se ofrece primero. */
  webm: string
  /** Respaldo H.264 para los Safari que no tragan WebM. */
  mp4: string
  /** Clases extra para el contenedor (posición, recorte). */
  className?: string
  /** `background-position` del póster y del vídeo. */
  encuadre?: string
}

/**
 * Plancha de fondo decorativa: un loop de vídeo sobre su propio fotograma fijo.
 *
 * Tres reglas que no se pueden relajar sin romper la pantalla de entrada:
 *
 * 1. **El póster manda.** Va como atributo del vídeo *y* como fondo del
 *    contenedor. Si el archivo no llega —conexión de gimnasio, un 404, el
 *    autoplay que iOS decide no conceder— la pantalla sigue siendo correcta y
 *    nadie nota que falta nada.
 * 2. **Nada se descarga de más.** `preload="none"`: el vídeo no se pide hasta
 *    que va a reproducirse. Este repo ya pagó semanas de pantalla en blanco por
 *    314 KB de fuentes que bloqueaban el primer pintado (`tokens.css:730-737`);
 *    un loop es mucho más pesado y cae justo en la primera pantalla.
 * 3. **Con movimiento reducido el vídeo no existe.** No se pausa: no se monta,
 *    así que el navegador ni siquiera pide el archivo. Quien pide menos
 *    movimiento ve el póster.
 *
 * No lleva texto encima ni lo espera: el wordmark y el lema los pinta quien lo
 * usa, en HTML, para que sigan siendo seleccionables y nítidos.
 */
export function FondoVideo({
  poster,
  webm,
  mp4,
  className = '',
  encuadre = 'center',
}: FondoVideoProps) {
  const reducido = useMovimientoReducido()

  return (
    <div aria-hidden="true" className={`pointer-events-none overflow-hidden ${className}`}>
      <div
        data-plancha
        className="absolute inset-0"
        style={{
          backgroundColor: '#08090a',
          backgroundImage: `url(${poster})`,
          backgroundSize: 'cover',
          backgroundPosition: encuadre,
        }}
      />
      {!reducido && (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: encuadre }}
          poster={poster}
          preload="none"
          autoPlay
          loop
          muted
          playsInline
        >
          <source src={webm} type="video/webm" />
          <source src={mp4} type="video/mp4" />
        </video>
      )}
    </div>
  )
}
