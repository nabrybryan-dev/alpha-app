import {
  esArea,
  esDireccion,
  esEstado,
  type Area,
  type Direccion,
  type EstadoDecision,
  type Periodicidad,
} from '../../domain/decisionesCompartidas'
import { modoNube, supabase } from '../supabase'
import type { Lectura } from './creadores'

/**
 * Decisiones compartidas Bryan/Manuela (migración 0094): lectura de la vista
 * `decisiones_con_estado` (el estado se CALCULA allí, no es una columna) y las dos únicas
 * escrituras que ofrece la base, `anotar_decision` y `firmar_decision`. El navegador no
 * inserta ni actualiza la tabla: RLS y `revoke` se lo impiden, y por eso aquí no hay `insert`.
 *
 * Las columnas y los parámetros salen de aquí y las pruebas los comparan contra el SQL.
 * NUNCA datos de salud: la base rechaza texto clínico; en entrenamiento y nutrición ni
 * siquiera hay campo de texto libre.
 */
export const VISTA_DECISIONES = 'decisiones_con_estado'
export const RPC_ANOTAR_DECISION = 'anotar_decision'
export const RPC_FIRMAR_DECISION = 'firmar_decision'
export const RPC_COMPANEROS = 'companeros_de_decision'

/** Las que la vista calcula (no están en la tabla `decisiones`). */
export const COLUMNAS_CALCULADAS_DECISIONES = [
  'decidido_por_nombre',
  'firma_de_nombre',
  'faltan',
  'programada',
  'estado',
] as const

export const COLUMNAS_DECISIONES = [
  'id',
  'decidido_por',
  'decidido_en',
  'area',
  'palanca',
  'direccion',
  'sujeto',
  'valor',
  'monto_cop',
  'periodicidad',
  'vigencia_desde',
  'vigencia_hasta',
  'resumen',
  'notas',
  'referencia_tabla',
  'referencia_id',
  'le_toca_a',
  'le_toca_que',
  'le_toca_vence',
  'firma_de',
  'firma_nivel',
  'firma_estado',
  'firma_vence_en',
  'firma_respondida_en',
  'firma_motivo',
  ...COLUMNAS_CALCULADAS_DECISIONES,
] as const

/** Los parámetros de `anotar_decision`, en el orden de la función. */
export const PARAMETROS_ANOTAR_DECISION = [
  'p_area',
  'p_palanca',
  'p_direccion',
  'p_sujeto',
  'p_valor',
  'p_monto_cop',
  'p_periodicidad',
  'p_vigencia_desde',
  'p_vigencia_hasta',
  'p_resumen',
  'p_notas',
  'p_referencia_tabla',
  'p_referencia_id',
  'p_le_toca_a',
  'p_le_toca_que',
  'p_le_toca_vence',
  'p_firma_de',
  'p_firma_nivel',
  'p_firma_vence_en',
] as const

export interface FilaDecision {
  id: string
  decidido_por: string
  decidido_en: string
  area: string
  palanca: string
  direccion: string
  sujeto: string
  valor: string | null
  monto_cop: number | string | null
  periodicidad: string | null
  vigencia_desde: string
  vigencia_hasta: string | null
  resumen: string | null
  notas: string | null
  referencia_tabla: string | null
  referencia_id: string | null
  le_toca_a: string | null
  le_toca_que: string | null
  le_toca_vence: string | null
  firma_de: string | null
  firma_nivel: string | null
  firma_estado: string | null
  firma_vence_en: string | null
  firma_respondida_en: string | null
  firma_motivo: string | null
  decidido_por_nombre: string | null
  firma_de_nombre: string | null
  faltan: string[] | null
  programada: boolean
  estado: string
}

