import { idDeYoutube } from './youtube'

/**
 * Un vídeo que no es de YouTube se reproduce directo: es un archivo (`.mp4`, `.mov`)
 * alojado en el almacenamiento del proyecto.
 *
 * Hasta el 2026-09-07 el visor solo sabía de YouTube, y un vídeo de la casa no tenía
 * forma de entrar en la biblioteca: 14 categorías de la cartera se quedaban sin
 * demostración teniendo grabaciones en el gimnasio. Se reconoce por la URL, no por un
 * campo nuevo, para que las fichas ya guardadas sigan valiendo tal cual.
 */
export function esVideoDirecto(url: string | undefined): boolean {
  if (!url || idDeYoutube(url)) return false
  try {
    const u = new URL(url)
    return (u.protocol === 'https:' || u.protocol === 'http:') && /\.(mp4|mov|m4v|webm)$/i.test(u.pathname)
  } catch {
    return false
  }
}
