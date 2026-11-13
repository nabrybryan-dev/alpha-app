import { esNivelAviso, type NivelAviso } from '../../domain/praxis/aviso'
import { modoNube, supabase } from '../supabase'

/**
 * El aviso REAL al coach desde el teléfono (D09, 12-nov-2026): UNA fila en `praxis_avisos_coach` (migración 0108,
 * SIN APLICAR al escribir esto) con la sesión de la persona. La fila lleva `usuario_id`, `origen` y `nivel`: la tabla
 * no tiene columna de texto, y la entrada de esta función tampoco tiene dónde poner la frase.
 *
 * - Sin `.select()`: el trigger de la 0108 descarta en silencio el duplicado de la última hora, y eso cuenta como «el
 *   coach ya estaba avisado» (`ok`).
 * - Nunca lanza y nunca devuelve `ok` sin que la base haya aceptado: sin tabla, `no_disponible`; sin nube, `sin_nube`.
 * - Modelo de forma: `avisarAlCoach` de `supabase/functions/praxis-registro/index.ts` y `preguntasEnEspera.ts`.
 */
export const TABLA_AVISOS_COACH = 'praxis_avisos_coach'

/** Tope de espera: pasado esto se dice la verdad («no pude») en vez de dejar a la persona mirando. */
export const TOPE_AVISO_MS = 3000

export type ResultadoAviso = { ok: true } | { ok: false; motivo: 'sin_nube' | 'nivel' | 'no_disponible' | 'error' }

/** La tabla no existe: Postgres (42P01) o la caché de esquema de PostgREST (PGRST205). */
const noExiste = (codigo: string | undefined) => codigo === '42P01' || codigo === 'PGRST205'

export async function dejarAvisoAlCoach(entrada: { usuarioId: string; nivel: NivelAviso }): Promise<ResultadoAviso> {
  if (!modoNube || !entrada.usuarioId) return { ok: false, motivo: 'sin_nube' }
  if (!esNivelAviso(entrada.nivel)) return { ok: false, motivo: 'nivel' }
  try {
    const escribir = Promise.resolve(
      supabase().from(TABLA_AVISOS_COACH).insert({ usuario_id: entrada.usuarioId, origen: 'praxis', nivel: entrada.nivel }),
    )
    const tiempo = new Promise<'tiempo'>((resolver) => setTimeout(() => resolver('tiempo'), TOPE_AVISO_MS))
    const r = await Promise.race([escribir, tiempo])
    if (r === 'tiempo') return { ok: false, motivo: 'error' }
    if (r.error) return { ok: false, motivo: noExiste(r.error.code) ? 'no_disponible' : 'error' }
    return { ok: true }
  } catch {
    return { ok: false, motivo: 'error' }
  }
}
