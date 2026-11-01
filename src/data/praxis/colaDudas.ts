import { modoNube, supabase } from '../supabase'

/**
 * Lo que el panel de dudas lee y anota con la sesión de la persona. Solo lo usa el equipo: la RLS de la 0117
 * exige `es_staff()` para escribir. Nunca lanza, y `true` solo se devuelve si la base aceptó la fila.
 */

/** El título de la ficha con que Praxis contestó. `null` sin nube o ante cualquier error: la respuesta sale igual. */
export async function tituloDeFicha(id: string): Promise<string | null> {
  if (!modoNube) return null
  try {
    const { data, error } = await supabase().from('fichas_respuesta').select('titulo').eq('id', id).maybeSingle()
    return !error && typeof data?.titulo === 'string' ? data.titulo : null
  } catch {
    return null
  }
}

/** «No era esto»: la frase queda en la cola con la ficha mostrada (migración 0151). */
export async function anotarNoEraEsto(p: { usuarioId: string; frase: string; ficha: string }): Promise<boolean> {
  if (!modoNube) return false
  try {
    const { error } = await supabase().from('praxis_cola_dudas').insert({
      usuario_id: p.usuarioId,
      frase: p.frase,
      origen: 'no_era_esto',
      portero_fichas: { decision: 'atender', ficha: p.ficha, tres_primeras: [] },
    })
    return !error
  } catch {
    return false
  }
}
