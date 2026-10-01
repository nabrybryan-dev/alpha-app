import { clamp, type Resorte } from './movimiento'
import type { Rgb } from './escena'

/**
 * El estado del agujero negro y sus colores. Lo comparten el bucle (`onda.ts`) y el dibujo
 * (`ondaDibujo.ts`).
 *
 * Colores en una tabla: anillo × modo (16 pasos) × nivel de alfa (10). Se construye bajo
 * demanda y guarda la cadena rgba() ya hecha: cero cadenas nuevas por cuadro.
 */
export const N = 96 // puntos de la firma y del eco

export interface Geo { cx: number; cy: number; Rh: number; rOut: number }
export interface Ojo extends Geo { brillo: number; voz: number; modo: number; aro?: number }

/** El lienzo y lo que cambia de tamaño o de calidad. */
export const L = {
  cv: null as HTMLCanvasElement | null,
  ctx: null as unknown as CanvasRenderingContext2D,
  W: 0, H: 0, reloj: 0, nStroke: 0,
  rect: { left: 0, top: 0 },
  NR: 11, SEG: 22, // anillos y segmentos del disco (8 × 16 si el cuadro pesa)
  W3: 0.55, W7: 0.3, W13: 0.15, // pesos de los armónicos del rizo (el tono los mueve; suman 1)
}

/** Las paletas del disco: Praxis (rojo-ámbar) y la persona (plata). El tema las reemplaza (--lienzo-disco-p / -u). */
export const PAL = {
  P: [[255, 236, 200], [255, 170, 80], [255, 90, 40], [255, 30, 30], [150, 12, 24]] as Rgb[],
  U: [[255, 255, 255], [228, 233, 240], [194, 200, 207], [154, 161, 171], [92, 100, 114]] as Rgb[],
}
/** Colores fijos por tema, construidos una vez. */
export const COL = {
  mezcla: 'lighter' as GlobalCompositeOperation, foton: null as Rgb | null, hor: '#000', hor0: 'rgba(0,0,0,0)',
  blancoPre: 'rgba(255,255,255,', blanco0: 'rgba(255,255,255,0)', mantBase: 'rgba(244,245,246,0.16)', mant: 'rgba(255,255,255,0.92)',
  cursorRed: 'rgba(255,255,255,0.95)', cursor: '#f4f5f6', brasa: [255, 90, 60] as Rgb, ascua: [255, 176, 130] as Rgb, luz: [244, 245, 246] as Rgb,
}

/** h: 0 el interior, caliente; 1 el borde. */
export function tono(h: number, modo: number): Rgb {
  const x = clamp(h, 0, 1) * (PAL.P.length - 1), i = Math.min(PAL.P.length - 2, Math.floor(x)), f = x - i, out = [0, 0, 0]
  for (let c = 0; c < 3; c++) { const p = PAL.P[i][c] + (PAL.P[i + 1][c] - PAL.P[i][c]) * f, u = PAL.U[i][c] + (PAL.U[i + 1][c] - PAL.U[i][c]) * f; out[c] = Math.round(p + (u - p) * modo) }
  return out
}
export const rgba = (c: Rgb, a: number): string => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + clamp(a, 0, 1).toFixed(3) + ')'

const ALFAS = [0.03, 0.06, 0.1, 0.15, 0.21, 0.29, 0.39, 0.52, 0.7, 0.92]
export const NIV = ALFAS.length
export const MODOS = 16
const NIVEL_DE = new Uint8Array(256)
for (let i = 0; i < 256; i++) { let m = 0, dm = 9; for (let n = 0; n < NIV; n++) { const d = Math.abs(i / 255 - ALFAS[n]); if (d < dm) { dm = d; m = n } } NIVEL_DE[i] = m }
export const nivelDe = (a: number): number => NIVEL_DE[clamp(Math.round(a * 255), 0, 255)]
export const CANAL_LENTE = 24, CANAL_FOTON = 32, CANAL_GOLPE = 33, CANAL_LUZ = 34
let canalU: number[] = [], LUT = new Map<number, string>(), LUTF = new Map<number, string>()
const CEROS = new Map<number, string>()
/* El anillo de fotones: en el tema claro va en tinta (el agujero es tinta); en el oscuro sale de la paleta del disco */
const colorCanal = (canal: number, mq: number): Rgb => (canal === CANAL_FOTON && COL.foton ? COL.foton : tono(canalU[canal], mq / (MODOS - 1)))
export function colorCero(canal: number, mq: number): string {
  const key = canal * MODOS + mq
  let s = CEROS.get(key)
  if (!s) { const c = colorCanal(canal, mq); s = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)'; CEROS.set(key, s) }
  return s
}
export function armarCanales(): void {
  canalU = []; LUT = new Map(); LUTF = new Map(); CEROS.clear()
  for (let j = 0; j < L.NR; j++) canalU[j] = j / (L.NR - 1)
  for (let j = 0; j < 6; j++) canalU[CANAL_LENTE + j] = 0.1 + (j / 5) * 0.8
  canalU[CANAL_FOTON] = 0.05; canalU[CANAL_GOLPE] = 0.3; canalU[CANAL_LUZ] = 0.45
}
armarCanales()
export function colorLut(canal: number, mq: number, nivel: number): string {
  const key = (canal * MODOS + mq) * NIV + nivel
  let s = LUT.get(key)
  if (!s) { const c = colorCanal(canal, mq); s = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + ALFAS[nivel] + ')'; LUT.set(key, s) }
  return s
}
/* El disco sin teselas: un degradado cónico por anillo y mitad. El alfa se cuantiza fino (48 niveles, paso ≈ 2 %) solo para reusar cadenas de la tabla:
   entre dos niveles el degradado interpola, así que no hay bandas. Cuesta ~22 trazos en vez de ~130. Sin createConicGradient (Safari viejo) se usan las teselas. */
