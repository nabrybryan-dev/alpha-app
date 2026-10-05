import { modoNube, supabase } from '../supabase'

/**
 * Escritura y lectura de `ordenes` (migración 0083): el registro idempotente de una acción
 * humana — detener, reportar riesgo, pedir corrección, responder. Es la PRIMERA escritura
 * de la consola del coach: todo lo demás (`cadenaCorridas.ts`, `planesEstrategicos.ts`) es
 * solo lectura.
 *
 * `actor_id` NUNCA se manda desde aquí: la columna trae `default auth.uid()` y la política
 * `ordenes_crear_segun_capacidad` exige `actor_id = auth.uid()`. Mandarlo sería redundante
 * en el mejor caso y, si algún día la base dejara de tener el default, un camino de
 * suplantación en el peor — así que ni siquiera se ofrece el parámetro.
 */
export const TABLA_ORDENES = 'ordenes'

export type TipoOrden = 'detener' | 'reportar_riesgo' | 'pedir_correccion' | 'responder' | 'reanudar' | 'preparar_firma'

const TIPOS_VALIDOS: readonly string[] = [
  'detener',
  'reportar_riesgo',
  'pedir_correccion',
  'responder',
  'reanudar',
  'preparar_firma',
]

/** La fila tal como baja de Supabase. */
export interface FilaOrden {
  id: string
  actor_id: string
  tipo: string
  objetivo: unknown
  idempotency_key: string
  creada_en: string
}

/** La misma fila, en el vocabulario del dominio. */
export interface Orden {
  id: string
  actorId: string
  tipo: TipoOrden
  objetivo: Record<string, unknown>
  idempotencyKey: string
  creadaEn: string
}

const SELECCION_ORDENES = 'id, actor_id, tipo, objetivo, idempotency_key, creada_en'

/** No lanza sobre una fila con forma inesperada: una fila menos en la lista, no una
 *  pantalla rota. Un `tipo` fuera del vocabulario conocido se descarta. */
function aOrden(fila: FilaOrden): Orden | null {
  if (!TIPOS_VALIDOS.includes(fila.tipo)) return null
  return {
    id: fila.id,
    actorId: fila.actor_id,
    tipo: fila.tipo as TipoOrden,
    objetivo: fila.objetivo && typeof fila.objetivo === 'object' ? (fila.objetivo as Record<string, unknown>) : {},
    idempotencyKey: fila.idempotency_key,
    creadaEn: fila.creada_en,
  }
}

/**
 * `detener|usuario_id|semana_inicio|actor`. Dos clics del MISMO actor sobre la MISMA
 * persona y semana arman la MISMA clave: el segundo insert choca con el `unique` de
 * `idempotency_key` (23505) y no duplica la orden — ver `insertarOrden`.
 */
export function claveDetener(usuarioId: string, semanaInicio: string, actorId: string): string {
  return `detener|${usuarioId}|${semanaInicio}|${actorId}`
}

/** Misma forma que `claveDetener`, con `reportar_riesgo` por delante: dos reportes del
 *  mismo actor sobre la misma persona y semana tampoco duplican. */
export function claveReportarRiesgo(usuarioId: string, semanaInicio: string, actorId: string): string {
  return `reportar_riesgo|${usuarioId}|${semanaInicio}|${actorId}`
}

/**
 * `reanudar|usuario_id|semana_inicio|actor|hora`. A diferencia de `claveDetener`, esta SÍ
 * lleva la hora (contrato, punto 1): una persona se puede detener y reanudar varias veces
 * seguidas, así que dos reanudaciones NO deben colapsar en la misma orden — cada clic real
 * es un hecho nuevo que contar, no un reintento del mismo clic.
 */
export function claveReanudar(usuarioId: string, semanaInicio: string, actorId: string, ahoraIso: string): string {
  return `reanudar|${usuarioId}|${semanaInicio}|${actorId}|${ahoraIso}`
}

/** Misma forma que `claveDetener` (colapsa dos clics del mismo actor): `preparar_firma`
 *  no necesita la hora porque, a diferencia de reanudar, no tiene sentido preparar dos
 *  veces el mismo caso a la vez — el segundo clic es un reintento, no un hecho nuevo. */
export function clavePrepararFirma(usuarioId: string, semanaInicio: string, actorId: string): string {
  return `preparar_firma|${usuarioId}|${semanaInicio}|${actorId}`
}

export type ResultadoOrden =
  | { ok: true; yaExistia: false; orden: Orden }
  /** 23505 (idempotency_key duplicada): éxito silencioso, no un error que enseñar. */
  | { ok: true; yaExistia: true }
  | { ok: false; error: string }

const CODIGO_DUPLICADO = '23505'
const CODIGO_SIN_PERMISO = '42501'

function mensajeDeError(error: { code?: string; message: string }): string {
  if (error.code === CODIGO_SIN_PERMISO) return 'No tienes permiso para esta acción.'
  return error.message || 'No se pudo guardar. Vuelve a intentarlo.'
}

