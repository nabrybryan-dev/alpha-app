/**
 * Las dos llamadas a modelos de la voz natural: el REDACTOR (DeepSeek) y el SEGUNDO LECTOR (Haiku). Nunca lanzan:
 * devuelven un estado. Nunca registran ni devuelven el cuerpo de un error del proveedor (puede repetir el prompt).
 * Una sola llamada a cada uno, sin reintentos, con su tope de salida fijo.
 */
import { MODELO_HAIKU } from '../../../../src/domain/praxis/registro/prompt.ts'
import { MODELO_REDACTOR, PROMPT_REDACTOR } from './promptRedactor.ts'
import { PROMPT_LECTOR } from './promptLector.ts'
import type { CampoConcepto, TipoPregunta } from './tipoPregunta.ts'

/** Tope de salida por respuesta (diseño, sección 3: la ronda 3 mostró razonamiento comiéndose 3.000). */
export const MAX_TOKENS_REDACTOR = 4000
export const MAX_TOKENS_LECTOR = 400
/** Tras un «sin saldo», no se insiste durante este rato (caso 3 del criterio). */
export const PAUSA_SIN_SALDO_MS = 10 * 60 * 1000

export type EstadoLlamada = 'ok' | 'apagado' | 'sin_saldo' | 'vacio' | 'json_invalido' | 'timeout' | `http_${number}` | `error_${string}`
export type Proveedor = 'deepseek' | 'anthropic'

export interface DepsModelos {
  fetch: typeof fetch
  ahoraMs: () => number
}

const pausa: Record<Proveedor, number> = { deepseek: 0, anthropic: 0 }
/** Solo para pruebas. */
export function reiniciarPausas(): void {
  pausa.deepseek = 0
  pausa.anthropic = 0
}
export const enPausa = (p: Proveedor, ahoraMs: number) => ahoraMs < pausa[p]

function estadoDeError(e: unknown): EstadoLlamada {
  // DOMException (tiempo agotado) no siempre es instancia de Error fuera de Deno: se lee el nombre.
  const nombre = typeof (e as { name?: unknown } | null)?.name === 'string' ? (e as { name: string }).name : 'desconocido'
  return nombre === 'TimeoutError' || nombre === 'AbortError' ? 'timeout' : `error_${nombre}`
}

async function sinSaldoAnthropic(r: Response): Promise<boolean> {
  if (r.status !== 400) return false
  const cuerpo = await r.text().catch(() => '')
  return /credit balance/i.test(cuerpo) // se lee para clasificar, no se guarda
}

function leerJson(texto: string): Record<string, unknown> | null {
  try {
    const j = JSON.parse(texto)
    return j && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export interface Redaccion { estado: EstadoLlamada; respuesta?: string; hueco?: boolean; tokens: number }

export async function redactar(
  d: DepsModelos, clave: string | undefined, entrada: { pregunta: string; tipo: TipoPregunta; campos: Partial<Record<CampoConcepto, unknown>> }, plazoMs: number,
): Promise<Redaccion> {
  if (!clave) return { estado: 'apagado', tokens: 0 }
  if (enPausa('deepseek', d.ahoraMs())) return { estado: 'sin_saldo', tokens: 0 }
  try {
    const r = await d.fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${clave}` },
      signal: AbortSignal.timeout(plazoMs),
      body: JSON.stringify({
        model: MODELO_REDACTOR,
        max_tokens: MAX_TOKENS_REDACTOR,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: PROMPT_REDACTOR },
          { role: 'user', content: JSON.stringify({ PREGUNTA: entrada.pregunta, TIPO: entrada.tipo, CAMPOS: entrada.campos }) },
        ],
      }),
    })
    if (r.status === 402) { // «Insufficient Balance» en la documentación de DeepSeek (error_codes, leída el 4-nov-2026)
      pausa.deepseek = d.ahoraMs() + PAUSA_SIN_SALDO_MS
      return { estado: 'sin_saldo', tokens: 0 }
    }
    if (!r.ok) return { estado: `http_${r.status}`, tokens: 0 }
    const cuerpo = (await r.json().catch(() => null)) as { choices?: { message?: { content?: string } }[]; usage?: { total_tokens?: number } } | null
    const tokens = cuerpo?.usage?.total_tokens ?? 0
    const contenido = cuerpo?.choices?.[0]?.message?.content ?? ''
    if (!contenido.trim()) return { estado: 'vacio', tokens }
    const j = leerJson(contenido)
    if (!j || typeof j.respuesta !== 'string') return { estado: 'json_invalido', tokens }
    if (!j.respuesta.trim()) return { estado: 'vacio', tokens }
    return { estado: 'ok', respuesta: j.respuesta, hueco: j.hueco === true, tokens }
  } catch (e) {
    return { estado: estadoDeError(e), tokens: 0 }
  }
}

export type MotivoRechazo = 'otro_tipo' | 'hecho_fuera_de_campos'
export interface Lectura { estado: EstadoLlamada | 'aprobo' | 'rechazo'; motivo?: MotivoRechazo; tokens: number }

export async function leerConSegundoLector(
  d: DepsModelos, clave: string | undefined, entrada: { pregunta: string; campos: Partial<Record<CampoConcepto, unknown>>; respuesta: string }, plazoMs: number,
): Promise<Lectura> {
  if (!clave) return { estado: 'apagado', tokens: 0 }
  if (enPausa('anthropic', d.ahoraMs())) return { estado: 'sin_saldo', tokens: 0 }
  try {
    const r = await d.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': clave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      signal: AbortSignal.timeout(plazoMs),
      body: JSON.stringify({
        model: MODELO_HAIKU,
        max_tokens: MAX_TOKENS_LECTOR,
        temperature: 0,
        system: PROMPT_LECTOR,
        messages: [{ role: 'user', content: JSON.stringify({ pregunta: entrada.pregunta, campos_de_la_pieza: entrada.campos, respuesta: entrada.respuesta }) }],
      }),
    })
    if (!r.ok) {
      if (await sinSaldoAnthropic(r)) {
        pausa.anthropic = d.ahoraMs() + PAUSA_SIN_SALDO_MS
        return { estado: 'sin_saldo', tokens: 0 }
      }
      return { estado: `http_${r.status}`, tokens: 0 }
    }
    const cuerpo = (await r.json().catch(() => null)) as CuerpoAnthropic | null
    const tokens = (cuerpo?.usage?.input_tokens ?? 0) + (cuerpo?.usage?.output_tokens ?? 0)
    return { ...veredictoDelLector(cuerpo?.content?.find((b) => b.type === 'text')?.text ?? ''), tokens }
  } catch (e) {
    return { estado: estadoDeError(e), tokens: 0 }
  }
}

type CuerpoAnthropic = { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } }

/** Lee el JSON del lector. La regla de rechazo se aplica aquí: no se le cree al modelo un campo «rechazo». */
function veredictoDelLector(texto: string): Omit<Lectura, 'tokens'> {
  if (!texto.trim()) return { estado: 'vacio' }
  const j = leerJson(texto.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''))
  const contesta = j?.contesta_lo_preguntado
  const hecho = j?.hecho_fuera_de_campos
  if (!j || (contesta !== 'si' && contesta !== 'no') || !(hecho === null || typeof hecho === 'string')) return { estado: 'json_invalido' }
  if (contesta === 'no') return { estado: 'rechazo', motivo: 'otro_tipo' }
  if (typeof hecho === 'string' && hecho.trim()) return { estado: 'rechazo', motivo: 'hecho_fuera_de_campos' }
  return { estado: 'aprobo' }
}
