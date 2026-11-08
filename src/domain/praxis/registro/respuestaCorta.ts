/**
 * La RESPUESTA CORTA a una pregunta de un solo campo («¿Cómo te fue hoy en el entreno?» → «bien»). Volcado de salidas, 7-nov.
 *
 * No trae palabras nuevas: usa los extremos de la escala del formulario con la polaridad de cada campo («bien» de
 * energía = poco cansancio) y los rótulos de la escala misma (mucho = MUCHO, poco = POCO). Solo vale cuando el trozo
 * ES la respuesta (todas las formas van ancladas de punta a punta): dentro de una frase larga, «bien» puede ser cualquier cosa.
 *  - hambre: solo un número de 1 a 10 dicho en cifras («un 6»); nunca de palabras.
 *  - dolor: solo la ausencia explícita («no», «nada», «ninguno») da cero; cualquier otra cosa, nada.
 *  - «bastante» no se elige: queda entre el medio y el «mucho».
 */
import { normalizarTexto } from './numeros.ts'
import type { CampoCheckin } from './mensajeLargo.ts'

export type ValorCorto = { valor: string | number } | { entre: [string, string] }

/** [bueno, medio, malo] de cada campo de tres niveles (misma polaridad que conectores.ts). */
const ESCALA: Partial<Record<CampoCheckin, readonly [string, string, string]>> = {
  rendimiento: ['BUENA', 'REGULAR', 'MALA'], calidadSueno: ['BUENA', 'REGULAR', 'MALA'], alimentacion: ['BUENA', 'REGULAR', 'MALA'],
  motivacion: ['MUCHO', 'REGULAR', 'POCO'], cansancio: ['POCO', 'REGULAR', 'MUCHO'], estres: ['POCO', 'REGULAR', 'MUCHO'],
}
const CANTIDAD: readonly CampoCheckin[] = ['motivacion', 'cansancio', 'estres']

const BUENO = /^(si,? )?(muy |super |bien )?(bien|excelente)$/
const MALO = /^(muy |super )?(mal|fatal|pesimo)$/
const MUCHO = /^(si,? )?(mucho|muchisimo|un monton)$/
const POCO = /^(poco|poquito|poquitico|nada|casi nada|cero|un poco)$/
const BASTANTE = /^(si,? )?bastante$/
const SIN_DOLOR = /^(no|nada|no,? nada|ninguno|ninguna|cero|para nada|no me duele nada)$/

function limpia(cita: string): string {
  return normalizarTexto(cita).replace(/[.,!?]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function respuestaCorta(cita: string, campo: CampoCheckin): ValorCorto | null {
  const n = limpia(cita)
  if (campo === 'dolor') return SIN_DOLOR.test(n) ? { valor: 0 } : null
  if (campo === 'hambreEscala') {
    const m = /^(un |una |como un |como una |en )?(10|[1-9])$/.exec(n)
    return m ? { valor: Number(m[2]) } : null
  }
  const e = ESCALA[campo]
  if (!e) return null
  if (BUENO.test(n)) return { valor: e[0] }
  if (MALO.test(n)) return { valor: e[2] }
  if (!CANTIDAD.includes(campo)) return null
  if (MUCHO.test(n)) return { valor: 'MUCHO' }
  // «Un poco» de estrés = poco; «un poco» de ganas = poco: el rótulo de la escala, al pie de la letra.
  if (POCO.test(n)) return { valor: 'POCO' }
  if (BASTANTE.test(n)) return { entre: ['REGULAR', 'MUCHO'] }
  return null
}
