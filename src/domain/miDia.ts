import type { CheckinDiario, MedidaCorporal } from './types'

/**
 * Las cuentas de «Mi día» del staff que también entrena (maqueta «Espacios de Alpha»,
 * 28-sep): el sueño medio de la semana, la curva del peso y los perímetros más recientes.
 *
 * Funciones PURAS: no saben qué día es (se les pasa `hoy`) ni de dónde vienen los datos.
 * Devuelven HECHOS, y lo que no se midió sale `undefined`, nunca cero ni «lo normal» —
 * la misma regla que `pesoKg` en `types.ts`—: la pantalla decide si pinta la raya o calla.
 */

const DIA_MS = 24 * 60 * 60 * 1000

/** `iso` menos `dias` días, en ISO. Mediodía UTC para que ningún cambio de hora mueva la fecha. */
export function restarDias(iso: string, dias: number): string {
  const t = new Date(`${iso}T12:00:00Z`).getTime() - dias * DIA_MS
  return new Date(t).toISOString().slice(0, 10)
}

const redondear1 = (n: number) => Math.round(n * 10) / 10

/**
 * Horas de sueño medias de los últimos `dias` días naturales, hoy incluido.
 *
 * Se promedian solo las noches que la persona apuntó: una noche sin apuntar no es una
 * noche de cero horas. Pero una noche APUNTADA con 0 horas sí cuenta (el formulario admite
 * el cero, y excluirlo subía la media: 0 y 8 daban 8 en vez de 4 — E-08 de la revisión de
 * Codex del 28-sep). Solo se excluye lo ausente, lo negativo o lo no finito. Sin ninguna,
 * `undefined`.
 */
export function suenoMedio(checkins: readonly CheckinDiario[], hoy: string, dias = 7): number | undefined {
  const desde = restarDias(hoy, dias - 1)
  const horas = checkins
    .filter((c) => c.fecha >= desde && c.fecha <= hoy)
    .map((c) => c.horasSueno)
    .filter((h): h is number => typeof h === 'number' && Number.isFinite(h) && h >= 0)
  if (horas.length === 0) return undefined
  return redondear1(horas.reduce((a, b) => a + b, 0) / horas.length)
}

export interface PuntoDePeso {
  fecha: string
  kg: number
}

/**
 * El peso de las últimas `semanas`, de lo más viejo a lo más nuevo, un punto por día.
 *
 * DOS FUENTES, porque el peso vive en dos sitios: el check-in diario (en ayunas, casi
 * todos los días) y la toma de medidas (menos frecuente). Si un mismo día hay los dos,
 * manda el check-in: es el que se toma siempre en las mismas condiciones.
 */
export function serieDePeso(
  checkins: readonly CheckinDiario[],
  medidas: readonly MedidaCorporal[],
  hoy: string,
  semanas = 8,
): PuntoDePeso[] {
  const desde = restarDias(hoy, semanas * 7 - 1)
  const porDia = new Map<string, number>()
  // Un peso vale si es un número finito y positivo: un Infinity no es una pesada (E-09).
  const valido = (kg: unknown): kg is number => typeof kg === 'number' && Number.isFinite(kg) && kg > 0
  for (const m of medidas) {
    if (valido(m.pesoKg)) porDia.set(m.fecha.slice(0, 10), m.pesoKg)
  }
  for (const c of checkins) {
    if (valido(c.pesoKg)) porDia.set(c.fecha, c.pesoKg)
  }
  return [...porDia.entries()]
    .filter(([fecha]) => fecha >= desde && fecha <= hoy)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, kg]) => ({ fecha, kg }))
}

export interface CambioDePeso {
  /** Kilos, con signo: negativo es que bajó. */
  kg: number
  /** Días que separan las dos pesadas que se comparan. */
  dias: number
}

/**
 * Cuánto cambió el peso en unas `dias` (dos semanas por defecto): la última pesada contra
 * la más reciente que tenga al menos esa antigüedad. Sin una pesada así de vieja no hay
 * cambio que contar — comparar contra la de ayer diría «−0,1 en 2 semanas», y es falso.
 */
export function cambioDePeso(serie: readonly PuntoDePeso[], dias = 14): CambioDePeso | undefined {
  const ultima = serie.at(-1)
  if (!ultima) return undefined
  const tope = restarDias(ultima.fecha, dias)
  const base = [...serie].reverse().find((p) => p.fecha <= tope)
  if (!base) return undefined
  const separacion = Math.round(
    (new Date(`${ultima.fecha}T12:00:00Z`).getTime() - new Date(`${base.fecha}T12:00:00Z`).getTime()) / DIA_MS,
  )
  return { kg: redondear1(ultima.kg - base.kg), dias: separacion }
}

export interface Perimetros {
  cinturaCm?: number
  caderasCm?: number
  cuelloCm?: number
  /** Cuándo se tomaron, si se sabe. */
  fecha?: string
  /** De dónde salen: la tarjeta de medidas o la encuesta de nutrición. */
  fuente: 'medidas' | 'encuesta'
}

/** Un número positivo, o nada. La encuesta puede traerlo como texto («77,5»). */
const numero = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined
}

/**
 * Los tres perímetros más recientes que haya, sin mezclar tomas.
 *
 * Los perímetros viven en DOS tablas (ver la nota «las medidas viven en dos tablas»): la
 * tarjeta de medidas los guarda en `medidas[].cuerpo`, y la encuesta de nutrición en sus
 * respuestas (`cinturaCm`, `caderaCm`, `cuelloCm`). Manda la última toma de la tarjeta que
 * traiga alguno; si ninguna trae, la encuesta. No se combinan una cintura de agosto con
 * una cadera de septiembre: juntas dirían una silueta que nadie midió.
 */
export function perimetrosRecientes(
  medidas: readonly MedidaCorporal[],
  respuestasEncuesta: Readonly<Record<string, unknown>> | undefined,
): Perimetros | undefined {
  for (const m of [...medidas].reverse()) {
    const p = {
      cinturaCm: numero(m.cuerpo?.cinturaCm),
      caderasCm: numero(m.cuerpo?.caderasCm),
      cuelloCm: numero(m.cuerpo?.cuelloCm),
    }
    if (p.cinturaCm || p.caderasCm || p.cuelloCm) return { ...p, fecha: m.fecha, fuente: 'medidas' }
  }
  const r = respuestasEncuesta ?? {}
  const p = { cinturaCm: numero(r.cinturaCm), caderasCm: numero(r.caderaCm), cuelloCm: numero(r.cuelloCm) }
  if (p.cinturaCm || p.caderasCm || p.cuelloCm) return { ...p, fuente: 'encuesta' }
  return undefined
}