/**
 * Inserta una orden. Nunca lanza.
 *
 * Un duplicado por `idempotency_key` (23505 — dos clics, o el mismo clic reenviado por una
 * red inestable) se trata como éxito silencioso: `{ ok: true, yaExistia: true }`, nunca un
 * error en pantalla — es justo lo que "ya estaba detenida" pide (encargo, punto 6). RLS
 * deniega con 42501 cuando falta la capacidad del tipo (`tiene_capacidad`, migración 0083):
 * eso SÍ es un error, y se traduce a un mensaje legible en vez del código de Postgres.
 */
export async function insertarOrden(
  tipo: TipoOrden,
  objetivo: Record<string, unknown>,
  idempotencyKey: string,
): Promise<ResultadoOrden> {
  if (!modoNube) return { ok: false, error: 'Sin conexión con la base: esto es un demo.' }
  try {
    const { data, error } = await supabase()
      .from(TABLA_ORDENES)
      .insert({ tipo, objetivo, idempotency_key: idempotencyKey })
      .select(SELECCION_ORDENES)
      .single()

    if (error) {
      if (error.code === CODIGO_DUPLICADO) return { ok: true, yaExistia: true }
      return { ok: false, error: mensajeDeError(error) }
    }
    const orden = data ? aOrden(data as unknown as FilaOrden) : null
    if (!orden) return { ok: false, error: 'La base devolvió una orden con forma inesperada.' }
    return { ok: true, yaExistia: false, orden }
  } catch (fallo) {
    return { ok: false, error: fallo instanceof Error ? fallo.message : 'Error de red.' }
  }
}

export interface ParametrosOrdenPorPersona {
  usuarioId: string
  semanaInicio: string
  motivo: string
  actorId: string
}

/** «Detener publicación»: objetivo `{usuario_id, semana_inicio, motivo}`, clave por
 *  persona+semana+actor. */
export async function detenerPublicacion(params: ParametrosOrdenPorPersona): Promise<ResultadoOrden> {
  const clave = claveDetener(params.usuarioId, params.semanaInicio, params.actorId)
  return insertarOrden(
    'detener',
    { usuario_id: params.usuarioId, semana_inicio: params.semanaInicio, motivo: params.motivo },
    clave,
  )
}

/** «Reportar riesgo»: misma forma que `detenerPublicacion`, otro tipo y otra clave. */
export async function reportarRiesgo(params: ParametrosOrdenPorPersona): Promise<ResultadoOrden> {
  const clave = claveReportarRiesgo(params.usuarioId, params.semanaInicio, params.actorId)
  return insertarOrden(
    'reportar_riesgo',
    { usuario_id: params.usuarioId, semana_inicio: params.semanaInicio, motivo: params.motivo },
    clave,
  )
}

/** «Reanudar la semana del …»: misma forma que `detenerPublicacion`, con la hora en la
 *  clave (`claveReanudar`) para que varias reanudaciones de la misma persona y semana no
 *  colapsen entre sí. Exige `detener_publicacion` — la MISMA capacidad que detener
 *  (decisión de Bryan: «cualquiera del equipo puede reanudar»). */
export async function reanudarPublicacion(params: ParametrosOrdenPorPersona): Promise<ResultadoOrden> {
  const clave = claveReanudar(params.usuarioId, params.semanaInicio, params.actorId, new Date().toISOString())
  return insertarOrden(
    'reanudar',
    { usuario_id: params.usuarioId, semana_inicio: params.semanaInicio, motivo: params.motivo },
    clave,
  )
}

/** «Preparar para firmar»: misma forma que `detenerPublicacion`, otro tipo y otra clave.
 *  Exige `leer_entrenamiento`. La orden solo pide el caso — el equipo de mesa es quien
 *  crea la fila de `casos_firma` que la consola pasa a mostrar. */
export async function prepararFirma(params: ParametrosOrdenPorPersona): Promise<ResultadoOrden> {
  const clave = clavePrepararFirma(params.usuarioId, params.semanaInicio, params.actorId)
  return insertarOrden(
    'preparar_firma',
    { usuario_id: params.usuarioId, semana_inicio: params.semanaInicio, motivo: params.motivo },
    clave,
  )
}

/**
 * Las órdenes de uno o varios tipos visibles para quien pregunta. RLS (`ordenes_leer`) ya
 * decide qué se ve: el propio actor, el coach, o quien tenga `leer_entrenamiento` — esta
 * función solo pide y traduce, sin filtrar de más por su cuenta. Nunca lanza; `[]` ante
 * cualquier error (sin conexión, sin permiso, tabla caída).
 */
export async function ordenesRecientes(tipos: readonly TipoOrden[]): Promise<Orden[]> {
  if (!modoNube || tipos.length === 0) return []
  try {
    const { data, error } = await supabase()
      .from(TABLA_ORDENES)
      .select(SELECCION_ORDENES)
      .in('tipo', tipos as string[])
      .order('creada_en', { ascending: false })
    if (error || !data) return []
    return (data as unknown as FilaOrden[]).map(aOrden).filter((orden): orden is Orden => orden !== null)
  } catch {
    return []
  }
}
