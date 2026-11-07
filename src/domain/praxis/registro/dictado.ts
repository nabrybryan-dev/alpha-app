/**
 * Lo que la persona DICE de sueño, horas y pasos, leído literal (medición del 7-nov-2026, vida-dictado.test.ts).
 *
 * Se separa de `numeroDeCita` (que comparten series, cargas y agua) para no cambiar el resto: aquí se leen las formas
 * que la medición encontró mal o perdidas. Reglas de Bryan (7-nov): un RANGO se pregunta con los dos números (nunca
 * se anota el primero), los minutos del sueño se suman con un decimal, y lo vago o «y pico» queda visible, no se guarda.
 */
import { escanearNumeros, horaDeCita, normalizarTexto, numeroDeCita, redondear1, type NumeroEncontrado } from './numeros.ts'
import type { Pregunta } from './tipos.ts'

export type Lectura<T = number> =
  | { tipo: 'valor'; valor: T; aproximado: boolean }
  | { tipo: 'rango'; etiquetas: [string, string] }
  | { tipo: 'vago' }
  | null

/** Separa lo pegado: «4h» → «4 h», «250ml» → «250 ml», «9pm» → «9 pm». */
export function separarPegado(texto: string): string {
  return texto.replace(/(\d)(?=[a-z])/gi, '$1 ').replace(/([a-z])(?=\d)/gi, '$1 ')
}

const fmt = (n: number): string => String(n).replace('.', ',')
const conMiles = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

// ---------------------------------------------------------------------------
// Rangos: «6 o 7», «entre 5 y 6», «de 8 a 9»
// ---------------------------------------------------------------------------

export interface RangoDicho {
  tokens: string[]
  a: NumeroEncontrado
  b: NumeroEncontrado
}

const CONECTORES = ['o', 'u', 'a']
const ANTES_DEL_RANGO = new Set(['entre', 'de', 'la', 'las', 'del'])

/** Dos números seguidos unidos por «o», «a» o «entre … y …». Recibe texto ya normalizado. */
export function buscarRango(norm: string): RangoDicho | null {
  // «entre diez y once»: la «y» sumaría diez y once (21); aquí es el conector del rango.
  const t = /\bentre\b/.test(norm) ? norm.replace(/\bentre\b(.*?)\by\b/, 'entre$1o') : norm
  const tokens = t.split(' ').filter(Boolean)
  const nums = escanearNumeros(t)
  for (let i = 0; i + 1 < nums.length; i++) {
    const medio = tokens.slice(nums[i].hasta, nums[i + 1].desde).filter((x) => x !== 'la' && x !== 'las')
    if (medio.length === 1 && CONECTORES.includes(medio[0])) return { tokens, a: nums[i], b: nums[i + 1] }
  }
  return null
}

/** La frase con cada uno de los dos números en el lugar del rango: «2 o 3 vasos» → «2 vasos», «3 vasos». */
export function variantesDeRango(r: RangoDicho): [string, string] {
  let ini = r.a.desde
  while (ini > 0 && ANTES_DEL_RANGO.has(r.tokens[ini - 1])) ini -= 1
  const izq = r.tokens.slice(0, ini)
  const der = r.tokens.slice(r.b.hasta)
  const con = (x: NumeroEncontrado) => [...izq, ...r.tokens.slice(x.desde, x.hasta), ...der].join(' ')
  return [con(r.a), con(r.b)]
}

/** Sin cifra: «nada», «cero» o «no» son una respuesta; lo demás («poquito», «harto») es vago. */
function sinNumero(n: string): Lectura<never> {
  if (!n) return null
  return /\b(0|cero|nada|ningun\w*|no)\b/.test(n) ? null : { tipo: 'vago' }
}

// ---------------------------------------------------------------------------
// Sueño
// ---------------------------------------------------------------------------

const PALABRAS_HORA = 'un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce'

function textoDeSueno(cita: string): string {
  const t = separarPegado(cita.replace(/(\d)\s*(?:hrs?|hs|h)\b/gi, '$1 horas'))
  return normalizarTexto(t)
    .replace(new RegExp(`\\b(${PALABRAS_HORA})(horas?)\\b`, 'g'), '$1 $2')
    // «siete y veinte»: el escáner las sumaría (27); son 7 h y 20 min.
    .replace(new RegExp(`\\b(${PALABRAS_HORA}) y (${Object.keys(MINUTOS_EN_PALABRAS).join('|')})\\b`, 'g'), (_m, h: string, mi: string) => `${h} y ${MINUTOS_EN_PALABRAS[mi]}`)
}

