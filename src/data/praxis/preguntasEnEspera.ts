import { MAX_ABIERTAS, armarPreguntaEnEspera, type Destinatario } from '../../domain/praxis/enEspera'
import type { QueFalto } from '../../domain/praxis/plan/responder'
import { modoNube, supabase } from '../supabase'

/**
 * La bandeja de «pregunta en espera» de Praxis (migración 0105, SIN APLICAR al escribir esto).
 *
 * Escribe con la sesión de la persona: la RLS deja insertar solo la propia y como mucho dos
 * abiertas. Este módulo arma la pregunta con el dominio (`armarPreguntaEnEspera`, que la
 * rechaza si trae riesgo) ANTES de mandarla.
 *
 * Mientras la migración no esté aplicada, la tabla no existe: eso se devuelve como
 * `no_disponible`, y la pantalla le dice a la persona que todavía no pudo dejar la
 * pregunta. Nunca se devuelve `ok` sin que la base haya aceptado la fila.
 */
export const TABLA_PREGUNTAS_EN_ESPERA = 'praxis_preguntas_en_espera'

export type ResultadoDejarPregunta =
  | { ok: true; destinatario: Destinatario }
  | { ok: false; motivo: 'sin_nube' | 'riesgo' | 'vacia' | 'tope' | 'no_disponible' | 'error' }

/** La tabla no existe: Postgres (42P01) o la caché de esquema de PostgREST (PGRST205). */
const noExiste = (codigo: string | undefined) => codigo === '42P01' || codigo === 'PGRST205'

export async function dejarPreguntaEnEspera(entrada: { usuarioId: string; frase: string; queFalto: QueFalto; citas: string[] }): Promise<ResultadoDejarPregunta> {
  if (!modoNube || !entrada.usuarioId) return { ok: false, motivo: 'sin_nube' }

  // El filtro de riesgo va primero y no depende de la red.
  const previa = armarPreguntaEnEspera({ frase: entrada.frase, queFalto: entrada.queFalto, citas: entrada.citas, abiertas: 0 })
  if (!previa.ok) return { ok: false, motivo: previa.motivo }

  try {
    const { count, error: errorConteo } = await supabase()
      .from(TABLA_PREGUNTAS_EN_ESPERA)
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', entrada.usuarioId)
      .eq('estado', 'abierta')
    if (errorConteo) return { ok: false, motivo: noExiste(errorConteo.code) ? 'no_disponible' : 'error' }
    if ((count ?? 0) >= MAX_ABIERTAS) return { ok: false, motivo: 'tope' }

    const { error } = await supabase()
      .from(TABLA_PREGUNTAS_EN_ESPERA)
      .insert({ usuario_id: entrada.usuarioId, ...previa.pregunta })
    if (error) {
      if (noExiste(error.code)) return { ok: false, motivo: 'no_disponible' }
      // 42501: la política de insert la rechazó. Con la sesión propia, eso es el tope de abiertas.
      if (error.code === '42501') return { ok: false, motivo: 'tope' }
      return { ok: false, motivo: 'error' }
    }
    return { ok: true, destinatario: previa.pregunta.destinatario }
  } catch {
    return { ok: false, motivo: 'error' }
  }
}
