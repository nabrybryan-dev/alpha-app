// Rutas con «.ts»: este módulo lo importa la Edge Function `praxis-charla` (Deno).

/**
 * El pedido a DeepSeek y la forma de lo que se acepta de vuelta. PURO.
 *
 * LO QUE SALE (y nada más): la frase ya limpia + de cada pieza de `praxis_conceptos` que la contesta, su id,
 * `respuesta`, `estudios` y `criterio_de_practica`, tal cual están firmados. Nunca id de persona, perfil, plan,
 * historial ni nombre. Si `estudios` está vacío el bloque no se inventa: la clave no viaja.
 *
 * El modelo solo redacta `respuesta` y dice qué piezas usó. Los bloques de estudios y de criterio que ve la
 * persona NO los escribe el modelo: se toman de las piezas, separados (`validarRespuestaCharla`).
 */
export const MODELO_CHARLA = 'deepseek-flash'
export const URL_DEEPSEEK = 'https://api.deepseek.com/chat/completions'
export const MAX_RESPUESTA_MODELO = 900
export const MAX_PIEZAS = 3

export interface PiezaDeLaBiblioteca {
  id: string
  respuesta: string
  estudios: string
  criterio_de_practica: string
}

export interface PiezaEnElPedido {
  id: string
  respuesta: string
  estudios?: string
  criterio_de_practica: string
}

export const PROMPT_SISTEMA_CHARLA =
  'Respondes en español, corto y claro, SOLO con lo que dicen las piezas que recibes. No añadas datos, cifras ni consejos ' +
  'que no estén en ellas. No prescribas: tu número lo ajusta tu coach. No pidas ni uses datos personales. ' +
  'Responde un JSON con las claves "respuesta" (texto) y "piezas_usadas" (lista de ids de las piezas que usaste).'

/** Los nombres de los campos que salen, para el registro del envío (nunca el texto). */
export const CAMPOS_DEL_ENVIO = ['frase', 'piezas[].id', 'piezas[].respuesta', 'piezas[].estudios', 'piezas[].criterio_de_practica'] as const

export function piezasParaElPedido(piezas: readonly PiezaDeLaBiblioteca[]): PiezaEnElPedido[] {
  return piezas.slice(0, MAX_PIEZAS).map((p) => ({
    id: p.id,
    respuesta: p.respuesta,
    ...(p.estudios.trim() ? { estudios: p.estudios } : {}),
    criterio_de_practica: p.criterio_de_practica,
  }))
}

export interface PedidoDeepseek {
  model: string
  messages: { role: 'system' | 'user'; content: string }[]
  temperature: number
  max_tokens: number
  stream: false
  response_format: { type: 'json_object' }
  /** deepseek-flash razona por defecto y el razonamiento se come max_tokens (medido con DeepSeek real: salida vacía o cortada). */
  thinking: { type: 'disabled' }
}

/** Arma el cuerpo del POST. Recibe SOLO la frase limpia y las piezas: no hay por dónde colar nada más. */
export function armarPedidoDeepseek(fraseLimpia: string, piezas: readonly PiezaDeLaBiblioteca[]): PedidoDeepseek {
  return {
    model: MODELO_CHARLA,
    messages: [
      { role: 'system', content: PROMPT_SISTEMA_CHARLA },
      { role: 'user', content: JSON.stringify({ frase: fraseLimpia, piezas: piezasParaElPedido(piezas) }) },
    ],
    temperature: 0,
    max_tokens: 500,
    stream: false,
    response_format: { type: 'json_object' },
    thinking: { type: 'disabled' },
  }
}

export interface PiezaMostrada {
  id: string
  /** null si la pieza no trae estudios: el bloque «Lo que dicen los estudios» no se pinta. */
  estudios: string | null
  criterio_de_practica: string
}

export interface RespuestaCharla {
  respuesta: string
  piezas_usadas: string[]
  piezas: PiezaMostrada[]
  origen: 'modelo' | 'respaldo'
}

export function piezaMostrada(p: PiezaDeLaBiblioteca): PiezaMostrada {
  return { id: p.id, estudios: p.estudios.trim() ? p.estudios : null, criterio_de_practica: p.criterio_de_practica }
}

/**
 * Lee la salida del modelo (el `content` del primer mensaje). Devuelve la respuesta solo si es JSON con
 * `respuesta` (texto no vacío y corto) y `piezas_usadas` (lista de ids que SÍ se enviaron). Todo lo demás es null:
 * quien llama usa el respaldo sin modelo.
 */
export function validarRespuestaCharla(contenido: unknown, enviadas: readonly PiezaDeLaBiblioteca[]): RespuestaCharla | null {
  if (typeof contenido !== 'string') return null
  let j: unknown
  try {
    j = JSON.parse(contenido)
  } catch {
    return null
  }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return null
  const { respuesta, piezas_usadas } = j as { respuesta?: unknown; piezas_usadas?: unknown }
  if (typeof respuesta !== 'string') return null
  const texto = respuesta.trim()
  if (!texto || texto.length > MAX_RESPUESTA_MODELO) return null
  if (!Array.isArray(piezas_usadas) || piezas_usadas.length === 0 || !piezas_usadas.every((x) => typeof x === 'string')) return null
  const ids = new Set(enviadas.map((p) => p.id))
  const usadas = [...new Set(piezas_usadas as string[])]
  if (!usadas.every((id) => ids.has(id))) return null
  return {
    respuesta: texto,
    piezas_usadas: usadas,
    piezas: enviadas.filter((p) => usadas.includes(p.id)).map(piezaMostrada),
    origen: 'modelo',
  }
}
