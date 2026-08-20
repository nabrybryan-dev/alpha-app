/**
 * Las cinco direcciones visuales del hero, en un solo sitio.
 *
 * Cada una nació de su propio dossier (`DIRECCION-A-DESPIECE.md` y hermanos) y
 * se produjo como loop de 1280x720 en WebM/AV1. Se centralizan aquí por la misma
 * razón que `fondoHero.ts` centraliza las dos de entrada: colocar una pieza en
 * una pantalla nueva tiene que ser importar una constante, no copiar dos rutas
 * y arriesgarse a emparejar mal el vídeo con el póster de otra.
 *
 * **El póster no es decorativo ni intercambiable.** Es el PRIMER FOTOGRAMA exacto
 * de su propio vídeo, extraído con `ffmpeg -vf select=eq(n\,0)`. Si se sustituye
 * por una foto parecida, al relevar el póster el vídeo salta a la vista. Ese
 * emparejamiento lo vigila `direccionesVisuales.test.ts`.
 *
 * **Todas son apaisadas 16:9 y la app es vertical.** Por eso van en bandas
 * `aspect-video` a lo ancho y no en las tarjetas cuadradas de foto: en un móvil
 * de 390 pt a densidad 3 la banda mide 1170 px, o sea que la pieza se pinta a
 * 0,91x, sin ampliar. En la tarjeta de Sesión, que es casi cuadrada, la misma
 * pieza se ampliaría 1,39x — justo lo que prohíbe `fondos-de-tarjeta.test.ts`.
 */
export interface DireccionVisual {
  /** Letra del dossier que la definió. */
  id: 'A' | 'B' | 'C' | 'D' | 'E'
  nombre: string
  /** Qué ocurre en el plano. Se enseña en el manual de marca. */
  frase: string
  video: string
  /** Primer fotograma del propio vídeo. Ver la nota de arriba. */
  poster: string
  /**
   * Encaje extra cuando la pieza no llena la banda por sí sola.
   *
   * Solo lo usa Físico: su fotograma trae una columna negra en el 17,5% de la
   * izquierda. Ampliarla un 21,2% anclada a la derecha la deja exactamente
   * fuera. Se aplica igual al póster y al vídeo, así que no introduce salto.
   */
  encaje?: string
}

export const DIRECCIONES: DireccionVisual[] = [
  {
    id: 'A',
    nombre: 'Despiece',
    frase: 'La barra se desarma en el aire y cada disco ocupa su sitio.',
    video: '/hero/hero-loop-despiece.webm',
    poster: '/fondos/poster-despiece.jpg',
  },
  {
    id: 'B',
    nombre: 'Órbita',
    frase:
      'Nada se desmonta: la cámara rodea al atleta sentado entre series y deja que hable el material.',
    video: '/hero/hero-orbita.webm',
    poster: '/fondos/poster-orbita.jpg',
  },
  {
    id: 'C',
    nombre: 'Ascenso',
    frase: 'La torre del rack y sus peldaños numerados, subiendo.',
    video: '/hero/hero-loop-ascenso.webm',
    poster: '/fondos/poster-ascenso.jpg',
  },
  {
    id: 'D',
    nombre: 'Esfuerzo',
    frase: 'La última repetición, con el polvo de magnesio suspendido alrededor.',
    video: '/hero/hero-loop-esfuerzo.webm',
    poster: '/fondos/poster-esfuerzo.jpg',
  },
  {
    id: 'E',
    nombre: 'Físico',
    frase: 'La cámara sube por el físico y recorre las inserciones una a una.',
    video: '/hero/hero-fisico.webm',
    poster: '/fondos/poster-fisico.jpg',
    encaje: 'origin-right scale-[1.213]',
  },
]

/** Busca por letra. Falla fuerte: una letra que no existe es un error de programación. */
export function direccion(id: DireccionVisual['id']): DireccionVisual {
  const encontrada = DIRECCIONES.find((d) => d.id === id)
  if (!encontrada) throw new Error(`No existe la dirección visual ${id}`)
  return encontrada
}
