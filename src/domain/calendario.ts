import { sumarDias } from './activacion'
import type { Microciclo, Sesion } from './types'

/** Índice 0 = domingo, igual que Date.getDay(). */
const DIAS_SEMANA = [
  'DOMINGO',
  'LUNES',
  'MARTES',
  'MIÉRCOLES',
  'JUEVES',
  'VIERNES',
  'SÁBADO',
] as const

export type DiaSemana = (typeof DIAS_SEMANA)[number]

function normalizar(texto: string): string {
  return texto.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Día programado de una sesión: usa el campo `dia` si viene del Cerebro y,
 * si no, lo deduce del nombre ("FULL BODY A - PIERNA (LUNES)" → "LUNES").
 */
export function diaDeSesion(sesion: Pick<Sesion, 'nombre' | 'dia'>): DiaSemana | undefined {
  const candidatos = [sesion.dia ?? '', sesion.nombre]
  for (const texto of candidatos) {
    const plano = normalizar(texto)
    const encontrado = DIAS_SEMANA.find((dia) => plano.includes(normalizar(dia)))
    if (encontrado) return encontrado
  }
  return undefined
}

/** Día de la semana de una fecha ISO local ("2026-07-20" → "LUNES"). */
export function diaSemanaDe(fechaIso: string): DiaSemana {
  return DIAS_SEMANA[new Date(`${fechaIso}T00:00:00`).getDay()]
}

/**
 * El lunes siguiente a una fecha: cuándo empieza «la próxima semana».
 *
 * Siempre avanza. Un lunes devuelve el lunes de después, no el mismo día, porque
 * quien programa el lunes por la mañana está programando la semana que viene, no
 * la que acaba de empezar.
 *
 * Es lunes y no «hoy + 7» porque las sesiones llevan su día escrito ("FULL BODY A
 * (LUNES)") y `sesionSugerida` las casa con el día del calendario. Un microciclo
 * que arranca a mitad de semana funciona, pero le desplaza a la persona lo que ve
 * en Hoy respecto de lo que dice su propia sesión.
 */
export function inicioProximaSemana(fechaIso: string): string {
  const dia = DIAS_SEMANA.indexOf(diaSemanaDe(fechaIso))
  // Índice 1 = lunes. El +1/-1 mantiene el resultado en 1..7 y nunca en 0, que
  // devolvería la misma fecha cuando ya es lunes.
  return sumarDias(fechaIso, ((1 - dia + 6) % 7) + 1)
}

/**
 * Sesión a destacar en Hoy: la pendiente programada para el día de la fecha;
 * si hoy no toca ninguna (o ya se registró), la primera pendiente en orden.
 */
export function sesionSugerida(
  microciclo: Microciclo,
  fechaIso: string,
  estaCompleta: (sesion: Sesion) => boolean,
): { sesion: Sesion; esDeHoy: boolean } | undefined {
  const pendientes = microciclo.sesiones.filter((s) => !estaCompleta(s))
  if (pendientes.length === 0) return undefined
  const hoy = diaSemanaDe(fechaIso)
  const deHoy = pendientes.find((s) => diaDeSesion(s) === hoy)
  if (deHoy) return { sesion: deHoy, esDeHoy: true }
  return { sesion: pendientes[0], esDeHoy: false }
}

/**
 * Semana del año (ISO 8601), la que rotula el Radar Alfa ("Sem 31").
 *
 * Se calcula en vez de escribirse a mano: un número fijo en el código acierta
 * una semana y miente las otras 51.
 */
export function semanaDelAnio(fechaIso: string): number {
  const fecha = new Date(`${fechaIso}T00:00:00`)
  // La semana 1 es la que contiene el primer jueves del año, así que se compara
  // jueves contra jueves.
  const jueves = new Date(fecha)
  jueves.setDate(fecha.getDate() - ((fecha.getDay() + 6) % 7) + 3)
  const primerJueves = new Date(jueves.getFullYear(), 0, 4)
  primerJueves.setDate(primerJueves.getDate() - ((primerJueves.getDay() + 6) % 7) + 3)
  const SEMANA_MS = 7 * 24 * 60 * 60 * 1000
  return 1 + Math.round((jueves.getTime() - primerJueves.getTime()) / SEMANA_MS)
}

/** Etiqueta de una serie concreta (1-based) cuando el esquema no es uniforme. */
export function etiquetaDeSerie(
  ejercicio: { etiquetasSeries?: string[] },
  orden: number,
): string | undefined {
  return ejercicio.etiquetasSeries?.[orden - 1]
}