export const CONICO = typeof CanvasRenderingContext2D !== 'undefined' && typeof CanvasRenderingContext2D.prototype.createConicGradient === 'function'
const NF = 48, AF_MAX = 0.95
export const nivelFino = (a: number): number => (a < 0.004 ? 0 : Math.min(NF - 1, Math.round((a / AF_MAX) * (NF - 1))))
export function colorFino(canal: number, mq: number, n: number): string {
  const key = (canal * MODOS + mq) * NF + n
  let s = LUTF.get(key)
  if (!s) { const c = colorCanal(canal, mq); s = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + ((n / (NF - 1)) * AF_MAX).toFixed(3) + ')'; LUTF.set(key, s) }
  return s
}

export type EstadoOnda = 'reposo' | 'habla' | 'escucha' | 'piensa' | 'aplanada' | 'firma' | 'quieta'
export interface Mantener { t0: number; suelta: number; desde: number; p: number }

function estadoInicial() {
  return {
    estado: 'reposo' as EstadoOnda, pA: 0, uA: 0, uObj: 0, uHasta: 0, tU: 0, ee: 0, k: 1, kObj: 1,
    forma: new Float32Array(N), formaObj: new Float32Array(N), mezcla: 0, mezclaObj: 0,
    silabas: [] as { t: number; a: number }[], golpe: 0, golpeFijo: 0, punto: null as { th: number; t0: number } | null,
    modo: 0, plata: false, tDom: 0, tNoDom: 0, fuenteMic: false, foco: false, quien: '',
    giro: 0, vel: 0.18, antic: 0, anticHasta: 0, asienta: 0, asientaT0: -1, tonoSt: 0, tonoObj: 0,
    piensaT: 0, chispaA: 0, chispaAng: -Math.PI / 2, chispaDesde: -1,
    firma: null as Float32Array | null, firmaDesde: null as Float32Array | null, firmaT: 0, trazando: false,
    eco: null as { pts: Float32Array; t1: number | null } | null, ecoT: 0, cursor: -1,
    quietaAmp: 1, respira: null as { nivel: number } | null, espejo: null as { t0: number; env: number[] } | null, mant: null as Mantener | null,
    compacta: false, hVis: 0, hAnim: null as { d: number; h: number; t0: number } | null, primero: true, moviendo: false,
  }
}
export const st = estadoInicial()
export function reiniciarEstado(): void { clearTimeout(st.tU); Object.assign(st, estadoInicial()) }

export type ClaveGeo = 'cx' | 'cy' | 'Rh' | 'rOut'
export const CLAVES_GEO: ClaveGeo[] = ['cx', 'cy', 'Rh', 'rOut']
export const sp: Record<ClaveGeo | 'brillo' | 'anillo', Resorte> = { cx: { x: 0, v: 0 }, cy: { x: 0, v: 0 }, Rh: { x: 0, v: 0 }, rOut: { x: 0, v: 0 }, brillo: { x: 0.5, v: 0 }, anillo: { x: 0, v: 0 } }

/** Lo que el dibujo deja medido para quien quiera mirarlo. */
export const dbg = { strokes: 0, costo: 0, p90: 0, p95: 0, dibujados: 0, firmaP: 0, ecoP: 0 }

/** La rugosidad de la voz: tres armónicos que corren por el borde. El tono los reparte (agudo = grano fino, grave = ola ancha). */
export function rugosidad(th: number, t: number, j: number): number {
  return L.W3 * Math.sin(3 * th + t * 2.1 * st.k + j * 0.7) + L.W7 * Math.sin(7 * th - t * 3.4 * st.k + j * 1.3) + L.W13 * Math.sin(13 * th + t * 5.2 + j)
}
/** La forma del día (lo ya contado) se asoma en el borde del disco. */
export function formaEn(th: number): number {
  if (st.mezcla < 0.01) return 0
  let u = ((th + Math.PI / 2) / (2 * Math.PI)) % 1
  if (u < 0) u += 1
  return st.forma[Math.min(N - 1, Math.round(u * (N - 1)))] * st.mezcla
}
export function tocarTrazo(): void { L.ctx.stroke(); L.nStroke++ }
