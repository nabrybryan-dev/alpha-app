/**
 * LA CAPA CON MODELO de la organización por voz (fase O2, segunda capa). Apagada: nada la llama todavía.
 *
 * La gramática (`pedido.ts`) es rápida y local, pero solo entiende las formas que ya conoce: con frases nuevas
 * escritas a ciegas acertó 36 % (examen del 11-nov). Lo que ella no entiende pasa a un modelo pequeño con un MENÚ
 * CERRADO: no escribe nada libre, solo elige un verbo de una lista y una pieza del catálogo por su identificador.
 * Todo lo que elige se valida aquí, y nunca ejecuta: la decisión sigue siendo `decidirParaPieza`, con sus candados
 * (piezas fijas, asignadas, tope de ocultas) y la persona confirma con los dos botones de siempre.
 *
 * Seguridad primero: quien llame NO debe consultar al modelo si el filtro de riesgo o `DE_SALUD` saltan con la frase.
 * Ante una salida ilegible o inventada, el resultado es «ninguno»: no se organiza nada.
 */

export const VERBOS_DEL_MODELO = ['traer', 'ocultar', 'mover_arriba', 'mover_abajo', 'restablecer', 'listar_ocultas', 'solo_lo_importante', 'ninguno'] as const
export type VerboDelModelo = (typeof VERBOS_DEL_MODELO)[number]

export interface LecturaDelModelo {
  verbo: VerboDelModelo
  /** Identificador del catálogo, o `null` en los verbos que no llevan pieza. */
  pieza: string | null
}

const SIN_PIEZA: ReadonlySet<VerboDelModelo> = new Set(['restablecer', 'listar_ocultas', 'solo_lo_importante', 'ninguno'])

export interface PiezaParaElMenu {
  id: string
  nombre: string
}

/** El prompt de sistema: menú cerrado de verbos y lista cerrada de piezas de ESTA persona. */
export function promptDeOrganizacion(piezas: readonly PiezaParaElMenu[]): string {
  return `Eres el lector de órdenes de una app de entrenamiento y nutrición. La persona le habla a su asistente (dictado al celular, español de Colombia, con errores de escritura, muletillas y rodeos) y a veces le pide cambiar cómo se ve la app. Tu única tarea es decir QUÉ pide, eligiendo de un menú cerrado. No conversas, no explicas, no inventas.

VERBOS (elige exactamente uno):
- traer: quiere ver o ir a una parte de la app (también preguntas sobre lo suyo, como cuánta agua lleva).
- ocultar: ya no quiere ver una parte (esconderla, quitarla de la vista, no mostrarla más, o se queja de que le estorba).
- mover_arriba: quiere una parte de primera, arriba, lo primero que vea.
- mover_abajo: quiere una parte al final, abajo, al fondo.
- restablecer: quiere TODA la app como venía de fábrica, por defecto, como estaba al principio.
- listar_ocultas: quiere saber qué partes tiene escondidas.
- solo_lo_importante: quiere la app simple, solo lo esencial, esconder todo lo demás.
- ninguno: no es una orden sobre cómo se ve la app (una pregunta o comentario sobre entrenar, comer, dormir o sentirse), o no se entiende, o dudas. Ante la duda, ninguno.

PIEZAS (usa solo estos identificadores, tal cual; pieza es null en restablecer, listar_ocultas, solo_lo_importante y ninguno):
${piezas.map((p) => `${p.id} = ${p.nombre}`).join('\n')}

REGLAS:
1. Si el verbo lleva pieza y no puedes elegir UNA pieza de la lista con seguridad, responde ninguno.
2. Una orden que habla de dolor, lesión, síntomas o de cómo se siente la persona NO es una orden de la app: ninguno.
3. Responde SOLO un objeto JSON, sin texto antes ni después: {"verbo":"<verbo>","pieza":"<id>"|null}`
}

/** Lee la salida del modelo. `null` = ilegible o inventada (el verbo no es del menú, o la pieza no está en la lista). */
export function leerSalidaDeOrganizacion(texto: string, idsValidos: ReadonlySet<string>): LecturaDelModelo | null {
  const limpio = texto.replace(/^[\s`]*(json)?/i, '').replace(/`+\s*$/, '').trim()
  let j: unknown
  try {
    j = JSON.parse(limpio.slice(limpio.indexOf('{'), limpio.lastIndexOf('}') + 1))
  } catch {
    return null
  }
  if (typeof j !== 'object' || j === null) return null
  const { verbo, pieza } = j as { verbo?: unknown; pieza?: unknown }
  if (typeof verbo !== 'string' || !(VERBOS_DEL_MODELO as readonly string[]).includes(verbo)) return null
  const v = verbo as VerboDelModelo
  if (SIN_PIEZA.has(v)) return { verbo: v, pieza: null }
  if (typeof pieza !== 'string' || !idsValidos.has(pieza)) return null
  return { verbo: v, pieza }
}
