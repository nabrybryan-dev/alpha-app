import { franjaEnClaro, leerGuion, type GuionDeVenta } from '../../domain/consolaCoach/guionDeVenta'
import { modoNube, supabase } from '../supabase'

/**
 * El guion de llamada que deja la landing para cada persona nueva (migración 0151). Solo lectura:
 * lo escribe la Edge Function `guion-llamada` con service role; el navegador no tiene privilegio
 * de escritura.
 *
 * La puerta es la de las notas de llamada (0113): `es_coach()` o la capacidad
 * `leer_entrenamiento`. Bajo RLS, quien no pasa no recibe un error sino cero filas: para esta
 * pantalla eso se ve igual que «todavía no hay guion», y es lo correcto (quien no entra a la
 * consola tampoco llega aquí).
 *
 * `COLUMNAS_GUIONES_LLAMADA` es la misma lista que el `create table` de la 0151; la prueba de
 * contrato la compara contra el SQL.
 */
export const TABLA_GUIONES_LLAMADA = 'guiones_llamada'

export const COLUMNAS_GUIONES_LLAMADA = [
  'id',
  'usuario_id',
  'origen',
  'guion',
  'dia_preferido',
  'franja_preferida',
  'version',
  'creado_en',
] as const

const SELECCION = COLUMNAS_GUIONES_LLAMADA.join(',')

export interface FilaGuionLlamada {
  id: string
  usuario_id: string
  origen: string
  guion: unknown
  dia_preferido: string | null
  franja_preferida: string | null
  version: number
  creado_en: string
}

export interface GuionGuardado {
  id: string
  version: number
  origen: string
  creadoEn: string
  /** YYYY-MM-DD. La columna manda; si viene vacía, lo que diga el propio guion. */
  diaPreferido: string | null
  /** Ya en claro: «en la tarde». */
  franjaPreferida: string | null
  horaPreferida: string | null
  guion: GuionDeVenta
}

/** Una fila cuyo `guion` ni siquiera es un objeto se descarta: no hay nada que pintar. */
export function aGuionGuardado(fila: FilaGuionLlamada): GuionGuardado | null {
  const guion = leerGuion(fila.guion)
  if (!guion) return null
  return {
    id: fila.id,
    version: fila.version,
    origen: fila.origen,
    creadoEn: fila.creado_en,
    diaPreferido: fila.dia_preferido ?? guion.preferencia.dia,
    franjaPreferida: franjaEnClaro(fila.franja_preferida ?? guion.preferencia.franja),
    horaPreferida: guion.preferencia.hora,
    guion,
  }
}

export type ResultadoGuion = { ok: true; guion: GuionGuardado | null } | { ok: false; error: string }

const ERROR_CARGA = 'No se pudo cargar el guion de la llamada.'

/**
 * El guion más reciente (versión más alta) de una persona. Nunca lanza, y un fallo NO es «no hay
 * guion»: `ok: false` con su texto, para que la pantalla lo diga en vez de callarlo.
 */
export async function guionDe(usuarioId: string): Promise<ResultadoGuion> {
  if (!modoNube || !usuarioId) return { ok: true, guion: null }
  try {
    const { data, error } = await supabase()
      .from(TABLA_GUIONES_LLAMADA)
      .select(SELECCION)
      .eq('usuario_id', usuarioId)
      .order('version', { ascending: false })
      .limit(1)
    if (error || !data) return { ok: false, error: ERROR_CARGA }
    const filas = data as unknown as FilaGuionLlamada[]
    return { ok: true, guion: filas.length ? aGuionGuardado(filas[0]) : null }
  } catch {
    return { ok: false, error: ERROR_CARGA }
  }
}

export type ResultadoConGuion = { ok: true; usuarios: Set<string> } | { ok: false; error: string }

/**
 * De una lista de personas, cuáles ya tienen guion (para la marca «Guion listo» de la bandeja de
 * primeros planes). Una consulta para toda la lista, no una por fila.
 */
export async function usuariosConGuion(usuarioIds: readonly string[]): Promise<ResultadoConGuion> {
  if (!modoNube || usuarioIds.length === 0) return { ok: true, usuarios: new Set() }
  try {
    const { data, error } = await supabase()
      .from(TABLA_GUIONES_LLAMADA)
      .select('usuario_id')
      .in('usuario_id', [...usuarioIds])
    if (error || !data) return { ok: false, error: ERROR_CARGA }
    return { ok: true, usuarios: new Set((data as { usuario_id: string }[]).map((f) => f.usuario_id)) }
  } catch {
    return { ok: false, error: ERROR_CARGA }
  }
}
