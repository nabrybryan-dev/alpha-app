/**
 * LA HOJA DE LA PORTADA DEL SALÓN, AL ESTILO DE LA MAQUETA 7 (pieza C2).
 *
 * Solo piel: radio 22, relleno alzado, sombra hacia arriba, asa de 38 x 5 y título de 19 px
 * (`1f-v7.css`, `.sl-hoja`, `.slh-grip`, `.slh-t`). La hoja arrastrable en sí YA existía
 * (`PanelInferior`); esto no toca su gesto, ni su apertura, ni la escena 3D.
 *
 * Apagada, el salón queda exactamente como estaba. La bandera es de código, no de datos:
 * se enciende con un cambio revisado, no desde la base.
 */
export const SALON_PORTADA_MAQUETA = false

export interface ClasesDeLaHoja {
  /** Clases de la hoja que sube y baja. */
  hoja: string
  /** Clases de la manija del tirador. */
  asa: string
  /** Clases del título del resumen plegado. */
  titulo: string
  /** Si la hoja deja su sombra en línea (la de siempre) o la lleva la clase. */
  sombraEnLinea: boolean
}

const HOJA_DE_SIEMPRE =
  'pointer-events-auto flex flex-col overflow-hidden rounded-t-[20px] border-t border-[rgb(var(--salon-3d-filete-rgb)/0.1)] bg-ink-900/95'
const ASA_DE_SIEMPRE = 'h-1 w-11 rounded-full bg-silver-500/60 transition-colors duration-base'
const TITULO_DE_SIEMPRE = 'line-clamp-2 font-display text-[15px] font-black leading-tight text-texto'

/** Sin argumento, manda la bandera de código. */
export function clasesDeLaHoja(maqueta: boolean = SALON_PORTADA_MAQUETA): ClasesDeLaHoja {
  if (!maqueta) {
    return { hoja: HOJA_DE_SIEMPRE, asa: ASA_DE_SIEMPRE, titulo: TITULO_DE_SIEMPRE, sombraEnLinea: true }
  }
  return {
    hoja: 'pointer-events-auto flex flex-col overflow-hidden hoja-portada',
    asa: 'hoja-portada-asa',
    titulo: 'line-clamp-2 font-display leading-tight text-texto hoja-portada-titulo',
    sombraEnLinea: false,
  }
}

/** La sombra en línea de la hoja, o nada si la lleva la clase. Vive aquí para no subir la complejidad de PanelInferior. */
export function sombraDeLaHoja(clases: ClasesDeLaHoja): string | undefined {
  return clases.sombraEnLinea ? '0 -18px 40px -24px var(--salon-3d-sombra-caja)' : undefined
}
