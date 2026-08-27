import type { SupabaseClient } from '@supabase/supabase-js'
import { extensionDe } from '../../domain/adjuntos'
import { epocaSesion } from '../mockDb'
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
 * Cuánto se reutiliza una firma. Por debajo de `SEGUNDOS_FIRMA` a propósito:
 * una URL que caduca mientras el `<img>` la está cargando se ve como una foto
 * rota, y el margen de diez minutos evita esa carrera.
 */
const VIDA_CACHE_MS = 50 * 60_000

/**
 * Firmas ya pedidas, SOLO en memoria.
 *
 * Nunca en `localStorage`: una URL firmada es un enlace vivo a la foto del
 * cuerpo de alguien, y escribirla en disco la deja sobrevivir al cierre de
 * sesión y al navegador. En memoria muere con la pestaña.
 */
const firmadas = new Map<string, { url: string; expira: number }>()

/** Peticiones en curso, para no firmar dos veces el mismo adjunto a la vez. */
const enVuelo = new Map<string, Promise<string | undefined>>()

/**
 * La época con la que se llenó la caché. `olvidarDatosLocales` la sube al
 * cerrar sesión, así que comparar aquí basta para no reutilizar JAMÁS una firma
 * de quien acaba de salir.
 *
 * Se comprueba dentro de `urlFirmada` y no desde el cierre de sesión por lo
 * mismo que documenta `olvidarDatosLocales`: una limpieza que hay que acordarse
 * de llamar desde fuera es una limpieza que algún día no se llama.
 */
let epocaDeLaCache = epocaSesion()

/**
 * URL para pintar el adjunto. El bucket es privado, así que no hay URL fija que
 * guardar: se firma al mostrarlo y se deja caducar.
 *
 * Se reutiliza la firma mientras siga viva. Antes se pedía una nueva en cada
 * montaje del componente, así que abrir un chat con diez fotos y volver atrás
 * eran veinte llamadas de red para veinte URLs equivalentes.
 */
export async function urlFirmada(path: string): Promise<string | undefined> {
  const epoca = epocaSesion()
  if (epoca !== epocaDeLaCache) {
    firmadas.clear()
    enVuelo.clear()
    epocaDeLaCache = epoca
  }

  const ahora = Date.now()
  const guardada = firmadas.get(path)
  if (guardada && guardada.expira > ahora) return guardada.url

  const yaPedida = enVuelo.get(path)
  if (yaPedida) return yaPedida

  const peticion = supabase()
    .storage.from(BUCKET)
    .createSignedUrl(path, SEGUNDOS_FIRMA)
    .then(({ data }) => {
      const url = data?.signedUrl
      // Solo se guarda lo que salió bien: cachear el fallo dejaría el adjunto
      // roto durante cincuenta minutos por un corte de red de un segundo.
      if (url && epocaSesion() === epocaDeLaCache) {
        firmadas.set(path, { url, expira: Date.now() + VIDA_CACHE_MS })
      }
      return url
    })
    .finally(() => {
      enVuelo.delete(path)
    })

  enVuelo.set(path, peticion)
  return peticion
}
