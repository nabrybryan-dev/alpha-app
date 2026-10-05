import type { SupabaseClient } from '@supabase/supabase-js'
export const BUCKET: string
export const PORQUE: Record<string, string>
export function publicarUnaRevision(datos: {
  supabase: SupabaseClient | null
  usuarioId: string
  semana: string
  archivo: string
  guion: string
  forzar?: boolean
  caraSobreVozFirmada?: boolean
  ensayo?: boolean
}): Promise<{ publicado: boolean; ensayo?: boolean; path?: string; reemplaza?: boolean; quitaFirma?: boolean; motivo?: string; tamanoBytes?: number }>
