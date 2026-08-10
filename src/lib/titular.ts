/**
 * Titular de un texto largo, cortado por palabra.
 *
 * Existe por la nota técnica del gabinete del ejercicio. En producción `cues` no
 * es una frase suelta: son manuales de ejecución con secciones —«IMPLEMENTO: …
 * MONTAJE: … POSICIÓN: …»—. Medido el 2026-08-09 sobre los 506 ejercicios
 * activos, **102 caracteres de media y hasta 718**. En la ventana de 104 px del
 * tambor no entra ni de lejos, y el seed engañaba porque sus cues son de una
 * línea.
 *
 * Nunca parte una palabra ni deja un signo colgando antes de los puntos
 * suspensivos: lo que se lee a medias en el gimnasio se lee mal.
 */

/** Lo que cabe en la ventana del tambor sin partirse. */
export const LARGO_TITULAR = 64

export function titular(texto: string, largo = LARGO_TITULAR): string {
  const limpio = texto.trim().replace(/\s+/g, ' ')
  if (limpio.length <= largo) return limpio
  const corte = limpio.slice(0, largo)
  const ultimoEspacio = corte.lastIndexOf(' ')
  const util = ultimoEspacio > 0 ? corte.slice(0, ultimoEspacio) : corte
  return `${util.replace(/[\s.,;:·—-]+$/, '')}…`
}
