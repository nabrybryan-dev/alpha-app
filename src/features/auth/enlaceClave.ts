/**
 * Código del enlace para crear contraseña (`/#crear-clave=<código>`). Va tras el `#` para que
 * no llegue a ningún servidor ni a los registros del sitio. Solo acepta el formato hexadecimal
 * que emite Supabase; cualquier otra cosa no es un enlace de este tipo.
 */
export function tokenDeCrearClave(hash: string): string | null {
  return /^#crear-clave=([0-9a-f]+)$/.exec(hash)?.[1] ?? null
}
