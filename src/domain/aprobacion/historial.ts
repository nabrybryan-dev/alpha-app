import type { SemanaDeFirma } from './puerta'

/** Lo que la puerta necesita saber de cada fila de `videos_semanales`. */
export interface FilaDeRevision {
  /** Lunes de la semana (`AAAA-MM-DD`). */
  semana: string
  aprobado_en: string | null
  aprobado_por: string | null
  correccion_solicitada: string | null
  /** Sube cada vez que el archivo se rehace; más de 1 = hubo que corregirlo. */
  version: number
}

/**
 * Convierte las filas de revisión en el historial de UN firmante para `veredictoDeLaPuerta`.
 *
 * - Una fila cuenta como borrador de este firmante si la firmó él o si nadie la ha firmado
 *   aún (pendiente). Lo que firmó otra persona no entra: cada firmante tiene su puerta.
 * - «Sin tocar» = firmada por él, a la primera versión y sin corrección pedida.
 * - «Corregido» = versión mayor que 1 o corrección solicitada.
 * - Lo pendiente cuenta como borrador pero no como aprobado: silencio no es firma.
 *
 * Devuelve de la semana más antigua a la más reciente.
 */
export function semanasDeFirma(filas: readonly FilaDeRevision[], firmante: string): SemanaDeFirma[] {
  const porSemana = new Map<string, SemanaDeFirma>()
  for (const f of filas) {
    if (f.aprobado_en && f.aprobado_por !== firmante) continue
    const s = porSemana.get(f.semana) ?? { fecha: f.semana, borradores: 0, aprobadosSinTocar: 0, corregidos: 0 }
    s.borradores++
    const corregida = f.version > 1 || f.correccion_solicitada !== null
    if (corregida) s.corregidos++
    else if (f.aprobado_en) s.aprobadosSinTocar++
    porSemana.set(f.semana, s)
  }
  return [...porSemana.values()].sort((a, b) => a.fecha.localeCompare(b.fecha))
}
