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

/** Etiqueta de una serie concreta (1-based) cuando el esquema no es uniforme. */
export function etiquetaDeSerie(
  ejercicio: { etiquetasSeries?: string[] },
  orden: number,
): string | undefined {
  return ejercicio.etiquetasSeries?.[orden - 1]
}
