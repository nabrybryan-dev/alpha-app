import { clamp } from './movimiento'

/** Funciones puras de texto y formato. Sin DOM y sin estado. */

export function fmtHora(minutos: number): string {
  const min = ((Math.round(minutos) % 1440) + 1440) % 1440
  return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0')
}
export function horaAMin(hhmm: string): number { const [a, b] = hhmm.split(':').map(Number); return a * 60 + b }
/** Minutos desde las 18:00. */
export function minNoche(hhmm: string): number { let m = horaAMin(hhmm) - 18 * 60; if (m < 0) m += 1440; return m }
export function fmtNum(n: number | string): string { return String(n).replace('.', ',') }
export function fmtMiles(n: number): string { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') }
export function fmtDur(m: number): string { const hh = Math.floor(m / 60), mm = Math.round(m % 60); return hh + ' h' + (mm ? ' ' + String(mm).padStart(2, '0') : '') }
export const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

const PALABRA_NUM = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce']
export function numPalabra(n: number): string { if (Number.isInteger(n) && n >= 0 && n < PALABRA_NUM.length) return PALABRA_NUM[n]; return fmtNum(n) }
export function horasPalabra(hs: number): string { if (Number.isInteger(hs)) return numPalabra(hs) + ' horas'; return numPalabra(Math.floor(hs)) + ' horas y media' }
export function listaY(a: string[]): string { return a.length <= 1 ? a[0] || '' : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1] }

const SIN_TILDE: Record<string, string> = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n', 'Á': 'a', 'É': 'e', 'Í': 'i', 'Ó': 'o', 'Ú': 'u', 'Ü': 'u', 'Ñ': 'n' }
/** Minúsculas y sin tildes, conservando el largo: los índices sirven sobre el texto original. */
export function normalizar(s: string): string {
  let o = ''
  for (let i = 0; i < s.length; i++) { const ch = s[i]; const lo = ch.toLowerCase(); o += SIN_TILDE[ch] || (lo.length === 1 ? lo : ch) }
  return o
}

/** Los entrenos del plan llegan con su código (LEG A, UPPER B…); a la persona se le muestran en español. El dato guardado no cambia. */
const SESION: Record<string, string> = { 'LEG A': 'Pierna A', 'LEG B': 'Pierna B', 'UPPER A': 'Torso A', 'UPPER B': 'Torso B' }
export function sesion(v: string): string { return SESION[v] || v }

export function abreviar(z: string): string { return z.toUpperCase().replace(/IZQUIERD[AO]/, 'IZQ.').replace(/DERECH[AO]/, 'DER.') }

/**
 * El ritmo de lectura: cada palabra dura según sus letras (60000/ppm para una palabra de
 * `letrasMedia` letras), con un piso y un techo, más una pausa tras coma o punto. Es un
 * reloj de LECTURA, no de habla: la prosodia hablada (0,15 s por sílaba) va ~2,3 veces más lenta.
 */
export const LECTURA = { ppm: 340, letrasMedia: 4.6, min: 90, max: 340, coma: 90, punto: 180 } as const

export interface Ritmo { inicios: number[]; silabas: number[]; dur: number }

export function silabasDe(palabra: string): number { return Math.max(1, (normalizar(palabra).match(/[aeiou]+/g) || []).length) }

export function ritmoLectura(palabras: string[]): Ritmo {
  const k = 60000 / LECTURA.ppm / (LECTURA.letrasMedia + 3)
  let t = 0
  const inicios: number[] = [], silabas: number[] = []
  palabras.forEach((p) => {
    inicios.push(t)
    const letras = normalizar(p).replace(/[^a-z0-9ñ]/g, '').length, d = clamp(k * (letras + 3), LECTURA.min, LECTURA.max) / 1000
    const n = silabasDe(p)
    for (let j = 0; j < n; j++) silabas.push(t + (j / n) * d * 0.9) // el disco «dice» la palabra mientras se lee
    t += d
    if (/[,;:]$/.test(p)) t += LECTURA.coma / 1000
    if (/[.?!»"]$/.test(p)) t += LECTURA.punto / 1000
  })
  return { inicios, silabas, dur: t }
}

/**
 * Cada órbita es una curva de verdad: la nota se coloca sobre su arco. El arco es una Bézier
 * cuadrática M0 y0 Q50 yc 100 y0 en una caja de 100×30; con el control en el medio, x es
 * lineal en t. y(t) = (1−t)²·y0 + 2t(1−t)·yc + t²·y0, con t = x_nota / ancho.
 */
export const yArco = (t: number, y0: number, yc: number): number => (1 - t) * (1 - t) * y0 + 2 * t * (1 - t) * yc + t * t * y0
