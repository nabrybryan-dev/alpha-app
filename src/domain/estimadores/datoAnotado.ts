/**
 * ¿ESE NÚMERO LO ANOTÓ LA PERSONA, O QUEDÓ EL DE LA VEZ ANTERIOR?
 *
 * Por qué existe: el check-in abre con el peso y los pasos del reporte anterior y con 7 horas de
 * sueño, y quien no toca esos selectores guarda igual. El 9-oct-2026 se vio en los datos reales:
 * una persona con el mismo peso en 11 de 12 reportes seguidos, otra con 8.000 pasos en 13 de 14.
 * Un estimador alimentado con eso aprende que nada se mueve, y acertar es fácil y no vale.
 *
 * Dos épocas:
 *   · Reportes CON `anotadoHoy` (desde este cambio): el formulario dice qué movió la persona. Es
 *     un hecho, no una suposición.
 *   · Reportes viejos, SIN esa marca: no se puede saber. Se aplica una regla prudente: el primero
 *     de una racha de valores idénticos vale (alguna vez salió de una báscula) y los repetidos
 *     seguidos quedan `dudoso`. Puede apartar un dato real —pesar lo mismo dos días pasa—, pero
 *     un dato real apartado cuesta poco y uno copiado contado como medición falsea la tendencia.
 *
 * Aquí no se borra ni se corrige nada: solo se clasifica para quien calcula.
 */
import type { CampoAnotable, CheckinDiario } from '../types'

export type Procedencia = 'anotado' | 'arrastrado' | 'dudoso' | 'ausente'

const porFecha = (a: CheckinDiario, b: CheckinDiario) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0)

/**
 * La procedencia del `campo` en cada reporte, en el MISMO orden en que llegaron (la comparación
 * con «el anterior» sí se hace por fecha).
 */
export function procedenciaDelDato(checkins: readonly CheckinDiario[], campo: CampoAnotable): Procedencia[] {
  const resultado = new Map<CheckinDiario, Procedencia>()
  let anterior: number | undefined
  for (const c of [...checkins].sort(porFecha)) {
    const v = c[campo]
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      resultado.set(c, 'ausente')
      continue
    }
    if (c.anotadoHoy) resultado.set(c, c.anotadoHoy.includes(campo) ? 'anotado' : 'arrastrado')
    else resultado.set(c, v === anterior ? 'dudoso' : 'anotado')
    anterior = v
  }
  return checkins.map((c) => resultado.get(c) ?? 'ausente')
}

/** Los reportes cuyo `campo` se anotó de verdad, y cuántos se apartaron por arrastrados o dudosos. */
export function checkinsConDatoAnotado(
  checkins: readonly CheckinDiario[],
  campo: CampoAnotable,
): { anotados: CheckinDiario[]; apartados: number } {
  const procedencias = procedenciaDelDato(checkins, campo)
  const anotados = checkins.filter((_, i) => procedencias[i] === 'anotado')
  const apartados = procedencias.filter((p) => p === 'arrastrado' || p === 'dudoso').length
  return { anotados, apartados }
}
