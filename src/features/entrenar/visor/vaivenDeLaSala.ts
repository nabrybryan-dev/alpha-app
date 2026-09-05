/**
 * EL VAIVÉN: la sala respira cuando nadie la toca.
 *
 * ## Para qué está
 *
 * Un salón absolutamente quieto se lee como una FOTO en perspectiva, y entonces nadie
 * prueba a girarlo. El vaivén es la única pista de que esto se mueve antes de que alguien
 * lo toque: dos grados y medio de deriva lentísima que no se miran, se notan.
 *
 * ## Por qué persigue el objetivo en vez de valer el seno
 *
 * Porque el objetivo se apaga al tocar. Si el vaivén FUERA el seno, al posar el dedo la
 * cámara saltaría de golpe hasta dos grados y medio, y al soltarlo otro tanto: el gesto
 * empezaría y terminaría con un tirón. Persiguiéndolo al 4 % por fotograma, tocar devuelve
 * la sala suavemente a donde estaba y soltar la deja entrar en la respiración sin costura.
 *
 * ## Y por qué se devuelve el DESVÍO y no el ángulo
 *
 * Porque el azimut es del dedo. La cámara la manda quien la arrastra; el vaivén solo le
 * suma su diferencia de este fotograma. Devolviendo un ángulo absoluto habría dos dueños
 * del azimut y el último en escribir ganaría — que es como se pierde un arrastre a medias.
 *
 * Vive fuera del visor porque dentro solo se podría probar montando WebGL, y en jsdom no
 * hay WebGL. Es la misma regla que ya cumplen `gestoVertical`, `rumboDelJoystick`,
 * `fisicaDelTambor` y `hundirEnElCuerpo`.
 */

/** Cuánto se abre el vaivén a cada lado, en grados. */
export const AMPLITUD = 2.5

/** Lo que tarda una respiración entera, en milisegundos. */
export const PERIODO = 2600

/** Cuánto se acerca el vaivén a su objetivo en cada fotograma. */
export const PERSECUCION = 0.04

/** Cuánto silencio hace falta para que la sala empiece a respirar. */
export const QUIETUD = 1500

/**
 * Por debajo de este desvío no se repinta.
 *
 * Sin el corte, la sala se repintaría eternamente para no moverse: el vaivén nunca llega
 * exactamente a su objetivo —lo persigue— así que el desvío tiende a cero sin serlo, y
 * cada fotograma pediría un `pintar()` que no cambia un píxel.
 */
export const DESVIO_MINIMO = 0.0008

export interface EstadoDelVaiven {
  /** El desvío acumulado, en grados. */
  vaiven: number
  /** Cuándo tocó el dedo por última vez. */
  ultimoDedo: number
  /** Si el sistema pide menos movimiento: entonces el objetivo es siempre 0. */
  reducido: boolean
}

/**
 * EL OBJETIVO DE ESTE INSTANTE.
 *
 * Cero mientras el dedo esté cerca —tocando o recién soltado— y cero siempre con
 * movimiento reducido. En reposo, un seno lento.
 */
export function objetivoDelVaiven(estado: EstadoDelVaiven, ahora: number): number {
  const quieto = ahora - estado.ultimoDedo > QUIETUD
  if (!quieto || estado.reducido) return 0
  return Math.sin(ahora / PERIODO) * AMPLITUD
}

/**
 * UN PASO DE RESPIRACIÓN.
 *
 * Devuelve el vaivén nuevo y el DESVÍO que hay que sumarle al azimut. `desvio` viene a
 * cero cuando el movimiento es despreciable, y esa es la señal de «no repintes».
 */
export function pasoDelVaiven(
  estado: EstadoDelVaiven,
  ahora: number,
): { vaiven: number; desvio: number } {
  const objetivo = objetivoDelVaiven(estado, ahora)
  const vaiven = estado.vaiven + (objetivo - estado.vaiven) * PERSECUCION
  const desvio = vaiven - estado.vaiven
  return Math.abs(desvio) < DESVIO_MINIMO ? { vaiven: estado.vaiven, desvio: 0 } : { vaiven, desvio }
}
