import { modoNube, supabase } from '../supabase'

/**
 * Los avisos del candado de microciclos (migración 0147, SIN APLICAR al escribir esto).
 *
 * Decisión de Bryan (28-oct-2026): si la cadena de agentes ya cargó o activó la semana de una persona,
 * la app no la pisa: la base lo impide, deja un aviso con quién la cargó y cuándo, y no se hace nada
 * sin una confirmación explícita del coach. Este archivo solo LEE los avisos y manda las dos decisiones
 * (confirmar o descartar); la regla vive en la base (`microciclo_choque`), no aquí.
 */
export const TABLA_CHOQUES_MICROCICLO = 'microciclos_choques'
export const RPC_CONFIRMAR_PISAR = 'confirmar_pisar_microciclo'
export const RPC_DESCARTAR_CHOQUE = 'descartar_choque_microciclo'

export interface ChoqueMicrociclo {
  id: string
  usuarioId: string
  /** La propuesta de la app que NO se activó. */
  propuestaId: string
  propuestaNumero: number
  /** La semana que ya estaba: su número, quién la cargó y cuándo. */
  existenteNumero: number
  existenteOrigen: 'cadena' | 'app'
  existenteEn: string
}

interface FilaChoque {
  id: string
  usuario_id: string
  propuesta_id: string
  propuesta_numero: number
  existente_numero: number
  existente_origen: 'cadena' | 'app'
  existente_en: string | null
}

export type ResultadoChoques = { ok: true; choques: ChoqueMicrociclo[] } | { ok: false; error: string }
export type ResultadoDecision = { ok: true } | { ok: false; error: string }

const ERROR_CARGA = 'No se pudieron leer los avisos de microciclos. Vuelve a intentarlo.'
const ERROR_DECISION = 'No se pudo guardar tu decisión. Vuelve a intentarlo.'

const SELECCION = 'id,usuario_id,propuesta_id,propuesta_numero,existente_numero,existente_origen,existente_en'

/** Los avisos pendientes. En modo demo no hay base a la que preguntar: lista vacía. */
export async function choquesPendientes(): Promise<ResultadoChoques> {
  if (!modoNube) return { ok: true, choques: [] }
  try {
    const { data, error } = await supabase()
      .from(TABLA_CHOQUES_MICROCICLO)
      .select(SELECCION)
      .eq('estado', 'pendiente')
      .order('creado_en', { ascending: true })
    if (error || !data) return { ok: false, error: ERROR_CARGA }
    return {
      ok: true,
      choques: (data as unknown as FilaChoque[]).map((f) => ({
        id: f.id,
        usuarioId: f.usuario_id,
        propuestaId: f.propuesta_id,
        propuestaNumero: f.propuesta_numero,
        existenteNumero: f.existente_numero,
        existenteOrigen: f.existente_origen,
        existenteEn: f.existente_en ?? '',
      })),
    }
  } catch {
    return { ok: false, error: ERROR_CARGA }
  }
}

async function llamar(fn: string, args: Record<string, string>): Promise<ResultadoDecision> {
  if (!modoNube) return { ok: false, error: ERROR_DECISION }
  try {
    const { error } = await supabase().rpc(fn, args)
    return error ? { ok: false, error: ERROR_DECISION } : { ok: true }
  } catch {
    return { ok: false, error: ERROR_DECISION }
  }
}

/** El coach decide pisar la semana que ya estaba: la base activa la propuesta y cierra el aviso. */
export const confirmarPisar = (propuestaId: string) =>
  llamar(RPC_CONFIRMAR_PISAR, { p_propuesta_id: propuestaId })

/** El coach decide dejar la semana que ya estaba: el aviso se cierra y la propuesta queda sin activar. */
export const descartarChoque = (choqueId: string) =>
  llamar(RPC_DESCARTAR_CHOQUE, { p_choque_id: choqueId })

/** La frase que ve el coach: quién la cargó, cuándo, y que la app no hizo nada. */
export function textoChoque(choque: ChoqueMicrociclo, nombre: string): string {
  const quien = choque.existenteOrigen === 'cadena' ? 'la cadena de agentes' : 'la app'
  const cuando = choque.existenteEn ? ` el ${choque.existenteEn.slice(0, 10)}` : ''
  return `${nombre}: ${quien} ya cargó su M${choque.existenteNumero}${cuando}. La propuesta M${choque.propuestaNumero} de la app no se activó.`
}
