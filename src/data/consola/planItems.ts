import {
  esDueno,
  esEstadoPlan,
  esNivel,
  esPalanca,
  esPrioridad,
  type Dueno,
  type EstadoPlan,
  type ItemPlan,
  type Nivel,
  type Palanca,
  type Prioridad,
} from '../../domain/planOrganizador'
import { modoNube, supabase } from '../supabase'
import type { Lectura } from './creadores'

/**
 * Organizador de Bryan y Manuela (migración 0098): lectura y escritura de `plan_items`.
 *
 * La base decide quién ve qué: el coach lee todo, Manuela solo lo suyo (RLS), y cada quien
 * escribe solo filas de su dueño. Aquí no se filtra por dueño para "proteger": se filtra para
 * MOSTRAR (Bryan ve la carga de Manuela aparte, en solo lectura). El navegador no borra
 * (sin privilegio de delete): descartar es un estado.
 *
 * Las columnas salen de aquí y las pruebas las comparan contra el SQL de la 0098.
 */
export const TABLA_PLAN_ITEMS = 'plan_items'

export const COLUMNAS_PLAN_ITEMS = [
  'id',
  'nivel',
  'padre_id',
  'titulo',
  'primer_paso',
  'dueno',
  'palanca',
  'fecha',
  'estimado_min',
  'prioridad',
  'estado',
  'iniciada_en',
  'hecha_en',
  'veces_movida',
  'origen',
  'actualizado_en',
] as const

/** Las columnas que el navegador puede cambiar (`grant update`) y las que puede fijar al crear. */
export const COLUMNAS_EDITABLES = [
  'titulo',
  'primer_paso',
  'palanca',
  'fecha',
  'estimado_min',
  'prioridad',
  'estado',
  'iniciada_en',
  'hecha_en',
  'veces_movida',
] as const

export interface FilaPlanItem {
  id: string
  nivel: string
  padre_id: string | null
  titulo: string
  primer_paso: string | null
  dueno: string
  palanca: string | null
  fecha: string | null
  estimado_min: number | null
  prioridad: string | null
  estado: string
  iniciada_en: string | null
  hecha_en: string | null
  veces_movida: number
  origen: string | null
  actualizado_en: string
}

/** Una fila con un valor que la app no conoce NO se descarta en silencio: `null` y la lectura lo avisa. */
export function aItemPlan(f: FilaPlanItem): ItemPlan | null {
  if (!esNivel(f.nivel) || !esDueno(f.dueno) || !esEstadoPlan(f.estado)) return null
  if (f.palanca !== null && !esPalanca(f.palanca)) return null
  if (f.prioridad !== null && !esPrioridad(f.prioridad)) return null
  return {
    id: f.id,
    nivel: f.nivel as Nivel,
    padreId: f.padre_id,
    titulo: f.titulo,
    primerPaso: f.primer_paso,
    dueno: f.dueno as Dueno,
    palanca: f.palanca as Palanca | null,
    fecha: f.fecha,
    estimadoMin: f.estimado_min,
    prioridad: f.prioridad as Prioridad | null,
    estado: f.estado as EstadoPlan,
    iniciadaEn: f.iniciada_en,
    hechaEn: f.hecha_en,
    vecesMovida: Number.isFinite(f.veces_movida) ? f.veces_movida : 0,
    origen: f.origen,
    actualizadoEn: f.actualizado_en,
  }
}

const motivoDe = (e: unknown) => (e instanceof Error && e.message ? e.message : 'la consulta falló')

