/**
 * PALABRAS NUEVAS de los conectores (propuesta del 7-nov-2026, `biblioteca-praxis/CAMBIO-PROPUESTO-PALABRAS-20261107.md`).
 * Se aplican SOLO a un trozo que ya tiene área (la nombra él, la del trozo de antes o la pregunta de Praxis), después de
 * la tabla de vida.ts y antes de darlo por descartado. No tocan vida.ts: si Bryan retira una, se quita de aquí.
 *
 * «Me destruyó» (el entreno) NO se mapea a propósito: puede ser un entreno duro y bueno o uno malo.
 */
import { normalizarTexto } from './numeros.ts'
import type { CampoCheckin } from './mensajeLargo.ts'
import type { ValorCorto } from './respuestaCorta.ts'

type Regla = [RegExp, ValorCorto]

const POR_CAMPO: Partial<Record<CampoCheckin, Regla[]>> = {
  estres: [[/\ba tope\b/, { valor: 'MUCHO' }]],
  cansancio: [
    [/\bmuy cansad[oa]\b/, { valor: 'MUCHO' }],
    [/\bcon energia\b/, { valor: 'POCO' }],
    // «Cansado» a secas no dice cuánto: la persona elige.
    [/\bcansad[oa]\b/, { entre: ['REGULAR', 'MUCHO'] }],
  ],
  calidadSueno: [
    [/\bdesvel/, { valor: 'MALA' }],
    [/\bno dormi (casi )?nada\b/, { valor: 'MALA' }],
    // «Poquito» es cantidad, no calidad: la persona elige (y las horas se preguntan aparte).
    [/\bdormi (poquito|poco)\b/, { entre: ['REGULAR', 'MALA'] }],
  ],
  rendimiento: [
    [/\bbuenisim[oa]\b/, { valor: 'BUENA' }],
    [/\bre bien\b/, { valor: 'BUENA' }],
    [/\bsenti\b.*\bpesad[oa]\b/, { valor: 'MALA' }],
  ],
}

/**
 * «No tanto» niega la CANTIDAD de lo que se nombra: «el estrés no tanto» = poco estrés, pero «la comida no tanto» =
 * la comida no tan bien. Por eso el par depende del campo.
 */
const NO_TANTO: Partial<Record<CampoCheckin, [string, string]>> = {
  estres: ['POCO', 'REGULAR'], cansancio: ['POCO', 'REGULAR'],
  motivacion: ['REGULAR', 'POCO'],
  rendimiento: ['REGULAR', 'MALA'], alimentacion: ['REGULAR', 'MALA'], calidadSueno: ['REGULAR', 'MALA'],
}

export function palabraNueva(cita: string, campo: CampoCheckin): ValorCorto | null {
  const n = normalizarTexto(cita)
  if (/\bno tanto\b/.test(n)) { const par = NO_TANTO[campo]; return par ? { entre: par } : null }
  for (const [re, v] of POR_CAMPO[campo] ?? []) if (re.test(n)) return v
  return null
}
