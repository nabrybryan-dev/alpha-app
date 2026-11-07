/**
 * Horas de sueño y pasos dichos (medición del 7-nov-2026, vida-sueno-pasos.test.ts).
 *
 * Se separa de `numeroDeCita` (que comparten series, cargas y agua) para no cambiar el resto: aquí solo se leen
 * las formas que la batería encontró mal o perdidas. Nunca se adivina: un rango o «y pico» devuelve 'pregunta'.
 */
import { escanearNumeros, horaDeCita, minutosDeCita, normalizarTexto, numeroDeCita, redondear1, type NumeroDeCita } from './numeros.ts'

export type LecturaDicha = NumeroDeCita | 'pregunta' | null

const Y_PICO = /\by pico\b/
const DECIMAL_CON_COMA = /(\d),(\d)/g

/**
 * «hora y media» = 1,5; «6 horas 40 minutos» = 6,7; «8h» = 8; «6,5 horas» = 6,5. Un rango («6 o 7», «entre 5 y 6»,
 * «6 a 7») o «y pico» devuelven 'pregunta'; sin número, null.
 */
export function horasDeSueno(cita: string): LecturaDicha {
  const crudo = cita.replace(/(\d)\s*h\b/gi, '$1 horas').replace(DECIMAL_CON_COMA, '$1.$2')
  const n = normalizarTexto(crudo)
  if (Y_PICO.test(n)) return 'pregunta'
  const numeros = escanearNumeros(n).filter((x) => Number.isInteger(x.valor) || x.valor % 1 !== 0.5)
  if (numeros.length >= 2 && (/\bentre\b/.test(n) || /\d\s+(o|a)\s+\d|\b\w+ (o|a) \w+ horas?\b/.test(n))) return 'pregunta'
  const base = numeroDeCita(crudo)
  if (!base) return null
  if (/\bhoras?\b/.test(n)) {
    const min = minutosDeCita(n)
    if (min !== null && min > 0) return { valor: redondear1(min / 60), aproximado: base.aproximado }
  }
  return base
}

/** «8,000» = 8.000 (coma de miles: un paso no tiene decimales); «10k» y «7.5k» = miles; «y pico» devuelve 'pregunta'. */
export function pasosDeCita(cita: string): LecturaDicha {
  if (Y_PICO.test(normalizarTexto(cita))) return 'pregunta'
  const k = cita.match(/(\d+(?:[.,]\d+)?)\s*k\b/i)
  if (k) return { valor: Math.round(Number(k[1].replace(',', '.')) * 1000), aproximado: numeroDeCita(cita)?.aproximado ?? false }
  return numeroDeCita(cita.replace(/\b(\d{1,3}),(\d{3})\b/g, '$1$2'))
}

/** `horaDeCita` más medianoche y mediodía, que son horas sin número. */
export function horaDicha(cita: string | null | undefined, contexto: 'acostarse' | 'levantarse'): string | null {
  const n = normalizarTexto(cita ?? '')
  if (/\bmedianoche\b/.test(n)) return '00:00'
  if (/\bmediodia\b/.test(n)) return '12:00'
  return horaDeCita(cita, contexto)
}

/** La lectura con número, o null; si hay que preguntar, lo avisa con `alPreguntar` (sin bloquear lo demás). */
export function conNumero(l: LecturaDicha, alPreguntar: () => void): NumeroDeCita | null {
  if (l === 'pregunta') { alPreguntar(); return null }
  return l
}
