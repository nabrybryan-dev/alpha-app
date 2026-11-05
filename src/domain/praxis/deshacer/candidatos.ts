import { MAX_CANDIDATOS, VENTANA_HORAS, type RegistroLibro, type TipoRegistroLibro } from './tipos'

const MS_HORA = 3_600_000

/** Día calendario («2026-11-04») de un instante en la zona dada. No depende de la zona del proceso. */
export function diaLocal(instante: Date | string, zonaHoraria: string): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instante))
  const g = (t: string) => partes.find((p) => p.type === t)?.value ?? ''
  return `${g('year')}-${g('month')}-${g('day')}`
}

/** Hora local en minutos desde las 00:00 en la zona dada. */
export function minutosLocales(instante: Date | string, zonaHoraria: string): number {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: zonaHoraria,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instante))
  const g = (t: string) => Number(partes.find((p) => p.type === t)?.value ?? '0')
  return g('hour') * 60 + g('minute')
}

export interface FiltroCandidatos {
  tipo?: TipoRegistroLibro
  /** Hora dicha por la persona, en minutos locales (10:00 = 600). Tolerancia ±45 min. */
  minutoDicho?: number
}

export const TOLERANCIA_HORA_MIN = 45

/** ¿Entra el registro en la ventana? Sin deshacer, no futuro, ≤ 24 h Y del mismo día local que `ahora`. */
export function dentroDeLaVentana(r: RegistroLibro, ahora: Date, zonaHoraria: string): boolean {
  if (r.deshechoEn !== null) return false
  const t = new Date(r.creadoEn).getTime()
  if (Number.isNaN(t)) return false
  const edad = ahora.getTime() - t
  if (edad < 0 || edad > VENTANA_HORAS * MS_HORA) return false
  return diaLocal(r.creadoEn, zonaHoraria) === diaLocal(ahora, zonaHoraria)
}

/** Todos los vigentes de la ventana, del más reciente al más viejo (empate: id descendente). Sin tope. */
export function vigentesEnVentana(
  libro: readonly RegistroLibro[],
  ahora: Date,
  zonaHoraria: string,
  filtro: FiltroCandidatos = {},
): RegistroLibro[] {
  return libro
    .filter((r) => dentroDeLaVentana(r, ahora, zonaHoraria))
    .filter((r) => filtro.tipo === undefined || r.tipo === filtro.tipo)
    .filter(
      (r) =>
        filtro.minutoDicho === undefined ||
        Math.abs(minutosLocales(r.creadoEn, zonaHoraria) - filtro.minutoDicho) <= TOLERANCIA_HORA_MIN,
    )
    .sort((a, b) => {
      const dt = new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime()
      return dt !== 0 ? dt : b.id.localeCompare(a.id)
    })
}

/** Hasta 3 candidatos para deshacer, del más reciente al más viejo. No escribe nada. */
export function candidatosParaDeshacer(
  libro: readonly RegistroLibro[],
  ahora: Date,
  zonaHoraria: string,
  filtro: FiltroCandidatos = {},
): RegistroLibro[] {
  return vigentesEnVentana(libro, ahora, zonaHoraria, filtro).slice(0, MAX_CANDIDATOS)
}