export interface Decision {
  id: string
  decididoPor: string
  decididoPorNombre: string | null
  decididoEn: string
  area: Area
  palanca: string
  direccion: Direccion
  sujeto: string
  valor: string | null
  montoCop: number | null
  periodicidad: Periodicidad | null
  vigenciaDesde: string
  vigenciaHasta: string | null
  resumen: string | null
  notas: string | null
  leTocaA: 'bryan' | 'manuela' | null
  leTocaQue: string | null
  leTocaVence: string | null
  firmaDe: string | null
  firmaDeNombre: string | null
  firmaNivel: 'firma' | 'aviso' | null
  firmaEstado: 'pendiente' | 'firmada' | 'rechazada' | 'visto' | null
  firmaVenceEn: string | null
  firmaMotivo: string | null
  faltan: string[]
  programada: boolean
  estado: EstadoDecision
}

const PERIODICIDADES: readonly string[] = ['unica', 'mensual', 'semanal']
const FIRMA_ESTADOS: readonly string[] = ['pendiente', 'firmada', 'rechazada', 'visto']

/** Una fila con un valor que la app no conoce NO se descarta en silencio: `null` y la lectura lo avisa. */
export function aDecision(f: FilaDecision): Decision | null {
  if (!esArea(f.area) || !esDireccion(f.direccion) || !esEstado(f.estado)) return null
  if (f.periodicidad !== null && !PERIODICIDADES.includes(f.periodicidad)) return null
  if (f.firma_estado !== null && !FIRMA_ESTADOS.includes(f.firma_estado)) return null
  const monto = f.monto_cop === null ? null : Number(f.monto_cop)
  return {
    id: f.id,
    decididoPor: f.decidido_por,
    decididoPorNombre: f.decidido_por_nombre,
    decididoEn: f.decidido_en,
    area: f.area,
    palanca: f.palanca,
    direccion: f.direccion,
    sujeto: f.sujeto,
    valor: f.valor,
    montoCop: monto !== null && Number.isFinite(monto) ? monto : null,
    periodicidad: f.periodicidad as Periodicidad | null,
    vigenciaDesde: f.vigencia_desde,
    vigenciaHasta: f.vigencia_hasta,
    resumen: f.resumen,
    notas: f.notas,
    leTocaA: f.le_toca_a === 'bryan' || f.le_toca_a === 'manuela' ? f.le_toca_a : null,
    leTocaQue: f.le_toca_que,
    leTocaVence: f.le_toca_vence,
    firmaDe: f.firma_de,
    firmaDeNombre: f.firma_de_nombre,
    firmaNivel: f.firma_nivel === 'firma' || f.firma_nivel === 'aviso' ? f.firma_nivel : null,
    firmaEstado: f.firma_estado as Decision['firmaEstado'],
    firmaVenceEn: f.firma_vence_en,
    firmaMotivo: f.firma_motivo,
    faltan: Array.isArray(f.faltan) ? f.faltan : [],
    programada: f.programada === true,
    estado: f.estado,
  }
}

const motivoDe = (e: unknown) => (e instanceof Error && e.message ? e.message : 'la consulta falló')

/** Las decisiones visibles, las más recientes primero. Un vacío aquí es un vacío CONFIRMADO. Nunca lanza. */
export async function decisionesCompartidas(limite = 100): Promise<Lectura<Decision[]>> {
  if (!modoNube) return { ok: true, datos: [] }
  try {
    const { data, error } = await supabase()
      .from(VISTA_DECISIONES)
      .select(COLUMNAS_DECISIONES.join(','))
      .order('decidido_en', { ascending: false })
      .order('id', { ascending: true })
      .limit(limite)
    if (error) return { ok: false, error: error.message || 'la consulta falló' }
    if (!Array.isArray(data)) return { ok: false, error: 'la respuesta no trajo filas' }
    const filas = data as unknown as FilaDecision[]
    const datos = filas.map(aDecision).filter((d): d is Decision => d !== null)
    if (datos.length !== filas.length) {
      return { ok: false, error: `${filas.length - datos.length} decisiones con valores que la app no conoce` }
    }
    return { ok: true, datos }
  } catch (e) {
    return { ok: false, error: motivoDe(e) }
  }
}

export interface Companero {
  id: string
  nombre: string
}

