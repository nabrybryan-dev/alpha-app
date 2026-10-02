import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const modoNube: boolean = Boolean(url && anonKey)

let cliente: SupabaseClient | undefined

export function supabase(): SupabaseClient {
  if (!modoNube) {
    throw new Error('Supabase no está configurado: la app corre en modo demo')
  }
  if (!cliente) {
    // La sesión se guarda en el navegador y el token se renueva solo: en cada computador se entra UNA vez
    // (cuenta «Alpha», tablero). Es el valor por defecto de supabase-js; se deja escrito para que nadie lo
    // apague sin querer: nunca hay acceso sin login, solo una sesión que no caduca a la hora.
    cliente = createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  }
  return cliente
}

/**
 * Token de sesión y URL del proyecto para llamar a las Edge Functions.
 *
 * Devuelve null en modo demo o mientras no haya sesión iniciada, y nunca lanza:
 * quien la usa (el asistente del chat) es un extra que no puede romper nada si
 * falla.
 */
export async function sesionDeFunciones(): Promise<{ access_token: string; url: string } | null> {
  if (!modoNube) return null
  try {
    const { data } = await supabase().auth.getSession()
    const token = data.session?.access_token
    return token ? { access_token: token, url: url as string } : null
  } catch {
    return null
  }
}
