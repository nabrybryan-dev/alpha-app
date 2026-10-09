import { modoNube, supabase } from '../supabase'

/**
 * La bitácora de llamadas del coach con cada asesorado (migración 0112): fecha, hora,
 * conclusiones y próxima reunión. Staff-only por RLS (`es_coach()`) — el asesorado nunca
 * la ve, es la bitácora interna de Manuela, no un mensaje hacia él.
 *
 * El autor (`coach_id`) lo pone la base, nunca este archivo: `default auth.uid()` en la
 * columna más el `with check` de la política de escritura. Mismo criterio que
 * `responder_como_staff` — no se manda ni se confía en lo que diga el cliente.
 */
export const TABLA_NOTAS_LLAMADA = 'notas_llamada'

export const COLUMNAS_NOTAS_LLAMADA = [
  'id',
  'usuario_id',
  'coach_id',
  'fecha',
  'hora',
  'conclusiones',
  'proxima_reunion',
  'creado_en',
] as const

const SELECCION_NOTAS_LLAMADA = COLUMNAS_NOTAS_LLAMADA.join(',')

/** La fila tal como baja de Supabase. */
export interface FilaNotaLlamada {
  id: string
  usuario_id: string
  coach_id: string
  fecha: string
  hora: string | null
  conclusiones: string
  proxima_reunion: string | null
  creado_en: string
}

/** La misma fila, en el vocabulario del dominio. */
export interface NotaLlamada {
  id: string
  usuarioId: string
  coachId: string
  fecha: string
  hora: string | null
  conclusiones: string
  proximaReunion: string | null
  creadoEn: string
}

function aNotaLlamada(fila: FilaNotaLlamada): NotaLlamada {
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    coachId: fila.coach_id,
    fecha: fila.fecha,
    hora: fila.hora,
    conclusiones: fila.conclusiones,
    proximaReunion: fila.proxima_reunion,
    creadoEn: fila.creado_en,
  }
}

/**
 * Las notas de llamada de un asesorado, más reciente primero. Nunca lanza: sin conexión,
 * sin permiso o ante cualquier error de la base, `[]` — mismo criterio que
 * `casosFirmaDePersona`.
 */
export async function notasLlamadaDe(usuarioId: string): Promise<NotaLlamada[]> {
  if (!modoNube || !usuarioId) return []
  try {
    const { data, error } = await supabase()
      .from(TABLA_NOTAS_LLAMADA)
      .select(SELECCION_NOTAS_LLAMADA)
      .eq('usuario_id', usuarioId)
      .order('fecha', { ascending: false })
      .order('creado_en', { ascending: false })
    if (error || !data) return []
    return (data as unknown as FilaNotaLlamada[]).map(aNotaLlamada)
  } catch {
    return []
  }
}

export interface NuevaNotaLlamada {
  fecha: string
  /** `HH:MM`, opcional: a veces Manuela solo quiere dejar el día. */
  hora?: string
  conclusiones: string
  proximaReunion?: string
}

export type ResultadoAgregarNota = { ok: true; nota: NotaLlamada } | { ok: false; error: string }

const CODIGO_SIN_PERMISO = '42501'

function mensajeDeError(error: { code?: string; message: string }): string {
  if (error.code === CODIGO_SIN_PERMISO) return 'No tienes permiso para anotar llamadas de este asesorado.'
  return error.message || 'No se pudo guardar la nota. Vuelve a intentarlo.'
}

/**
 * Anota una llamada. `coach_id` NO se manda: lo pone la columna (`default auth.uid()`),
 * así que ni siquiera hay con qué intentar falsearlo desde aquí.
 */
export async function agregarNotaLlamada(
  usuarioId: string,
  nota: NuevaNotaLlamada,
): Promise<ResultadoAgregarNota> {
  if (!modoNube) return { ok: false, error: 'Sin conexión con la base: esto es un demo.' }
  if (!nota.conclusiones.trim()) return { ok: false, error: 'Escribe qué se habló en la llamada.' }
  try {
    const { data, error } = await supabase()
      .from(TABLA_NOTAS_LLAMADA)
      .insert({
        usuario_id: usuarioId,
        fecha: nota.fecha,
        hora: nota.hora || null,
        conclusiones: nota.conclusiones.trim(),
        proxima_reunion: nota.proximaReunion?.trim() || null,
      })
      .select(SELECCION_NOTAS_LLAMADA)
      .single()
    if (error || !data) return { ok: false, error: mensajeDeError(error ?? { message: '' }) }
    return { ok: true, nota: aNotaLlamada(data as unknown as FilaNotaLlamada) }
  } catch (fallo) {
    return { ok: false, error: fallo instanceof Error ? fallo.message : 'Error de red.' }
  }
}