const MINUTOS_EN_PALABRAS: Record<string, number> = {
  cinco: 5, diez: 10, quince: 15, veinte: 20, veinticinco: 25, treinta: 30, cuarenta: 40, cincuenta: 50,
}

/** Minutos de «media», «cuarto», «tres cuartos» o una cifra de 1 a 59 (con `estricto`, solo de 5 en 5). */
function minutosSueltos(resto: string, estricto: boolean): number | null {
  const r = resto.replace(/\b(minutos?|mins?)\b/g, '').replace(/\s+/g, ' ').trim()
  if (r === 'media') return 30
  if (r === 'cuarto' || r === 'un cuarto') return 15
  if (r === 'tres cuartos') return 45
  const e = escanearNumeros(r)
  if (e.length !== 1 || e[0].desde !== 0 || e[0].hasta !== r.split(' ').length) return null
  const v = e[0].valor
  if (!Number.isInteger(v) || v < 1 || v > 59) return null
  return estricto && v % 5 !== 0 ? null : v
}

/** «6 horas 40», «cuatro horas y cuarto», «hora y media», «siete horas menos cuarto». */
function horasConMinutos(n: string): number | null {
  const m = n.match(/^(.*?)\bhoras?\b\s*(.*)$/)
  if (!m) return null
  const horas = m[1].trim() ? numeroDeCita(m[1])?.valor ?? null : 1
  if (horas === null) return null
  let resto = m[2].replace(/^y\s+/, '')
  const signo = /^menos\b/.test(resto) ? -1 : 1
  resto = resto.replace(/^menos\s+/, '')
  const min = resto ? minutosSueltos(resto, false) ?? 0 : 0
  return redondear1(horas + (signo * min) / 60)
}

/** «siete y cuarto», «7 y 20», «ocho menos cuarto» (sin la palabra «horas»); null si no hay fracción. */
function fraccionSinHoras(n: string): number | null {
  const e = escanearNumeros(n)[0]
  if (!e) return null
  const m = n.split(' ').slice(e.hasta).join(' ').match(/^(y|menos) (.+)$/)
  const min = m ? minutosSueltos(m[2], true) : null
  return m && min !== null ? redondear1(e.valor + ((m[1] === 'menos' ? -1 : 1) * min) / 60) : null
}

function valorDeSueno(n: string, primero: number): number {
  if (/\bhoras?\b/.test(n)) return horasConMinutos(n) ?? primero
  const min = n.match(/\b(\d+)\s*(?:minutos?|mins?)\b/)
  if (min) return redondear1(Number(min[1]) / 60)
  return fraccionSinHoras(n) ?? primero
}

export function leerSueno(cita: string): Lectura {
  const n = textoDeSueno(cita)
  if (/\by pico\b/.test(n)) return { tipo: 'vago' }
  const r = buscarRango(n)
  if (r) return { tipo: 'rango', etiquetas: [`${fmt(r.a.valor)} horas`, `${fmt(r.b.valor)} horas`] }
  const base = numeroDeCita(n)
  if (!base) return sinNumero(n)
  return { tipo: 'valor', valor: valorDeSueno(n, base.valor), aproximado: base.aproximado }
}

// ---------------------------------------------------------------------------
// Pasos
// ---------------------------------------------------------------------------

/** «8 mil quinientos» y «8 mil 500» = 8.500: junta lo que sigue a «N mil» (los pasos en palabras ya lo suman). */
function juntarMil(norm: string): string {
  const tk = norm.split(' ')
  const i = tk.findIndex((x, k) => x === 'mil' && /^\d+$/.test(tk[k - 1] ?? ''))
  if (i < 0) return norm
  const resto = tk.slice(i + 1)
  const e = escanearNumeros(resto.join(' '))[0]
  if (!e || e.desde !== 0 || !Number.isInteger(e.valor) || e.valor < 1 || e.valor >= 1000) return norm
  return [...tk.slice(0, i - 1), String(Number(tk[i - 1]) * 1000 + e.valor), ...resto.slice(e.hasta)].join(' ')
}

