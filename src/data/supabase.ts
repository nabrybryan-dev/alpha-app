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
    cliente = createClient(url as string, anonKey as string)
  }
  return cliente
}
