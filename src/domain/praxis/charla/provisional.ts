// Rutas con «.ts»: este módulo lo importa la Edge Function `praxis-charla` (Deno).
import { filtrarProvisional, type MotivoFiltro } from './filtroProvisional.ts'
import { limpiarFrase } from './limpiador.ts'
import { MODELO_CHARLA } from './pedidoCharla.ts'
import { VOCABULARIO_CHARLA } from './vocabularioCharla.generado.ts'
import { soloVocabulario } from './vocabularioPermitido.ts'

/**
 * Respuesta PROVISIONAL (parte A del diseño del 11-nov-2026): cuando no hay pieza aprobada, DeepSeek contesta con
 * conocimiento general, el texto pasa por `filtrarProvisional` y, si sale limpio, se muestra con rótulo. PURO.
 * No se guarda como ficha y NUNCA entra al conjunto de entrenamiento (`excluirEntrenamiento: true`).
 * Decisión del dueño (11-nov): cambia la regla «Praxis no dice textos de una IA sin aprobación» solo para esta rama, apagada por bandera.
 */

// TEXTO PENDIENTE DE APROBACION DEL DUENO (selector)
export const ROTULO_PROVISIONAL = 'Respuesta provisional, sin revisar. Tu coach puede verla.'

export const MAX_TOKENS_PROVISIONAL = 200

export const PROMPT_PROVISIONAL =
  'Respondes en español, en máximo 100 palabras, a una pregunta de entrenamiento. Usa solo conocimiento general: ' +
  'explica la idea con palabras sencillas. No des cifras, porcentajes ni números en letra, no nombres autores, años ni estudios, ' +
  'y no digas que algo está demostrado ni comprobado. No hagas prescripción personal: no indiques series, repeticiones, ' +
  'pesos, comidas ni planes; di que tu coach lo ajusta. No hables de salud, lesiones ni medicación. ' +
  'No pidas ni uses datos personales. Responde solo el texto, sin listas.'

export interface PedidoProvisional {
  model: string
  messages: { role: 'system' | 'user'; content: string }[]
  temperature: number
  max_tokens: number
  stream: false
  /** deepseek-flash razona por defecto y el razonamiento gasta max_tokens: la salida salia vacia o cortada (medido 11-nov). */
  thinking: { type: 'disabled' }
}

const VOCAB: ReadonlySet<string> = new Set(VOCABULARIO_CHARLA)

/** La frase por el mismo camino de la función: limpiador de patrones y luego solo vocabulario permitido (idempotente). */
const filtrada = (frase: string): string => soloVocabulario(limpiarFrase(frase, [], { mayusculas: false }).texto, VOCAB)

/** ¿Queda algo de la frase aparte de marcas tapadas? Si no, no hay nada que mandar. */
export function tieneContenido(fraseLimpia: string): boolean {
  return /\p{L}{3,}/u.test(fraseLimpia.replace(/\[[^\]]*\]/g, ' '))
}

/** Arma el POST a DeepSeek: solo la frase limpia y el prompt. Sin piezas, sin id de persona. */
export function armarPedidoProvisional(fraseLimpia: string): PedidoProvisional {
  return {
    model: MODELO_CHARLA,
    messages: [
      { role: 'system', content: PROMPT_PROVISIONAL },
      { role: 'user', content: filtrada(fraseLimpia) },
    ],
    temperature: 0,
    max_tokens: MAX_TOKENS_PROVISIONAL,
    stream: false,
    thinking: { type: 'disabled' },
  }
}

export type DecisionProvisional =
  | { tipo: 'provisional'; texto: string; rotulo: string; origen: 'provisional'; excluirEntrenamiento: true }
  | { tipo: 'al_coach'; motivo: MotivoFiltro | 'salida_invalida' }

/**
 * Decide qué se hace con lo que devolvió DeepSeek. `fraseLimpia` es la pregunta (sus cifras no cuentan como ajenas).
 * Si el filtro bloquea, el resultado NO lleva el texto del modelo.
 */
export function decidirProvisional(salidaDeepSeek: unknown, fraseLimpia = ''): DecisionProvisional {
  if (typeof salidaDeepSeek !== 'string') return { tipo: 'al_coach', motivo: 'salida_invalida' }
  const f = filtrarProvisional(salidaDeepSeek, fraseLimpia)
  if (!f.ok) return { tipo: 'al_coach', motivo: f.motivo }
  return {
    tipo: 'provisional',
    texto: `${ROTULO_PROVISIONAL}\n\n${salidaDeepSeek.trim()}`,
    rotulo: ROTULO_PROVISIONAL,
    origen: 'provisional',
    excluirEntrenamiento: true,
  }
}
