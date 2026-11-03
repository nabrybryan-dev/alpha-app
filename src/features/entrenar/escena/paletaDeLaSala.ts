import type { Color } from '../../../domain/patrones/malla'
import { temaDeUnElemento, type Tema } from '../../../lib/temaDelDocumento'

/**
 * LOS COLORES DE LA SALA 3D, LEÍDOS DEL TEMA ACTIVO.
 *
 * La sala de cajas y el panel del muro se construyen en `sala.ts`, y el lienzo se limpia
 * con un fondo. Antes eran constantes de carbón; desde la zona 8 salen de los tokens
 * `--salon-3d-*` del tema que manda sobre el contenedor, y se releen al cambiar
 * `data-theme`. Se leen al CONSTRUIR, no en cada fotograma: el caché es por elemento y
 * por tema.
 *
 * `TOKENS` es la ÚNICA tabla de colores: nombre del token, valor oscuro y valor claro.
 * El valor de cada tema sirve de respaldo cuando no hay DOM o el token falta, y
 * `paletaDeLaSala.test.ts` comprueba que coincide con `tokens.css`: si alguien cambia un
 * token y no esta tabla, se pone rojo.
 */

export interface PaletaDeLaSala {
  /** La pared: el color que ocupa más superficie. */
  pared: Color
  /** El zócalo: un escalón por debajo de la pared. */
  zocalo: Color
  /** El panel del marcador, donde van las cifras. */
  panel: Color
  /** El marco de las placas y del material. */
  marco: Color
  /** Los segmentos encendidos del marcador. */
  vivo: Color
  /** Los segmentos apagados: tienen que seguir leyéndose como apagados. */
  apagado: Color
  /** El fondo del lienzo: lo que se ve donde no llega la sala. */
  lienzo: Color
  /** Cuánto oscurece la viñeta de la esquina (0-1). */
  sombra: number
  /** Cuánto brilla el ambiente (0-1). */
  brillo: number
}

type ColorDe = Exclude<keyof PaletaDeLaSala, 'sombra' | 'brillo'>

/** campo → [token, oscuro, claro]. */
export const TOKENS: Record<ColorDe, readonly [string, string, string]> = {
  pared: ['--salon-3d-pared', '#101114', '#f1eee6'],
  zocalo: ['--salon-3d-zocalo', '#181b1f', '#8d8a83'],
  panel: ['--salon-3d-panel', '#070809', '#dfe2e7'],
  marco: ['--salon-3d-marco', '#333842', '#a8adb3'],
  vivo: ['--salon-3d-segmento', '#ff3d3d', '#c00d12'],
  apagado: ['--salon-3d-segmento-apagado', '#0e0f11', '#c3c7ce'],
  lienzo: ['--salon-3d-lienzo', '#0b0e12', '#e4e1d9'],
}
const NUMEROS = { sombra: ['--salon-3d-sombra', 0.45, 0.2], brillo: ['--salon-3d-brillo', 0.22, 0] } as const

/** Convierte «#rrggbb», «r g b» o «rgb(r g b)» a 0-1; si no se entiende, respaldo. */
export function leerColor(texto: string, respaldo: Color): Color {
  const t = texto.trim()
  const hex = /^#([0-9a-f]{6})$/i.exec(t)
  if (hex) {
    const n = parseInt(hex[1]!, 16)
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
  }
  const trio = /^(?:rgb\()?\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)\s*\)?$/.exec(t)
  if (trio) return [Number(trio[1]) / 255, Number(trio[2]) / 255, Number(trio[3]) / 255]
  return respaldo
}

function deRespaldo(tema: Tema): PaletaDeLaSala {
  const i = tema === 'light' ? 2 : 1
  const c = (campo: ColorDe) => leerColor(TOKENS[campo][i] as string, [0, 0, 0])
  return {
    pared: c('pared'), zocalo: c('zocalo'), panel: c('panel'), marco: c('marco'),
    vivo: c('vivo'), apagado: c('apagado'), lienzo: c('lienzo'),
    sombra: NUMEROS.sombra[i], brillo: NUMEROS.brillo[i],
  }
}

export const OSCURA_DE_RESPALDO: PaletaDeLaSala = deRespaldo('dark')
export const CLARA_DE_RESPALDO: PaletaDeLaSala = deRespaldo('light')

const guardadas = new WeakMap<Element, { tema: Tema; paleta: PaletaDeLaSala }>()

/** La paleta de la sala para el tema que manda sobre `contenedor` (o la raíz). */
export function paletaDeLaSala(contenedor?: Element | null): PaletaDeLaSala {
  if (typeof document === 'undefined') return OSCURA_DE_RESPALDO
  const donde = contenedor ?? document.documentElement
  const tema = temaDeUnElemento(donde)
  const guardada = guardadas.get(donde)
  if (guardada && guardada.tema === tema) return guardada.paleta

  const base = tema === 'light' ? CLARA_DE_RESPALDO : OSCURA_DE_RESPALDO
  const css = getComputedStyle(donde)
  const numero = (nombre: string, respaldo: number) => {
    const leido = Number.parseFloat(css.getPropertyValue(nombre))
    return Number.isFinite(leido) ? leido : respaldo
  }
  const leer = (campo: ColorDe) => leerColor(css.getPropertyValue(TOKENS[campo][0]), base[campo])
  const paleta: PaletaDeLaSala = {
    pared: leer('pared'), zocalo: leer('zocalo'), panel: leer('panel'), marco: leer('marco'),
    vivo: leer('vivo'), apagado: leer('apagado'), lienzo: leer('lienzo'),
    sombra: numero('--salon-3d-sombra', base.sombra),
    brillo: numero('--salon-3d-brillo', base.brillo),
  }
  guardadas.set(donde, { tema, paleta })
  return paleta
}

/** «#rrggbb» de un color 0-1, para el fondo CSS del lienzo. */
export function colorACss(c: Color): string {
  const h = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')
  return `#${h(c[0])}${h(c[1])}${h(c[2])}`
}
