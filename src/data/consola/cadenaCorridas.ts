import { modoNube, supabase } from '../supabase'

/**
 * Lectura de `cadena_corridas` (migración 0083) — la proyección de OBSERVACIÓN de la
 * cadena ①→④, una fila por evento de paso.
 *
 * SOLO LECTURA. La tabla la escribe exclusivamente `service_role` (el importador de la
 * fase 3, `subir_a_consola.py`); RLS en la base ya impide que el navegador inserte,
 * actualice o borre una sola fila, así que este archivo no ofrece esas operaciones — no
 * porque falte tiempo, sino porque escribirlas aquí sugeriría que existe un camino que la
 * base bloquea de todas formas.
 *
 * EL NOMBRE DE LAS COLUMNAS SALE DE AQUÍ, y de ningún otro sitio (lección de
 * `perfilEnNube.ts`: un `.select()` con una columna que no existe no avisa, ni en `tsc` ni
 * en los tests). `COLUMNAS_CADENA_CORRIDAS` es la única fuente; las pruebas de este archivo
 * la comparan contra la lista de columnas de la migración 0083.
 */
export const TABLA_CADENA_CORRIDAS = 'cadena_corridas'

export const COLUMNAS_CADENA_CORRIDAS = [
  'id',
  'event_id',
  'run_id',
  'usuario_id',
  'semana_inicio',
  'paso',
  'intento',
  'estado',
  'secuencia',
  'hash_artefacto',
  'version_reglas',
  'fecha_dato',
  'fecha_recepcion',
  'resumen',
  'avisos',
  'preguntas_pendientes',
  'creado_en',
] as const

const SELECCION_CADENA_CORRIDAS = COLUMNAS_CADENA_CORRIDAS.join(',')

export type PasoCadena = 1 | 2 | 3 | 4
export type EstadoCadenaCorrida = 'en_curso' | 'completado' | 'fallido' | 'descartado'

/** La fila tal como baja de Supabase: nombres de columna, tipos aún sin acomodar. */
export interface FilaCadenaCorrida {
  id: string
  event_id: string
  run_id: string
  usuario_id: string
  semana_inicio: string
  paso: number
  intento: number
  estado: string
  secuencia: number
  hash_artefacto: string
  version_reglas: string
  fecha_dato: string
  fecha_recepcion: string
  resumen: string | null
  avisos: unknown
  preguntas_pendientes: unknown
  creado_en: string
}

/** La misma fila, en el vocabulario del dominio (camelCase, tipos acotados). */
export interface CadenaCorrida {
  id: string
  eventId: string
  runId: string
  usuarioId: string
  /** Fecha ISO `YYYY-MM-DD`, el lunes de la semana que describe el evento. */
  semanaInicio: string
  paso: PasoCadena
  intento: number
  estado: EstadoCadenaCorrida
  secuencia: number
  hashArtefacto: string
  versionReglas: string
  /** Cuándo pasó el hecho que describe el evento (no cuándo llegó aquí). */
  fechaDato: string
  /** Cuándo lo recibió el servidor. Nunca la misma fecha que `fechaDato`: un ejecutor
   *  caído puede reconciliar horas después (riesgo de Q4 de Astra: "actualizado hace un
   *  minuto" puede significar que acaba de sincronizarse información de ayer). */
  fechaRecepcion: string
  resumen: string | null
  avisos: unknown[]
  preguntasPendientes: unknown[]
  creadoEn: string
}

const PASOS_VALIDOS: readonly number[] = [1, 2, 3, 4]
const ESTADOS_VALIDOS: readonly string[] = ['en_curso', 'completado', 'fallido', 'descartado']

/**
 * No lanza sobre una fila con forma inesperada: prefiere una fila menos en la lista a
 * tumbar toda la pantalla del tablero de agentes por una fila corrupta. `paso` y `estado`
 * fuera de su vocabulario son la señal de que algo cambió sin avisar a este archivo — se
 * descartan explícitamente, no se cuelan disfrazados de un valor válido.
 */
export function aCadenaCorrida(fila: FilaCadenaCorrida): CadenaCorrida | null {
  if (!PASOS_VALIDOS.includes(fila.paso)) return null
  if (!ESTADOS_VALIDOS.includes(fila.estado)) return null
  return {
    id: fila.id,
    eventId: fila.event_id,
    runId: fila.run_id,
    usuarioId: fila.usuario_id,
    semanaInicio: fila.semana_inicio,
    paso: fila.paso as PasoCadena,
    intento: fila.intento,
    estado: fila.estado as EstadoCadenaCorrida,
    secuencia: fila.secuencia,
    hashArtefacto: fila.hash_artefacto,
    versionReglas: fila.version_reglas,
    fechaDato: fila.fecha_dato,
    fechaRecepcion: fila.fecha_recepcion,
    resumen: fila.resumen,
    avisos: Array.isArray(fila.avisos) ? fila.avisos : [],
    preguntasPendientes: Array.isArray(fila.preguntas_pendientes) ? fila.preguntas_pendientes : [],
    creadoEn: fila.creado_en,
  }
}

/**
 * Los eventos de la cadena de una persona, ordenados por secuencia (el orden en que
 * ocurrieron según quien los emitió, no según cuándo llegaron — ver `fechaRecepcion`).
 *
 * `semanaInicio` es opcional: sin ella trae todas las semanas que haya (útil para el
 * historial); con ella acota a una sola semana (lo que pinta el tablero de agentes).
 *
 * Nunca lanza: en modo demo, sin sesión o ante cualquier error de red o de RLS devuelve
 * `[]`, igual que el resto de `src/data/nube/*` (un fallo aquí no puede tumbar la consola).
 */
export async function corridasDeLaCadena(
  usuarioId: string,
  semanaInicio?: string,
): Promise<CadenaCorrida[]> {
  if (!modoNube || !usuarioId) return []
  try {
    let consulta = supabase()
      .from(TABLA_CADENA_CORRIDAS)
      .select(SELECCION_CADENA_CORRIDAS)
      .eq('usuario_id', usuarioId)

    if (semanaInicio) consulta = consulta.eq('semana_inicio', semanaInicio)

    const { data, error } = await consulta.order('secuencia', { ascending: true })
    if (error || !data) return []

    return (data as unknown as FilaCadenaCorrida[])
      .map(aCadenaCorrida)
      .filter((fila): fila is CadenaCorrida => fila !== null)
  } catch {
    return []
  }
}

/**
 * El último evento visto de cada paso (1 a 4), calculado en memoria a partir de una lista
 * ya traída — no hace una consulta nueva. Separado de `corridasDeLaCadena` a propósito:
 * "cuál es el último" es una decisión de lectura, no de la base (Q1 de Astra: un reintento
 * no es lo mismo que una decisión nueva, y no siempre el de mayor secuencia es el que
 * importa mostrar — por ejemplo un `descartado` posterior a un `completado`).
 */
export function ultimoEventoPorPaso(
  corridas: readonly CadenaCorrida[],
): Partial<Record<PasoCadena, CadenaCorrida>> {
  const porPaso: Partial<Record<PasoCadena, CadenaCorrida>> = {}
  for (const corrida of corridas) {
    const actual = porPaso[corrida.paso]
    if (!actual || corrida.secuencia >= actual.secuencia) {
      porPaso[corrida.paso] = corrida
    }
  }
  return porPaso
}