/** A quién se le puede pedir la firma: las otras personas con acceso al registro. */
export async function companerosDeDecision(): Promise<Lectura<Companero[]>> {
  if (!modoNube) return { ok: true, datos: [] }
  try {
    const { data, error } = await supabase().rpc(RPC_COMPANEROS)
    if (error) return { ok: false, error: error.message || 'la consulta falló' }
    if (!Array.isArray(data)) return { ok: false, error: 'la respuesta no trajo filas' }
    const datos = (data as { id: string; nombre: string }[]).map((f) => ({ id: f.id, nombre: f.nombre }))
    return { ok: true, datos }
  } catch (e) {
    return { ok: false, error: motivoDe(e) }
  }
}

export interface EntradaDecision {
  area: Area
  palanca: string
  direccion: Direccion
  sujeto: string
  valor?: string | null
  montoCop?: number | null
  periodicidad?: Periodicidad | null
  vigenciaDesde?: string | null
  vigenciaHasta?: string | null
  resumen?: string | null
  notas?: string | null
  referenciaTabla?: string | null
  referenciaId?: string | null
  leTocaA?: 'bryan' | 'manuela' | null
  leTocaQue?: string | null
  leTocaVence?: string | null
  firmaDe?: string | null
  firmaNivel?: 'firma' | 'aviso' | null
  firmaVenceEn?: string | null
}

/** Los argumentos de la RPC, con los nombres de la función. Lo que falta va nulo, nunca inventado. */
export function argumentosDeAnotar(e: EntradaDecision): Record<(typeof PARAMETROS_ANOTAR_DECISION)[number], unknown> {
  return {
    p_area: e.area,
    p_palanca: e.palanca,
    p_direccion: e.direccion,
    p_sujeto: e.sujeto,
    p_valor: e.valor ?? null,
    p_monto_cop: e.montoCop ?? null,
    p_periodicidad: e.periodicidad ?? null,
    p_vigencia_desde: e.vigenciaDesde ?? null,
    p_vigencia_hasta: e.vigenciaHasta ?? null,
    p_resumen: e.resumen ?? null,
    p_notas: e.notas ?? null,
    p_referencia_tabla: e.referenciaTabla ?? null,
    p_referencia_id: e.referenciaId ?? null,
    p_le_toca_a: e.leTocaA ?? null,
    p_le_toca_que: e.leTocaQue ?? null,
    p_le_toca_vence: e.leTocaVence ?? null,
    p_firma_de: e.firmaDe ?? null,
    p_firma_nivel: e.firmaNivel ?? null,
    p_firma_vence_en: e.firmaVenceEn ?? null,
  }
}

export type Escritura = { ok: true; id: string | null } | { ok: false; error: string }

/** Anota una decisión. Si falla, dice que NO quedó anotada: nunca simula el éxito. */
export async function anotarDecision(entrada: EntradaDecision): Promise<Escritura> {
  if (!modoNube) return { ok: false, error: 'sin la nube conectada no se puede anotar' }
  try {
    const { data, error } = await supabase().rpc(RPC_ANOTAR_DECISION, argumentosDeAnotar(entrada))
    if (error) return { ok: false, error: error.message || 'la base rechazó la decisión' }
    return { ok: true, id: typeof data === 'string' ? data : null }
  } catch (e) {
    return { ok: false, error: motivoDe(e) }
  }
}

export type Veredicto = 'firmada' | 'rechazada' | 'visto'

/** Da la firma (solo la persona a quien le toca; la base lo comprueba). */
export async function firmarDecision(id: string, veredicto: Veredicto, motivo?: string): Promise<Escritura> {
  if (!modoNube) return { ok: false, error: 'sin la nube conectada no se puede firmar' }
  try {
    const { error } = await supabase().rpc(RPC_FIRMAR_DECISION, {
      p_id: id,
      p_veredicto: veredicto,
      p_motivo: motivo ?? null,
    })
    if (error) return { ok: false, error: error.message || 'la base rechazó la firma' }
    return { ok: true, id }
  } catch (e) {
    return { ok: false, error: motivoDe(e) }
  }
}
