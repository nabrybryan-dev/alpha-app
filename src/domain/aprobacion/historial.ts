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

/**
 * Convierte las filas de revisión en el historial de UN firmante para `veredictoDeLaPuerta`.
 *
 * - Una fila cuenta como borrador de este firmante si la firmó él o si nadie la ha firmado
 *   aún. Lo que firmó otra persona no entra: cada firmante tiene su propia puerta.
 * - «Sin tocar» = firmada por él, a la primera versión y sin corrección pedida.
 * - «Corregido» = versión mayor que 1 o corrección solicitada.
 * - La semana en curso (la del lunes de `hoy`, o posterior) va aparte: lo pendiente de una
 *   semana que no ha terminado no es «sin mirar». Las anteriores sí: silencio no es firma.
 * - Una semana cerrada sin filas entra vacía, para que «seguidas» sean semanas del calendario.
 *
 * LÍMITES CON LOS DATOS QUE HAY (sin migración):
 * - Pedir una corrección borra `aprobado_por` (migración 0081), así que una fila corregida y
 *   aún sin firmar no se sabe de quién es y entra en la puerta de TODOS los firmantes.
 * - `version > 1` no distingue una corrección de una republicación técnica del archivo; se
 *   cuenta como corrección (la lectura prudente: cierra la puerta, no la abre).
 * - Una fila firmada antes de la 0081 tiene `aprobado_en` pero no `aprobado_por`: no se sabe
 *   quién firmó y se deja fuera del historial de todos. Esa semana queda más corta o vacía,
 *   y por el hueco la racha se corta (otra vez, lo prudente).
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
    if (f.aprobado_en && f.aprobado_por !== firmante) continue
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
    if (f.version > 1 || f.correccion_solicitada !== null) s.corregidos++
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
