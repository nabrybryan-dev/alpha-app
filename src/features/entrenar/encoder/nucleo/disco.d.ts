/* Tipos a mano para `disco.js`, que entra VERBATIM. Ver `ORIGEN.md`. */

export interface AjusteCircunferencia {
  x: number
  y: number
  r: number
  residuo: number
}

export interface EstructuraDesconocida {
  tipo: 'desconocida' | 'no-circular'
  motivo: string
  cobertura: number
  redondez?: number
  ajuste?: AjusteCircunferencia
  /**
   * Cuánto del lado corto del encuadre ocupaba el disco ajustado. Solo viene
   * cuando el rechazo fue por eso, o sea por pasarse de `FRACCION_MARCO_MAX`.
   */
  fraccion?: number
}

export interface EstructuraDisco {
  tipo: 'disco'
  ajuste: AjusteCircunferencia
  cobertura: number
  redondez: number
  relacionEjes: number
  /** Grados fuera de la perpendicular. Por encima de 10 hay que moverse. */
  anguloCamara: number
}

export type Estructura = EstructuraDisco | EstructuraDesconocida

export interface DiscoFallido {
  ok: false
  motivo: string
  cobertura?: number
  r?: number
}

export interface DiscoVisto {
  ok: true
  /** Por debajo del 90 % de contorno visto el fotograma va marcado: el ajuste
   *  sale igual, pero un instrumento dice cuanto se fia. */
  fiable: boolean
  x: number
  y: number
  r: number
  /** El diametro visto hace de separacion entre marcadores: es la escala. */
  sepPx: number
  cobertura: number
  relacionEjes: number
}

export type ResultadoDisco = DiscoVisto | DiscoFallido

export function identificarEstructura(
  datos: Uint8ClampedArray,
  ancho: number,
  alto: number,
  punto: { x: number; y: number },
  opciones?: { radioMax?: number },
): Estructura

export function detectarDisco(
  datos: Uint8ClampedArray,
  ancho: number,
  alto: number,
  prediccion: { x: number; y: number },
  radioEsperado: number,
  opciones?: { radioMax?: number },
): ResultadoDisco

/**
 * Cuánto del lado corto del encuadre puede ocupar un disco, como mucho.
 *
 * Reja de plausibilidad sobre el ARRANQUE, y a propósito no mira la forma: las
 * señales de forma no distinguen la cara del primer disco de la pila entera,
 * porque una pila de discos coaxiales también es redonda y se ajusta bien.
 */
export const FRACCION_MARCO_MAX: number

export const DIAMETROS_DISCO_MM: ReadonlyArray<{ etiqueta: string; mm: number }>

/** Reja de plausibilidad: un ROM imposible delata un diametro mal tecleado
 *  antes de que el numero llegue a ninguna parte. */
export function romPlausible(
  romM: number,
  ejercicio?: string,
): { ok: boolean; motivo?: string; clave?: string }
