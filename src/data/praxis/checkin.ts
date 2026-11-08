import { db } from '../dbInstance'
import { reportarError } from '../errores/reportarError'
import { modoNube, supabase } from '../supabase'
import { CAMPOS_QUE_APRENDEN, type FormaAprendida } from '../../domain/praxis/registro/lexicoPersona'
import { OBLIGATORIOS, type Confirmado } from '../../domain/praxis/registro/tarjetaCheckin'
import type { Anotacion } from '../../domain/praxis/registro/anotaciones'
import type { CampoCheckin } from '../../domain/praxis/registro/mensajeLargo'
import type { CheckinDiario } from '../../domain/types'

/**
 * El check-in que Praxis arma desde lo que la persona cuenta (conectores), lado datos. Detrás de `CONECTORES_EN_TARJETA`.
 *
 *   guardarCheckinDePraxis → RPC `praxis_aplicar_checkin` (0170): solo lo que la persona tocó, una vez por tarjeta, y la
 *                            app FIJA la fila que devuelve la base (como el agua): sin eso el sync subiría su copia vieja.
 *   aprender               → RPC `praxis_aprender_forma` (0171) por cada elección en una fila vaga.
 *   leerMiLexico           → lo aprendido de quien tiene la sesión (RLS: solo lo propio).
 *
 * La tarjeta se arma en el teléfono, por reglas: no pasa por la Edge Function ni por el modelo, así que funciona aunque el
 * modelo no responda. La base revalida todo (escala, solo hoy, solo lo propio). Nunca lanzan. Los fallos se anotan con
 * un texto fijo: ni la persona, ni la frase, ni los valores viajan en el aviso.
 */
export const RPC_APLICAR_CHECKIN = 'praxis_aplicar_checkin'
export const RPC_APRENDER_FORMA = 'praxis_aprender_forma'
const AVISO_FALLO = 'praxis_aplicar_checkin: no se pudo guardar el check-in'
const AVISO_APRENDER = 'praxis_aprender_forma: no se pudo anotar lo aprendido'

export interface RespuestaRpc { data: unknown; error: { code?: string } | null }

export interface DependenciasCheckin {
  rpc: (nombre: string, args: Record<string, unknown>) => Promise<RespuestaRpc>
  leer: () => Promise<{ data: unknown; error: unknown }>
  usuarioDeLaSesion: () => Promise<string | null>
  fijar: (c: CheckinDiario) => void
  anotarFallo: (aviso: string) => void
}

const porDefecto = (): DependenciasCheckin => ({
  rpc: async (nombre, args) => {
    if (!modoNube) return { data: null, error: { code: 'sin_nube' } }
    const { data, error } = await supabase().rpc(nombre, args)
    return { data, error: error ? { code: error.code } : null }
  },
  leer: async () => {
    if (!modoNube) return { data: [], error: null }
    const { data, error } = await supabase().from('praxis_lexico_persona').select('campo,forma,valor,confirmaciones')
    return { data, error }
  },
  usuarioDeLaSesion: async () => {
    if (!modoNube) return null
    try { return (await supabase().auth.getSession()).data.session?.user.id ?? null } catch { return null }
  },
  fijar: (c) => db.bienestar.guardar(c),
  anotarFallo: (aviso) => reportarError(new Error(aviso), { donde: 'praxis:checkin' }),
})

export type ResultadoGuardarCheckin =
  | { ok: true; parcial: boolean }
  | { ok: false; motivo: 'nada' | 'otra_persona' | 'sin_migracion' | 'no_se_pudo' }

/** La fila que devolvió la base, si es de quien tiene la sesión y trae lo mínimo. */
function filaDevuelta(data: unknown, usuarioId: string): CheckinDiario | null {
  const datos = (data as { datos?: unknown } | null)?.datos as Partial<CheckinDiario> | undefined
  if (!datos || typeof datos !== 'object') return null
  if (datos.usuarioId !== usuarioId || typeof datos.id !== 'string' || typeof datos.fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)) return null
  return datos as CheckinDiario
}

export async function guardarCheckinDePraxis(
  entrada: { usuarioId: string; mensajeId: string; confirmado: Confirmado; aprendizajes: { campo: CampoCheckin; forma: string; valor: string }[] },
  deps: Partial<DependenciasCheckin> = {},
): Promise<ResultadoGuardarCheckin> {
  const d = { ...porDefecto(), ...deps }
  if (Object.keys(entrada.confirmado.parche).length === 0) return { ok: false, motivo: 'nada' }
  try {
    const sesion = await d.usuarioDeLaSesion()
    if (!sesion || sesion !== entrada.usuarioId) return { ok: false, motivo: 'otra_persona' } // nunca el check-in de otra persona
    const r = await d.rpc(RPC_APLICAR_CHECKIN, { p_mensaje_id: entrada.mensajeId, p_indice: 0, p_parche: entrada.confirmado.parche })
    if (r.error?.code === 'PGRST202') return { ok: false, motivo: 'sin_migracion' }
    const fila = r.error ? null : filaDevuelta(r.data, entrada.usuarioId)
    if (!fila) { d.anotarFallo(AVISO_FALLO); return { ok: false, motivo: 'no_se_pudo' } }
    d.fijar(fila)
    await aprender(d, entrada.aprendizajes)
    return { ok: true, parcial: fila.parcial === true }
  } catch {
    try { d.anotarFallo(AVISO_FALLO) } catch { /* contar fallos no puede ser un fallo más */ }
    return { ok: false, motivo: 'no_se_pudo' }
  }
}

