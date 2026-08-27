/**
 * Acceso a Supabase del panel de consultas del coach.
 *
 * Aquí vive todo lo que habla con la nube: traer la cola de preguntas con sus
 * etiquetas y marcar una consulta como revisada o corregida. La vista
 * (`ConsultasPage.tsx`) se queda con la pantalla y el estado de React, y lo que
 * decide qué merece la atención de Bryan sigue en `consultas.ts`.
 */

import { supabase } from '../../data/supabase'
import type { Consulta, ViaConsulta } from './consultas'

/** Ventana de trabajo. Esto es una cola para resolver, no un archivo histórico. */
const LIMITE = 100

const VIAS: ViaConsulta[] = ['ficha', 'ficha_tentativa', 'ia_vivo', 'escalado']

/** Fila de `consultas_chat` tal como llega de Supabase. */
export interface FilaConsulta {
  id: string
  usuario_id: string
  mensaje: string
  ficha_id: string | null
  similitud: number | null
  via: string
  bandera_roja: boolean
  revisado: boolean
  corregido: boolean
  creado_en: string
}

/**
 * Fila de Supabase → modelo de la app.
 *
 * `via` se valida aunque la tabla tenga un CHECK: si algún día entrara un
 * valor nuevo, cae en 'escalado', que lo manda al grupo "requiere tu criterio".
 * El sesgo es que el coach lo vea de más, nunca que se pierda de vista.
 */
export function aConsulta(f: FilaConsulta): Consulta {
  return {
    id: f.id,
    usuarioId: f.usuario_id,
    mensaje: f.mensaje,
    similitud: f.similitud === null ? null : Number(f.similitud),
    fichaId: f.ficha_id,
    via: VIAS.includes(f.via as ViaConsulta) ? (f.via as ViaConsulta) : 'escalado',
    banderaRoja: Boolean(f.bandera_roja),
    revisado: Boolean(f.revisado),
    corregido: Boolean(f.corregido),
    creadoEn: f.creado_en,
  }
}

export interface Datos {
  consultas: Consulta[]
  /** usuarioId → nombre. */
  nombres: Record<string, string>
  /** fichaId → título. */
  titulos: Record<string, string>
}

/**
 * Lee directo de Supabase, sin pasar por el almacén local: esta vista es solo
 * del coach, se mira con conexión y siempre quiere el dato más fresco.
 *
 * Los nombres y los títulos van en consultas aparte y no como embed
 * (`select=*,usuarios_app(nombre)`) a propósito: si una de las dos fallara,
 * las preguntas se siguen viendo con una etiqueta de reserva. Un embed las
 * tumbaría todas por un adorno.
 */
export async function leerConsultas(): Promise<Datos> {
  const sb = supabase()

  const { data, error } = await sb
    .from('consultas_chat')
    .select('id,usuario_id,mensaje,ficha_id,similitud,via,bandera_roja,revisado,corregido,creado_en')
    .order('creado_en', { ascending: false })
    .limit(LIMITE)
  if (error) throw new Error(error.message)

  const consultas = (data ?? []).map((f) => aConsulta(f as FilaConsulta))

  const [usuarios, fichas] = await Promise.all([
    sb.from('usuarios_app').select('id,nombre'),
    sb.from('fichas_respuesta').select('id,titulo'),
  ])

  const nombres: Record<string, string> = {}
  for (const u of usuarios.data ?? []) nombres[u.id as string] = u.nombre as string

  const titulos: Record<string, string> = {}
  for (const f of fichas.data ?? []) titulos[f.id as string] = f.titulo as string

  return { consultas, nombres, titulos }
}

interface Marca {
  revisado: boolean
  corregido?: boolean
}

/**
 * Marca la fila y devuelve lo que Supabase confirmó haber guardado.
 *
 * El `.select()` no es adorno: un UPDATE que RLS descarta NO devuelve error,
 * devuelve cero filas. Sin comprobar que volvió la fila, la pantalla diría
 * "revisado" de algo que la base nunca guardó.
 */
async function marcarEnSupabase(id: string, campos: Marca): Promise<Consulta> {
  const { data, error } = await supabase()
    .from('consultas_chat')
    .update(campos)
    .eq('id', id)
    .select()
  if (error) throw new Error(error.message)

  const fila = (data ?? [])[0]
  if (!fila) throw new Error('Supabase no confirmó el cambio. Revisa que tu sesión siga abierta.')
  return aConsulta(fila as FilaConsulta)
}

/** El coach ya la vio y le parece bien lo que contestó Alpha. */
export function marcarRevisada(id: string): Promise<Consulta> {
  return marcarEnSupabase(id, { revisado: true })
}

/**
 * "Esto no es lo que yo habría dicho": queda anotada para reescribir la ficha.
 * Va siempre con `revisado`, porque corregirla implica haberla visto.
 */
export function marcarCorregida(id: string): Promise<Consulta> {
  return marcarEnSupabase(id, { revisado: true, corregido: true })
}
