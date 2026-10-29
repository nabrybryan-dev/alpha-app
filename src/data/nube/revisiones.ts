import { modoNube, supabase } from '../supabase'
import { semanasDeFirma, type FilaDeRevision } from '../../domain/aprobacion/historial'
import type { SemanaDeFirma } from '../../domain/aprobacion/puerta'

export interface RevisionPendiente {
  usuario_id: string
  semana: string
  path: string
  guion: string
  tipo: 'audio' | 'video'
  version: number
  correccion_solicitada: string | null
}

export async function revisionesPendientes(): Promise<RevisionPendiente[]> {
  if (!modoNube) throw new Error('La bandeja necesita conexión con Alpha.')
  const { data, error } = await supabase().from('videos_semanales')
    .select('usuario_id, semana, path, guion, tipo, version, correccion_solicitada')
    .is('aprobado_en', null).order('semana', { ascending: false })
  if (error) throw new Error(`No se pudieron cargar las revisiones: ${error.message}`)
  return (data ?? []) as RevisionPendiente[]
}

export async function reproducirRevision(revision: RevisionPendiente): Promise<string> {
  const { data, error } = await supabase().storage.from('medios-app').createSignedUrl(revision.path, 3600)
  if (error || !data?.signedUrl) throw new Error('No se pudo abrir el archivo. Vuelve a intentarlo.')
  return data.signedUrl
}

export async function decidirRevision(revision: RevisionPendiente, aprobar: boolean, correccion?: string): Promise<void> {
  const { error } = await supabase().rpc('decidir_revision_semanal', {
    p_usuario: revision.usuario_id, p_semana: revision.semana, p_version: revision.version,
    p_aprobar: aprobar, p_correccion: correccion ?? null,
  })
  if (error) throw new Error(error.message)
}

/** Las semanas de firma de QUIEN ESTÁ CONECTADO, para calcular su puerta. */
export async function historialDeFirma(): Promise<SemanaDeFirma[]> {
  if (!modoNube) throw new Error('La puerta necesita conexión con Alpha.')
  const { data: sesion } = await supabase().auth.getUser()
  const uid = sesion.user?.id
  if (!uid) throw new Error('No hay sesión para calcular la puerta.')
  const { data, error } = await supabase().from('videos_semanales')
    .select('semana, aprobado_en, aprobado_por, correccion_solicitada, version')
    .order('semana', { ascending: true })
  if (error) throw new Error(`No se pudo cargar el historial de firma: ${error.message}`)
  return semanasDeFirma((data ?? []) as FilaDeRevision[], uid)
}
