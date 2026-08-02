import type { SupabaseClient } from '@supabase/supabase-js'
import { extensionDe } from '../../domain/adjuntos'
import { supabase } from '../supabase'

/**
 * El bucket de los adjuntos del chat. **Privado**, no público: son imágenes de
 * cuerpos, dato de salud. Una URL pública de Storage es un enlace permanente a
 * la foto de alguien, que sigue vivo aunque el mensaje se borre.
 */
export const BUCKET = 'adjuntos-chat'

/** Vida de la URL firmada. Corta a propósito. */
const SEGUNDOS_FIRMA = 3600

/**
 * La primera carpeta es el id de quien sube: la política de INSERT del bucket
 * decide por ese prefijo. El nombre original del archivo no se usa nunca —trae
 * el nombre de la persona o la fecha con demasiada frecuencia—.
 */
export function pathDeAdjunto(deId: string, mensajeId: string, mime: string): string {
  return `${deId}/${mensajeId}.${extensionDe(mime)}`
}

export async function subirAdjunto(
  cliente: SupabaseClient,
  path: string,
  blob: Blob,
): Promise<string> {
  const { error } = await cliente.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: true })
  if (error) throw new Error(error.message)
  return path
}

/**
 * URL para pintar el adjunto. El bucket es privado, así que no hay URL fija que
 * guardar: se firma al mostrarlo y se deja caducar.
 */
export async function urlFirmada(path: string): Promise<string | undefined> {
  const { data } = await supabase().storage.from(BUCKET).createSignedUrl(path, SEGUNDOS_FIRMA)
  return data?.signedUrl
}
