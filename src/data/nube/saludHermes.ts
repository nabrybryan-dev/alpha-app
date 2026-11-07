import { modoNube, supabase } from '../supabase'
import type { FilaSaludHermes } from '../../domain/saludHermes'

/**
 * Lee la salud de Hermes (0152). Solo el puesto de coach ve filas (RLS). Devuelve null en modo
 * demo (no hay minipc que vigilar) y LANZA si la lectura falla: «no pude leer» no es «no hay señal»,
 * y quien llama las pinta distinto.
 */
export async function traerSaludHermes(): Promise<FilaSaludHermes[] | null> {
  if (!modoNube) return null
  const { data, error } = await supabase().from('salud_hermes').select('pieza, estado, visto_en')
  if (error) throw new Error(error.message)
  return (data ?? []).map((f: { pieza: string; estado: string; visto_en: string }) => ({
    pieza: f.pieza,
    estado: f.estado,
    vistoEn: f.visto_en,
  }))
}
