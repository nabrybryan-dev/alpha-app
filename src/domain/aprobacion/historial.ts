import type { SemanaDeFirma } from './puerta'

/** Lo que la puerta necesita saber de cada fila de `videos_semanales`. */
export interface FilaDeRevision {
  /** Lunes de la semana (`AAAA-MM-DD`). */
  semana: string
  aprobado_en: string | null
  aprobado_por: string | null
  correccion_solicitada: string | null
  /** Sube cada vez que el archivo se rehace; más de 1 = hubo que rehacerlo. */
  version: number
  /** Quién pidió la última corrección (migración 0150). Null = no se sabe (filas anteriores). */
  correccion_pedida_por: string | null
  /**
   * Por qué subió la versión (migración 0150). Null = no se sabe: NO cuenta como corrección.
   * 'correccion' solo si había una corrección pendiente; si no, 'republicacion_tecnica'.
   */
  motivo_version: 'correccion' | 'republicacion_tecnica' | null
}

export interface HistorialDeFirma {
  /** Semanas YA CERRADAS, seguidas en el calendario (una sin filas entra vacía). */
  semanas: SemanaDeFirma[]
  /** La semana que aún no ha terminado: se muestra, pero no cuenta para la puerta. */
  enCurso: (SemanaDeFirma & { firmados: number }) | null
}

const DIA = 86_400_000
const aMs = (f: string) => Date.parse(`${f}T00:00:00Z`)
const aFecha = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const sumarDias = (f: string, n: number) => aFecha(aMs(f) + n * DIA)
/** El lunes de la semana de `f`. */
function lunesDe(f: string): string {
  const dia = new Date(aMs(f)).getUTCDay() // 0 = domingo
  return sumarDias(f, -((dia + 6) % 7))
}

function vacia(fecha: string): SemanaDeFirma {
  return { fecha, borradores: 0, aprobadosSinTocar: 0, corregidos: 0 }
}

/** ¿Esta fila pesa como corrección en el semáforo de `firmante`? Solo si la pidió él. */
function correccionDeEsteFirmante(f: FilaDeRevision, firmante: string): boolean {
  if (f.correccion_pedida_por !== firmante) return false
  const pendiente = f.correccion_solicitada !== null
  const atendida = f.version > 1 && f.motivo_version === 'correccion'
  return pendiente || atendida
}

/**
 * Convierte las filas de revisión en el historial de UN firmante para `veredictoDeLaPuerta`.
 *
 * - Una fila cuenta como borrador de este firmante si la firmó él o si nadie la ha firmado
 *   aún. Lo que firmó otra persona no entra: cada firmante tiene su propia puerta. Tampoco entra
 *   una corrección pendiente que pidió otra persona (decisión de Bryan, 29-oct: cada firmante
 *   carga sus propias devoluciones). Si él la pidió, entra como corregida aunque firme otro.
 * - «Sin tocar» = firmada por él, a la primera versión y sin corrección pedida.
 * - «Corregido» para ESTE firmante = una corrección que ÉL pidió (pendiente, o ya atendida en una
 *   versión nueva con motivo 'correccion'). Una que pidió otra persona pesa en el semáforo de esa
 *   persona, no en el de este. Una republicación técnica no cuenta para nadie.
 * - La semana en curso (la del lunes de `hoy`, o posterior) va aparte: lo pendiente de una
 *   semana que no ha terminado no es «sin mirar». Las anteriores sí: silencio no es firma.
 * - Una semana cerrada sin filas entra vacía, para que «seguidas» sean semanas del calendario.
 *
 * LÍMITES CON LOS DATOS QUE HAY:
 * - Filas anteriores a la 0150 no traen quién pidió ni el motivo: no cuentan como corrección para
 *   nadie, y si la corrección sigue pendiente tampoco cuentan como «sin mirar» (decisión de Bryan,
 *   29-oct).
 * - Una fila firmada antes de la 0081 tiene `aprobado_en` pero no `aprobado_por`: no se sabe
 *   quién firmó y se deja fuera del historial de todos. Esa semana queda más corta o vacía,
 *   y por el hueco la racha se corta (lo prudente).
 *
 * @param hoy Fecha local `AAAA-MM-DD`.
 */
export function semanasDeFirma(
  filas: readonly FilaDeRevision[],
  firmante: string,
  hoy: string,
): HistorialDeFirma {
  const lunesHoy = lunesDe(hoy)
  const porSemana = new Map<string, SemanaDeFirma>()
  let enCurso: (SemanaDeFirma & { firmados: number }) | null = null

  for (const f of filas) {
    // La corrección que pidió este firmante le pesa a él aunque después firme otra persona.
    const suya = correccionDeEsteFirmante(f, firmante)
    if (!suya && f.aprobado_en && f.aprobado_por !== firmante) continue
    // Una corrección pendiente que pidió otra persona es de su semáforo: no es «sin mirar» de este.
    // Si no se sabe quién la pidió (anterior a la 0150), sale del de todos (Bryan, 29-oct).
    if (!suya && !f.aprobado_en && f.correccion_solicitada !== null) continue
    const lunes = lunesDe(f.semana)
    const abierta = lunes >= lunesHoy
    let s: SemanaDeFirma
    if (abierta) {
      // Siempre el lunes de ESTA semana, aunque haya borradores adelantados de semanas futuras.
      s = enCurso ??= { ...vacia(lunesHoy), firmados: 0 }
      if (f.aprobado_en) enCurso.firmados++
    } else {
      s = porSemana.get(lunes) ?? vacia(lunes)
      porSemana.set(lunes, s)
    }
    s.borradores++
    if (suya) s.corregidos++
    else if (f.aprobado_en) s.aprobadosSinTocar++
  }

  const semanas: SemanaDeFirma[] = []
  const ultima = sumarDias(lunesHoy, -7)
  const primera = [...porSemana.keys()].sort()[0]
  if (primera) {
    for (let w = primera; w <= ultima; w = sumarDias(w, 7)) semanas.push(porSemana.get(w) ?? vacia(w))
  }
  return { semanas, enCurso }
}
