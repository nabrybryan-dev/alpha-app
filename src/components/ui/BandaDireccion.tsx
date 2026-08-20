import type { DireccionVisual } from '../../lib/direccionesVisuales'
import { FondoLoop } from './FondoLoop'

interface BandaDireccionProps {
  direccion: DireccionVisual
  /** `auto` solo donde la banda ES lo primero de la pantalla. */
  prioridad?: 'high' | 'auto' | 'low'
  className?: string
}

/**
 * Una dirección visual puesta a lo ancho, en 16:9.
 *
 * Es la única forma honesta de enseñar estas piezas dentro de una app vertical.
 * Son loops apaisados de 1280x720: a lo ancho de un móvil de 390 pt y densidad 3
 * la banda mide 1170 px y la pieza se pinta a 0,91x, sin inventar detalle. Metida
 * en una tarjeta casi cuadrada habría que ampliarla 1,39x, que es exactamente el
 * fallo que `fondos-de-tarjeta.test.ts` existe para impedir.
 *
 * **Nunca lleva texto encima.** Dos de las cinco piezas —Esfuerzo y Físico— son
 * imágenes claras: 84,7 y 33,2 de luminancia media, con el centro de Físico en
 * 75,7. El umbral que este repo se puso para texto blanco sobre foto es 18. Así
 * que el título va debajo de la banda, no dentro; si algún día alguien mete una
 * línea encima, no se leerá y no será culpa de la tipografía.
 *
 * El movimiento, la precarga y el fallo del vídeo los resuelve `FondoLoop`: aquí
 * solo se decide la geometría.
 */
export function BandaDireccion({
  direccion,
  prioridad = 'low',
  className,
}: BandaDireccionProps) {
  return (
    <div
      className={`relative aspect-video w-full overflow-hidden rounded-tarjeta bg-ink-900 ${className ?? ''}`}
    >
      <FondoLoop
        poster={direccion.poster}
        video={direccion.video}
        preload="none"
        prioridad={prioridad}
        anchura={1280}
        altura={720}
        className={`absolute inset-0 h-full w-full object-cover ${direccion.encaje ?? ''}`}
      />
    </div>
  )
}
