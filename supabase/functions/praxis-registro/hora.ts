// La hora de la persona y el `sub` del JWT (sacados de index.ts, que se re-exporta: sin cambios de comportamiento).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * El `sub` del JWT, SIN comprobar la firma: eso ya lo hizo el gateway de Supabase (`verify_jwt`)
 * antes de entrar aquí. Solo sirve para ADELANTAR las lecturas del rol y del plan en paralelo
 * con la validación del token. No decide nada: la respuesta sigue dependiendo de que
 * `/auth/v1/user` diga que sí y devuelva este mismo id. `null` si el token no se puede leer o
 * el `sub` no es un uuid (entra en la URL de una consulta); entonces se espera a Auth.
 */
export function subDelJwt(token: string): string | null {
  const partes = token.split('.')
  if (partes.length !== 3) return null
  try {
    const b64 = partes[1].replace(/-/g, '+').replace(/_/g, '/')
    const texto = new TextDecoder().decode(Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0)))
    const sub = (JSON.parse(texto) as { sub?: unknown } | null)?.sub
    return typeof sub === 'string' && UUID.test(sub) ? sub : null
  } catch {
    return null
  }
}

/** `2026-09-28T18:40:00-05:00` en hora de Bogotá, si el teléfono no mandó la suya. */
export function horaBogota(ahora: Date): string {
  return new Date(ahora.getTime() - 5 * 3_600_000).toISOString().slice(0, 19) + '-05:00'
}

/** La forma ENTERA de la hora: fecha, hora, segundos opcionales y zona. Nada detrás. */
const HORA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$/

/**
 * La hora del teléfono, si se puede creer; si no, la del servidor en Bogotá. Se cree solo si
 * tiene la forma exacta, no pasa de 25 caracteres y cae a menos de un día de la del
 * servidor. Antes valía cualquier texto que EMPEZARA como una fecha: lo de detrás viajaba
 * al modelo como `hora_local` y se grababa como `hechoEn` (revisión del PR #331, M3).
 */
export function horaConfiable(h: unknown, ahora: Date): string {
  const servidor = horaBogota(ahora)
  if (typeof h !== 'string' || h.length > 25 || !HORA_ISO.test(h)) return servidor
  const t = Date.parse(h)
  if (!Number.isFinite(t) || Math.abs(t - ahora.getTime()) > 86_400_000) return servidor
  return h
}
