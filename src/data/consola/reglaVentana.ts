import { modoNube, supabase } from '../supabase'

/**
 * El interruptor de la regla de ventana del primer plan (0141 + 0143 + 0170).
 *
 * Encendida, `vencer_primer_plan` (pg_cron cada 15 min) activa sola un primer plan cuyo plazo
 * venció sin firma si es riesgo bajo o medio, clasificado por el sistema, sin dudas pendientes,
 * sin «requiere revisión» y con el mismo contenido que se clasificó. Riesgo alto nunca. Apagada,
 * todo plan vencido pasa a `espera_bryan`.
 *
 * El navegador no lee las tablas (no tiene privilegio): el estado sale de `estado_regla_ventana`
 * y los cambios van por `encender_regla_ventana` / `apagar_regla_ventana`, que exigen la
 * capacidad `encender_regla_ventana` y dejan quién y cuándo en `cambios_regla_ventana`.
 */

export interface CambioRegla {
  encendida: boolean
  por: string | null
  porNombre: string | null
  en: string
  nota: string | null
}

export interface EstadoRegla {
  encendida: boolean
  ultimoCambio: CambioRegla | null
}

export type LecturaRegla = { ok: true; estado: EstadoRegla } | { ok: false; error: string }
export type ResultadoCambio = { ok: true } | { ok: false; error: string }

const texto = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

/** Lo que devuelve la RPC, o `null` si tiene una forma que no se reconoce: nunca se pinta a medias. */
export function aEstadoRegla(datos: unknown): EstadoRegla | null {
  if (!datos || typeof datos !== 'object') return null
  const d = datos as Record<string, unknown>
  if (typeof d.activa !== 'boolean') return null
  const c = d.ultimo_cambio as Record<string, unknown> | null | undefined
  if (c == null) return { encendida: d.activa, ultimoCambio: null }
  if (typeof c !== 'object' || typeof c.activa_despues !== 'boolean' || typeof c.hecho_en !== 'string') return null
  return {
    encendida: d.activa,
    ultimoCambio: {
      encendida: c.activa_despues,
      por: texto(c.hecho_por),
      porNombre: texto(c.hecho_por_nombre),
      en: c.hecho_en,
      nota: texto(c.nota),
    },
  }
}

function mensaje(error: { code?: string; message?: string }, porDefecto: string): string {
  if (error.code === '42501') return 'No tienes permiso para cambiar esta regla.'
  return error.message || porDefecto
}

/** Nunca lanza. En demo no hay regla que leer. */
export async function leerReglaVentana(): Promise<LecturaRegla> {
  if (!modoNube) return { ok: false, error: 'Sin conexión con la base: esto es un demo.' }
  try {
    const { data, error } = await supabase().rpc('estado_regla_ventana')
    if (error) return { ok: false, error: mensaje(error, 'No se pudo leer la regla.') }
    const estado = aEstadoRegla(data)
    if (!estado) return { ok: false, error: 'La base devolvió el estado con una forma inesperada.' }
    return { ok: true, estado }
  } catch (fallo) {
    return { ok: false, error: fallo instanceof Error ? fallo.message : 'Error de red.' }
  }
}

/** Enciende o apaga. La nota es opcional y la base la recorta a 500 caracteres. */
export async function cambiarReglaVentana(encender: boolean, nota: string): Promise<ResultadoCambio> {
  if (!modoNube) return { ok: false, error: 'Sin conexión con la base: esto es un demo.' }
  const limpia = nota.trim()
  try {
    const { error } = await supabase().rpc(encender ? 'encender_regla_ventana' : 'apagar_regla_ventana', {
      p_nota: limpia || null,
    })
    if (error) return { ok: false, error: mensaje(error, 'No se pudo guardar el cambio.') }
    return { ok: true }
  } catch (fallo) {
    return { ok: false, error: fallo instanceof Error ? fallo.message : 'Error de red.' }
  }
}
