import { franjaEnClaro, leerGuion, type GuionDeVenta } from '../../domain/consolaCoach/guionDeVenta'
import { modoNube, supabase } from '../supabase'

/**
 * El guion de llamada (`guion-llamada-v1`) que deja la landing para cada persona nueva (migración
 * 0151). Lleva el correo y el WhatsApp de la persona: solo lo leen quienes entran a la consola. Solo lectura:
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
  'revision',
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
  /** Milisegundos de `guion.generado_en` (0151): mayor = más reciente. */
  revision: number
  creado_en: string
}

export interface GuionGuardado {
  id: string
  creadoEn: string
  /** YYYY-MM-DD. La columna manda; si viene vacía, la `reserva` del propio guion. */
  diaPreferido: string | null
  /** Ya en claro: «en la tarde». */
  franjaPreferida: string | null
  horaPreferida: string | null
  guion: GuionDeVenta
}

/** Hay fila, pero de una versión del esquema que esta app no sabe pintar: se dice, no se adivina. */
export interface GuionIlegible {
  version: string
}

export type LecturaFila = { tipo: 'guion'; guardado: GuionGuardado } | { tipo: 'ilegible'; ilegible: GuionIlegible } | null

/** Una fila cuyo `guion` ni siquiera es un objeto se descarta (`null`): no hay nada que pintar. */
export function aGuionGuardado(fila: FilaGuionLlamada): LecturaFila {
  const lectura = leerGuion(fila.guion)
  if (!lectura.ok) {
    return lectura.motivo === 'version_desconocida' ? { tipo: 'ilegible', ilegible: { version: lectura.version } } : null
  }
  const guion = lectura.guion
  return {
    tipo: 'guion',
    guardado: {
      id: fila.id,
      creadoEn: fila.creado_en,
      diaPreferido: fila.dia_preferido ?? guion.reserva.fecha,
      // En guion-llamada-v1 la llamada es siempre en la tarde; la columna lo deja escrito.
      franjaPreferida: franjaEnClaro(fila.franja_preferida),
      horaPreferida: guion.reserva.hora,
      guion,
    },
  }
}

export type ResultadoGuion = { ok: true; lectura: LecturaFila } | { ok: false; error: string }

const ERROR_CARGA = 'No se pudo cargar el guion de la llamada.'

/**
 * El guion más reciente (revisión más alta) de una persona. Nunca lanza, y un fallo NO es «no hay
 * guion»: `ok: false` con su texto, para que la pantalla lo diga en vez de callarlo.
 */
export async function guionDe(usuarioId: string): Promise<ResultadoGuion> {
  if (!modoNube || !usuarioId) return { ok: true, lectura: null }
  try {
    const { data, error } = await supabase()
      .from(TABLA_GUIONES_LLAMADA)
      .select(SELECCION)
      .eq('usuario_id', usuarioId)
      .order('revision', { ascending: false })
      .limit(1)
    if (error || !data) return { ok: false, error: ERROR_CARGA }
    const filas = data as unknown as FilaGuionLlamada[]
    return { ok: true, lectura: filas.length ? aGuionGuardado(filas[0]) : null }
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