function textoDePasos(cita: string): string {
  const t = cita
    .replace(/(\d+(?:[.,]\d+)?)\s*k\b/gi, (_m, x: string) => String(Math.round(Number(x.replace(',', '.')) * 1000)))
    .replace(/\b(\d{1,3})[, ](\d{3})\b/g, '$1$2')
  return juntarMil(normalizarTexto(separarPegado(t)).replace(/\bmil y medio\b/g, 'mil quinientos'))
}

export function leerPasos(cita: string): Lectura {
  const n = textoDePasos(cita)
  if (/\by pico\b/.test(n)) return { tipo: 'vago' }
  const r = buscarRango(n)
  if (r) {
    const { a, b } = r
    const mil = a.valor < 1000 && b.valor >= 1000 && b.valor % 1000 === 0
    return { tipo: 'rango', etiquetas: [`${conMiles(mil ? a.valor * 1000 : a.valor)} pasos`, `${conMiles(b.valor)} pasos`] }
  }
  const base = numeroDeCita(n)
  return base ? { tipo: 'valor', ...base } : sinNumero(n)
}

// ---------------------------------------------------------------------------
// Horas del reloj
// ---------------------------------------------------------------------------

/** `horaDeCita` con la 12 bien puesta: «las 12 de la noche» es 00:00 y «las 12 del día» es 12:00. */
function horaUna(texto: string, contexto: 'acostarse' | 'levantarse'): string | null {
  const res = horaDeCita(texto, contexto)
  if (!res) return null
  const n = normalizarTexto(texto)
  if (!/\b(12|doce)\b/.test(n)) return res
  if (/\bdel dia\b/.test(n)) return `12:${res.slice(3)}`
  return /\bnoche\b/.test(n) ? `00:${res.slice(3)}` : res
}

export function leerHora(cita: string | null | undefined, contexto: 'acostarse' | 'levantarse'): Lectura<string> {
  if (!cita) return null
  const crudo = separarPegado(cita)
  const n = normalizarTexto(crudo)
  if (/\bmedianoche\b/.test(n)) return { tipo: 'valor', valor: '00:00', aproximado: false }
  if (/\bmediodia\b/.test(n)) return { tipo: 'valor', valor: '12:00', aproximado: false }
  const r = buscarRango(n)
  if (r) {
    const [a, b] = variantesDeRango(r).map((x) => horaUna(x, contexto))
    return a && b ? { tipo: 'rango', etiquetas: [a, b] } : null
  }
  const hora = horaUna(crudo, contexto)
  return hora ? { tipo: 'valor', valor: hora, aproximado: false } : null
}

// ---------------------------------------------------------------------------
// Qué se le dice a la persona cuando no hay un valor
// ---------------------------------------------------------------------------

export type CampoDictado = 'horasSueno' | 'pasos' | 'horaAcostarse' | 'horaLevantarse' | 'agua_cantidad'

const PEDIR: Record<CampoDictado, string> = {
  horasSueno: '¿Cuántas horas dormiste?',
  pasos: '¿Cuántos pasos marca tu celular o reloj?',
  horaAcostarse: '¿A qué hora te acostaste?',
  horaLevantarse: '¿A qué hora te levantaste?',
  agua_cantidad: '¿Cuánta agua fue?',
}

export interface Duda {
  /** Lo que la persona dijo, para mostrarlo si esta duda no cabe en la pregunta del momento. */
  cita?: string
  descartado?: { cita: string; motivo: string }
  seguimiento?: Pregunta
}

/** Rango: pregunta con los dos números (el «Otro» lo pone la tarjeta). Vago: queda visible y se ofrece el campo. */
export function dudaDe(l: Lectura<unknown>, cita: string | null | undefined, campo: CampoDictado): Duda {
  if (!cita || !l) return {}
  if (l.tipo === 'rango') {
    return { cita, seguimiento: { texto: `Dijiste «${cita}»: ¿cuál fue?`, opciones: [...l.etiquetas], campo_bloqueante: campo } }
  }
  if (l.tipo === 'vago') {
    return {
      cita,
      descartado: { cita, motivo: 'no es un número exacto, así que no se guardó: escríbelo y lo anoto' },
      seguimiento: { texto: PEDIR[campo], opciones: [], campo_bloqueante: campo },
    }
  }
  return {}
}