/** Todo lo que la base deja ver a quien pregunta. Un vacío aquí es un vacío CONFIRMADO. Nunca lanza. */
export async function planItems(limite = 1000): Promise<Lectura<ItemPlan[]>> {
  if (!modoNube) return { ok: true, datos: [] }
  try {
    const { data, error } = await supabase()
      .from(TABLA_PLAN_ITEMS)
      .select(COLUMNAS_PLAN_ITEMS.join(','))
      .order('fecha', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .limit(limite)
    if (error) return { ok: false, error: error.message || 'la consulta falló' }
    if (!Array.isArray(data)) return { ok: false, error: 'la respuesta no trajo filas' }
    const filas = data as unknown as FilaPlanItem[]
    const datos = filas.map(aItemPlan).filter((i): i is ItemPlan => i !== null)
    if (datos.length !== filas.length) {
      return { ok: false, error: `${filas.length - datos.length} filas del plan con valores que la app no conoce` }
    }
    return { ok: true, datos }
  } catch (e) {
    return { ok: false, error: motivoDe(e) }
  }
}

export type Escritura = { ok: true; id: string | null } | { ok: false; error: string }

export interface EntradaTareaNueva {
  padreId: string
  titulo: string
  primerPaso: string
  dueno: Dueno
  palanca?: Palanca | null
  fecha: string | null
  estimadoMin: number
  prioridad: Prioridad
}

/** Crea una tarea. Si la base la rechaza (cupo, principal repetida…), lo dice: nunca simula el éxito. */
export async function crearTarea(e: EntradaTareaNueva): Promise<Escritura> {
  if (!modoNube) return { ok: false, error: 'sin la nube conectada no se puede guardar' }
  try {
    const { data, error } = await supabase()
      .from(TABLA_PLAN_ITEMS)
      .insert({
        nivel: 'tarea',
        padre_id: e.padreId,
        titulo: e.titulo.trim(),
        primer_paso: e.primerPaso.trim(),
        dueno: e.dueno,
        palanca: e.palanca ?? null,
        fecha: e.fecha,
        estimado_min: e.estimadoMin,
        prioridad: e.prioridad,
        origen: 'app: Mi plan',
      })
      .select('id')
    if (error) return { ok: false, error: error.message || 'la base rechazó la tarea' }
    const id = Array.isArray(data) && data[0] ? String((data[0] as { id: string }).id) : null
    return { ok: true, id }
  } catch (err) {
    return { ok: false, error: motivoDe(err) }
  }
}

/**
 * Cambios sobre una fila existente. `.select('id')` devuelve las filas que SÍ cambiaron: RLS
 * responde «cero filas» (sin error) cuando la fila no es tuya, y eso no es un éxito.
 */
async function cambiar(id: string, cambios: Record<string, unknown>): Promise<Escritura> {
  if (!modoNube) return { ok: false, error: 'sin la nube conectada no se puede guardar' }
  try {
    const { data, error } = await supabase().from(TABLA_PLAN_ITEMS).update(cambios).eq('id', id).select('id')
    if (error) return { ok: false, error: error.message || 'la base rechazó el cambio' }
    if (!Array.isArray(data) || data.length === 0) return { ok: false, error: 'no se guardó: esa fila no es tuya o ya no existe' }
    return { ok: true, id }
  } catch (err) {
    return { ok: false, error: motivoDe(err) }
  }
}

export const empezarTarea = (id: string, ahoraIso: string = new Date().toISOString()) =>
  cambiar(id, { estado: 'en_curso', iniciada_en: ahoraIso })

export const terminarTarea = (id: string, ahoraIso: string = new Date().toISOString()) =>
  cambiar(id, { estado: 'hecha', hecha_en: ahoraIso })

/** Deshace «hecha» (un toque por error): vuelve a pendiente y borra la hora de hecha. */
export const reabrirTarea = (id: string) => cambiar(id, { estado: 'pendiente', hecha_en: null })

/** Mueve la tarea a otro día (o a «después» con `null`) y cuenta la movida. */
export const moverTarea = (id: string, fecha: string | null, vecesMovidaActual: number) =>
  cambiar(id, { fecha, estado: 'pendiente', iniciada_en: null, veces_movida: vecesMovidaActual + 1 })

export const descartarTarea = (id: string) => cambiar(id, { estado: 'descartada' })