export const RPC_ANOTAR_PATRON = 'praxis_anotar_patron'
const AVISO_ANOTAR = 'praxis_anotar_patron: no se pudo anotar en el cuaderno'
/** Tope por tarjeta: una frase no da más de unas pocas anotaciones. */
const MAX_ANOTACIONES = 5

export type ResultadoAnotar =
  | { ok: true; anotadas: number }
  | { ok: false; motivo: 'nada' | 'otra_persona' | 'sin_migracion' | 'no_se_pudo' }

/**
 * Anota en el cuaderno de la persona (RPC `praxis_anotar_patron`, 0176) lo que ella tocó en la tarjeta. Una clave por
 * mensaje y posición: tocar dos veces no duplica. El alimento no se manda (queda vacío). Nunca lanza; el aviso de fallo
 * es de texto fijo: ni la persona ni la frase viajan en él.
 */
export async function anotarPatron(
  entrada: { usuarioId: string; mensajeId: string; anotaciones: Anotacion[] },
  deps: Partial<DependenciasCheckin> = {},
): Promise<ResultadoAnotar> {
  const d = { ...porDefecto(), ...deps }
  const lista = entrada.anotaciones.slice(0, MAX_ANOTACIONES)
  if (lista.length === 0) return { ok: false, motivo: 'nada' }
  try {
    const sesion = await d.usuarioDeLaSesion()
    if (!sesion || sesion !== entrada.usuarioId) return { ok: false, motivo: 'otra_persona' }
    let anotadas = 0
    for (const [i, a] of lista.entries()) {
      const r = await d.rpc(RPC_ANOTAR_PATRON, {
        p_tipo: a.tipo, p_zona: a.zona ?? null, p_momento: a.momento ?? null, p_alimento: null,
        p_cita: a.cita, p_clave: `${entrada.mensajeId}:${i}`.slice(0, 80),
      })
      if (r.error?.code === 'PGRST202') return { ok: false, motivo: 'sin_migracion' }
      if (!r.error) anotadas++
    }
    if (anotadas === 0) { d.anotarFallo(AVISO_ANOTAR); return { ok: false, motivo: 'no_se_pudo' } }
    return { ok: true, anotadas }
  } catch {
    try { d.anotarFallo(AVISO_ANOTAR) } catch { /* contar fallos no puede ser un fallo más */ }
    return { ok: false, motivo: 'no_se_pudo' }
  }
}

/** Lo aprendido no frena nada: si falla, el check-in ya quedó guardado y solo se anota el fallo una vez. */
async function aprender(d: DependenciasCheckin, aprendizajes: { campo: CampoCheckin; forma: string; valor: string }[]): Promise<void> {
  let fallo = false
  for (const a of aprendizajes.slice(0, OBLIGATORIOS.length)) {
    const r = await d.rpc(RPC_APRENDER_FORMA, { p_campo: a.campo, p_forma: a.forma, p_valor: a.valor }).catch(() => ({ data: null, error: {} }))
    if (r.error) fallo = true
  }
  if (fallo) d.anotarFallo(AVISO_APRENDER)
}

/** Lo aprendido de quien tiene la sesión. Sin tabla (0171 sin aplicar) o con error: vacío, y la tarjeta sale como siempre. */
export async function leerMiLexico(deps: Partial<DependenciasCheckin> = {}): Promise<FormaAprendida[]> {
  const d = { ...porDefecto(), ...deps }
  try {
    const r = await d.leer()
    if (r.error || !Array.isArray(r.data)) return []
    return r.data.flatMap((x): FormaAprendida[] => {
      const f = x as Partial<FormaAprendida>
      return typeof f.forma === 'string' && typeof f.valor === 'string' && typeof f.confirmaciones === 'number'
        && CAMPOS_QUE_APRENDEN.includes(f.campo as CampoCheckin)
        ? [{ campo: f.campo as CampoCheckin, forma: f.forma, valor: f.valor, confirmaciones: f.confirmaciones }] : []
    })
  } catch {
    return []
  }
}

/** Cuáles de los 8 obligatorios ya están llenos HOY en el teléfono (para no volver a pedirlos). */
export function camposLlenosHoy(c: CheckinDiario | undefined): CampoCheckin[] {
  if (!c) return []
  return OBLIGATORIOS.filter((campo) => (c as unknown as Record<string, unknown>)[campo] !== undefined)
}
