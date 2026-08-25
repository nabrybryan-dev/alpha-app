/**
 * El identificador de un vídeo de YouTube, venga la URL en la forma que venga.
 *
 * Existe porque el visor sólo sabía leer `watch?v=` y `youtu.be/`, y las fichas
 * de técnica se pegan casi siempre desde el móvil — que comparte **Shorts**.
 * Con una URL que no reconocía, el visor no montaba el iframe y el asesorado
 * veía la ficha sin vídeo: eso es lo que se reportaba como «no está disponible».
 *
 * Se acepta también un identificador pelado, porque alguna ficha se cargó así.
 */
const POR_RUTA =
  /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:shorts\/|embed\/|live\/|v\/))([\w-]{6,})/
const POR_PARAMETRO = /[?&]v=([\w-]{6,})/
const PELADO = /^[\w-]{11}$/

export function idDeYoutube(url: string | undefined): string | undefined {
  const limpia = url?.trim()
  if (!limpia) return undefined
  if (PELADO.test(limpia)) return limpia
  return POR_RUTA.exec(limpia)?.[1] ?? POR_PARAMETRO.exec(limpia)?.[1]
}
