/* Tipos a mano para `encuadre.js`, que entra VERBATIM. Ver `ORIGEN.md`. */

/** Los motivos que emite `calificarEncuadre`.
 *
 *  **`disco_pequeño` lleva ñ.** No es un descuido que convenga «arreglar» aquí:
 *  el motivo se escribe así en `encuadre.js`, que es de solo lectura en este
 *  repo, y renombrarlo en la copia haría exactamente lo que `ORIGEN.md` prohíbe.
 *  La clave del copy en `copys.ts` sí va sin ñ, así que quien traduzca motivo a
 *  texto tiene que salvar esa distancia — y hacerlo en un sitio, no en cada
 *  pantalla. */
export type MotivoEncuadre =
  | 'no_es_lateral'
  | 'disco_pequeño'
  | 'camara_baja'
  | 'no_cabe'
  /** Desvío que no se puede deshacer porque no hay disco con el que medir φ. */
  | 'desvio_sin_disco'

export type NivelEncuadre = 'buena' | 'dudosa' | 'descartada'

export interface EntradaEncuadre {
  /** Metros del plano sagital del atleta a la lente. */
  dist?: number
  /** Metros a los que está la lente sobre el suelo. */
  altura?: number
  /** Campo de visión horizontal de la lente, en grados. */
  fov?: number
  anchoPx?: number
  /** Grados que la barra se sale del plano de imagen. */
  desvio?: number
  /** Altura del eje de cadera, en metros. */
  ejeM?: number
  separacionDiscos?: number
}

export interface Encuadre {
  dist: number
  altura: number
  fov: number
  anchoPx: number
  desvio: number
  ejeM: number
  /** Cuántos milímetros mide un píxel en el plano del atleta. */
  mmPorPx: number
  /** Diámetro en píxeles de un disco de 450 mm a esa distancia. */
  discoPx: number
  /** Ancho de escena, en metros. Por debajo de 2,4 no cabe atleta con barra. */
  anchoEscenaM: number
  /** Salto de escala entre los dos extremos de la barra, en tanto por uno. */
  saltoEscala: number
  saltoMin: number
  saltoMax: number
  cosFi: number
  /** Grados de la línea de la lente respecto al eje de cadera. */
  inclinacionGrados: number
  /** Error que queda en el brazo de momento si no se corrige nada. */
  errorSinCorregir: number
  /** Y el que queda haciéndolo bien: es el ruido de localizar el borde del
   *  disco, ±1 px sobre el diámetro. Nunca llega a cero, y por eso las dos
   *  cifras se enseñan juntas: la segunda sin la primera parece una promesa. */
  errorCorregido: number
}

export interface CalidadEncuadre {
  nivel: NivelEncuadre
  motivos: MotivoEncuadre[]
}

export const SEPARACION_DISCOS_M: { min: number; max: number; tipico: number }

export function encuadre(entrada?: EntradaEncuadre): Encuadre
/** Grados de desvío que rompen el reparto entre ejes, haya disco o no. */
export const DESVIO_MAX: number
/** Hasta aquí una toma sin disco sale `buena`: 5,8 % de error. */
export const DESVIO_BUENO_SIN_DISCO: number
/** Pasado esto, una toma sin disco se descarta ella sola. */
export const DESVIO_MAX_SIN_DISCO: number

export interface OpcionesCalificar {
  /** Si se ve un disco de 450 mm, que es lo que permite medir φ y corregir el
   *  escorzo. Por defecto `false`: dar por hecho que hay disco sería dar por
   *  hecho que la corrección ocurrió. */
  hayDisco?: boolean
}

export function calificarEncuadre(e: Encuadre, opciones?: OpcionesCalificar): CalidadEncuadre
