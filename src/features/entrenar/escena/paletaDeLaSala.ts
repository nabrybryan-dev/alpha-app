import type { Color } from '../../../domain/patrones/malla'
import { temaDeUnElemento, type Tema } from '../../../lib/temaDelDocumento'

/**
 * LOS COLORES DE LA SALA 3D, LEÍDOS DEL TEMA ACTIVO.
 *
 * La sala de cajas y el panel del muro se construyen en `sala.ts` con colores fijos
 * de carbón. Eso era correcto mientras el salón forzaba `data-theme="dark"`; al
 * quitar el forzado, en tema claro la pared negra se comía el texto oscuro y el
 * sujeto. Aquí se traducen los tokens `--salon-3d-*` a colores de malla, con los
 * mismos valores de siempre como respaldo cuando no hay DOM (pruebas) o el token
 * falta.
 *
 * No se cachea entre elementos: se llama al CONSTRUIR la sala, no en cada fotograma.
 * El caché es por contenedor y por tema, para que un cambio de `data-theme` se vea
 * sin recargar y para no repetir `getComputedStyle` mientras la cámara orbita.
 */

export interface PaletaDeLaSala {
  /** La pared: el color que ocupa más superficie. */
  pared: Color
  /** El zócalo y los marcos: un escalón por debajo de la pared. */
  zocalo: Color
  /** El panel del marcador, donde van las cifras. */
  panel: Color
  /** El marco de las placas y del material. */
  marco: Color
  /** Los segmentos encendidos del marcador y el acento de la sala. */
  vivo: Color
  /** Los segmentos apagados: tienen que seguir leyéndose como apagados. */
  apagado: Color
  /** El suelo. */
  suelo: Color
  /** El techo y el fondo del lienzo. */
  techo: Color
  /** El texto de la interfaz que va sobre la sala. */
  texto: Color
  /** El texto secundario. */
  tenue: Color
  /** El rojo de acción, ya corregido para pasar 4,5:1 sobre pared y panel. */
  accion: Color
  /** Cuánto oscurece la viñeta de la esquina (0-1). */
  sombra: number
  /** Cuánto brilla el ambiente (0-1). */
  brillo: number
}

const OSCURA: PaletaDeLaSala = {
  pared: [0.062, 0.068, 0.078],
  zocalo: [0.095, 0.104, 0.12],
  panel: [0.028, 0.03, 0.036],
  marco: [0.2, 0.22, 0.26],
  vivo: [1.0, 0.24, 0.24],
  apagado: [0.055, 0.058, 0.066],
  suelo: [0.043, 0.055, 0.071],
  techo: [0.043, 0.055, 0.071],
  texto: [0.957, 0.961, 0.965],
  tenue: [0.761, 0.784, 0.812],
  accion: [1.0, 0.604, 0.604],
  sombra: 0.45,
  brillo: 0.22,
}

const CLARA: PaletaDeLaSala = {
  pared: [0.945, 0.933, 0.902],
  zocalo: [0.553, 0.541, 0.514],
  panel: [0.875, 0.886, 0.906],
  marco: [0.659, 0.678, 0.702],
  vivo: [0.753, 0.051, 0.071],
  apagado: [0.765, 0.78, 0.808],
  suelo: [0.553, 0.541, 0.514],
  techo: [1, 1, 1],
  texto: [0.067, 0.067, 0.067],
  tenue: [0.247, 0.243, 0.227],
  accion: [0.561, 0.067, 0.098],
  sombra: 0.2,
  brillo: 0,
}

/** Convierte «#rrggbb», «r g b» o «rgb(r g b)» a 0-1; si no se entiende, respaldo. */
export function leerColor(texto: string, respaldo: Color): Color {
  const t = texto.trim()
  const hex = /^#([0-9a-f]{6})$/i.exec(t)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
  }
  const trio = /^(?:rgb\()?\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)\s*\)?$/.exec(t)
  if (trio) return [Number(trio[1]) / 255, Number(trio[2]) / 255, Number(trio[3]) / 255]
  return respaldo
}

const guardadas = new WeakMap<Element, { tema: Tema; paleta: PaletaDeLaSala }>()

/** La paleta de la sala para el tema que manda sobre `contenedor` (o la raíz). */
export function paletaDeLaSala(contenedor?: Element | null): PaletaDeLaSala {
  if (typeof document === 'undefined') return OSCURA
  const donde = contenedor ?? document.documentElement
  const tema = temaDeUnElemento(donde)
  const guardada = guardadas.get(donde)
  if (guardada && guardada.tema === tema) return guardada.paleta

  const base = tema === 'light' ? CLARA : OSCURA
  const css = getComputedStyle(donde)
  const v = (nombre: string, respaldo: Color) => leerColor(css.getPropertyValue(nombre), respaldo)
  const numero = (nombre: string, respaldo: number) => {
    const leido = Number.parseFloat(css.getPropertyValue(nombre))
    return Number.isFinite(leido) ? leido : respaldo
  }
  const paleta: PaletaDeLaSala = {
    pared: v('--salon-3d-pared', base.pared),
    zocalo: v('--salon-3d-zocalo', base.zocalo),
    panel: v('--salon-3d-panel', base.panel),
    marco: v('--salon-3d-marco', base.marco),
    vivo: v('--salon-3d-segmento', base.vivo),
    apagado: v('--salon-3d-segmento-apagado', base.apagado),
    suelo: v('--salon-3d-tierra', base.suelo),
    techo: v('--salon-3d-cielo', base.techo),
    texto: v('--salon-3d-texto', base.texto),
    tenue: v('--salon-3d-tenue', base.tenue),
    accion: v('--salon-3d-accion', base.accion),
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
