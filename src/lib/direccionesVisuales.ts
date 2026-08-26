/**
 * Las seis direcciones visuales del hero, en un solo sitio.
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
 * **Cuatro de las seis traen su propia tinta, y eso decide dónde cabe el texto.**
 * A, B, C y F cierran el fotograma con una banda PLANA de RGB(6,10,11) —que es
 * `--ink-900` salvo redondeo del JPEG— ocupando el **40% inferior exacto**: la
 * pieza reserva por construcción el sitio del texto. D y E **no la tienen**, y
 * por eso D necesitó en Contenidos una lámina de tinta que subiera a taparla.
 * Medido, no estimado: A 40,1% · B 40,7% · C 40,0% · F 40,0% · D y E 0%.
 * Se reproduce con `Downloads\hero-d-esfuerzo\medir-piezas.py`.
 *
 * No es un campo de esta interfaz porque no lo consume nadie: es una propiedad
 * del material, y quien coloque una pieza nueva tiene que mirarla antes de poner
 * un texto encima.
 *
 * **Y el umbral de 18 es un TECHO, no un suelo.** Que una pieza admita texto
 * encima no dice que se vea. F lo cumplía de sobra y su calle estaba MÁS OSCURA
 * que la tinta que la tapaba, así que el efecto salía invertido; hubo que
 * levantarla y bajar la cortina a `--ink-1000`. Antes de colocar una pieza, la
 * pregunta es «¿es más clara que lo que la rodea?». Ver la §9 del spec del 25-08.
 *
 * **Todas son apaisadas 16:9 y la app es vertical, y NINGUNA va ya en banda.**
 * Las bandas `aspect-video` se retiraron con `BandaDireccion` el 20-08 por leerse
 * como material pegado encima del título. Hoy cada pantalla resuelve distinto, que
 * es la regla que gobierna esto: B es el fondo con scrub por scroll de Ruta —y
 * consume los 36 WebP de `public/hero/orbita/`, no su `.webm`—, D es una lámina
 * montada en Contenidos, F es la calle bajo la tira de rachas de Logros, E una
 * columna 1:3 en «Mis medidas» y A un disco en «Tu bloque actual». C vive aparte,
 * en las dos puertas de entrada (`fondoHero.ts`).
 *
 * Lo que sobrevive de la regla vieja es la aritmética, y sigue mandando: **la
 * escala la manda la dimensión que peor va**, y hay que calcularla contra un móvil
 * de 390 pt a densidad 3. En una caja alta y estrecha la manda el ALTO —la columna
 * de E no puede pasar de 240 CSS px— y en un recorte que se acerca, el lado de la
 * ventana —el disco de A no puede pasar de 72—. Ampliar no da error y no se ve en
 * un monitor: es justo lo que `fondos-de-tarjeta.test.ts` existe para cazar.
 */
export interface DireccionVisual {
  /** Letra del dossier que la definió. */
  id: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  nombre: string
  /** Qué ocurre en el plano. Se enseña en el manual de marca. */
  frase: string
  video: string
  /** Primer fotograma del propio vídeo. Ver la nota de arriba. */
  poster: string
  /**
   * Duración en segundos, MEDIDA del propio archivo con `ffprobe`, no estimada.
   * Está aquí porque el manual de marca la enseña en su ficha técnica y un número
   * plausible inventado sería peor que no ponerlo.
   */
  duracionS: number
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
    duracionS: 6.9,
    nombre: 'Despiece',
    frase: 'La barra se desarma en el aire y cada disco ocupa su sitio.',
    video: '/hero/hero-loop-despiece.webm',
    poster: '/fondos/poster-despiece.jpg',
  },
  {
    id: 'B',
    duracionS: 7.4,
    nombre: 'Órbita',
    frase:
      'Nada se desmonta: la cámara rodea al atleta sentado entre series y deja que hable el material.',
    video: '/hero/hero-orbita.webm',
    poster: '/fondos/poster-orbita.jpg',
  },
  {
    id: 'C',
    duracionS: 15.1,
    nombre: 'Ascenso',
    frase: 'La torre del rack y sus peldaños numerados, subiendo.',
    video: '/hero/hero-loop-ascenso.webm',
    poster: '/fondos/poster-ascenso.jpg',
  },
  {
    id: 'D',
    duracionS: 6.8,
    nombre: 'Esfuerzo',
    frase: 'La última repetición, con el polvo de magnesio suspendido alrededor.',
    video: '/hero/hero-loop-esfuerzo.webm',
    poster: '/fondos/poster-esfuerzo.jpg',
  },
  {
    id: 'E',
    duracionS: 6.0,
    nombre: 'Físico',
    frase: 'La cámara sube por el físico y recorre las inserciones una a una.',
    video: '/hero/hero-fisico.webm',
    poster: '/fondos/poster-fisico.jpg',
    encaje: 'origin-right scale-[1.213]',
  },
  {
    id: 'F',
    duracionS: 8.0,
    nombre: 'Proyección',
    frase: 'Un sprint resistido de noche: el cuerpo empuja contra la banda y la calle no se mueve.',
    video: '/hero/hero-loop-proyeccion.webm',
    poster: '/fondos/poster-proyeccion.jpg',
  },
]

/**
 * Cuántas piezas hay, en palabras, para escribirlo en pantalla.
 *
 * Existe porque el manual de marca decía «Las cinco piezas» con SEIS debajo, y no
 * era un despiste suelto: `fondoHero.ts` contaba «las otras cuatro» omitiendo
 * también a F. **La pieza que nunca se colocó tampoco se contaba**, y el número
 * escrito a mano lo repetía en cada sitio. Contarlo aquí es la única forma de que
 * añadir o quitar una dirección no deje un número mintiendo en una pantalla.
 */
export function cuantasPiezas(): string {
  const palabras: Record<number, string> = {
    3: 'tres',
    4: 'cuatro',
    5: 'cinco',
    6: 'seis',
    7: 'siete',
    8: 'ocho',
  }
  return palabras[DIRECCIONES.length] ?? String(DIRECCIONES.length)
}

/** Busca por letra. Falla fuerte: una letra que no existe es un error de programación. */
export function direccion(id: DireccionVisual['id']): DireccionVisual {
  const encontrada = DIRECCIONES.find((d) => d.id === id)
  if (!encontrada) throw new Error(`No existe la dirección visual ${id}`)
  return encontrada
}
