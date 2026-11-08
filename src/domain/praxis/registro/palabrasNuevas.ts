/**
 * PALABRAS NUEVAS de los conectores (propuesta del 7-nov-2026, `biblioteca-praxis/CAMBIO-PROPUESTO-PALABRAS-20261107.md`).
 * Se aplican SOLO a un trozo que ya tiene área (la nombra él, la del trozo de antes o la pregunta de Praxis), después de
 * la tabla de vida.ts y antes de darlo por descartado. No tocan vida.ts: si Bryan retira una, se quita de aquí.
 *
 * «Me destruyó» (el entreno) NO se mapea a propósito: puede ser un entreno duro y bueno o uno malo.
 *
 * NEGACIÓN (sonda del 8-nov): si una de las tres palabras de antes niega («no me desvelé», «no me levanté con energía»),
 * la regla no vale y no se adivina. Las reglas que YA traen la negación dentro empiezan por ella, así que no la ven.
 */
import { normalizarTexto } from './numeros.ts'
import type { CampoCheckin } from './mensajeLargo.ts'
import type { ValorCorto } from './respuestaCorta.ts'

type Regla = [RegExp, ValorCorto]

const POR_CAMPO: Partial<Record<CampoCheckin, Regla[]>> = {
  estres: [
    [/\ba tope\b/, { valor: 'MUCHO' }],
    // «Fresco» en Colombia también es tranquilo (8-nov, Bryan: sí).
    [/\bfresc[oa]\b/, { valor: 'POCO' }],
  ],
  // «Con toda» y «a tope» se invierten según el campo (8-nov, Bryan: sí). Sin pregunta ni área no se llega aquí.
  motivacion: [
    [/\bcon toda\b/, { valor: 'MUCHO' }],
    [/\ba tope\b/, { valor: 'MUCHO' }],
  ],
  cansancio: [
    // «Molida» sola = muy cansada. Con parte del cuerpo («molida de las piernas») es dolor muscular: no se mapea.
    [/\bmolid[oa]\b(?!\s+(de|del|en|por)\b)(?!.*\b(pierna|brazo|espalda|pecho|hombro|gluteo|abdomen|cuadricep|musculo)s?\b)/, { valor: 'MUCHO' }],
    [/\bfresc[oa]\b/, { valor: 'POCO' }],
    [/\bcon toda\b/, { valor: 'POCO' }],
    [/\b(para )?nada cansad[oa]\b|\bno (estoy|me siento|ando) nada cansad[oa]\b/, { valor: 'POCO' }],
    [/\b(ya )?no (estoy|me siento|ando|amaneci|me levante)( tan| muy)? cansad[oa]\b/, { entre: ['POCO', 'REGULAR'] }],
    [/\b(muy|re|super|bien) cansad[oa]\b/, { valor: 'MUCHO' }],
    [/\bun poco cansad[oa]\b/, { entre: ['POCO', 'REGULAR'] }],
    [/\bcon energia\b/, { valor: 'POCO' }],
    // «Cansado» a secas no dice cuánto: la persona elige.
    [/\bcansad[oa]\b/, { entre: ['REGULAR', 'MUCHO'] }],
  ],
  calidadSueno: [
    // «Descansé» también puede ser un día sin entreno: solo llega aquí si el área ya es sueño (8-nov, Bryan: sí).
    [/\bno (descanse|he descansado)( bien| nada)?\b/, { valor: 'MALA' }],
    [/\bdescanse (bien|rico|profundo)\b/, { valor: 'BUENA' }],
    [/\bdescanse (poco|poquito)\b/, { entre: ['REGULAR', 'MALA'] }],
    [/\bdesvel/, { valor: 'MALA' }],
    [/\bno dormi (casi )?nada\b/, { valor: 'MALA' }],
    // «Poquito» es cantidad, no calidad: la persona elige (y las horas se preguntan aparte).
    [/\bdormi (poquito|poco)\b/, { entre: ['REGULAR', 'MALA'] }],
  ],
  rendimiento: [
    [/\bre bien\b/, { valor: 'BUENA' }],
    // «Pesada después del almuerzo» es digestión, no rendimiento (8-nov, Bryan: no se mapea).
    [/\bsenti\b(?!.*\b(almuerzo|comida|comi|comiendo|cena|desayuno|merienda|digest\w*)\b).*\bpesad[oa]\b/, { valor: 'MALA' }],
    [/\ba tope\b/, { valor: 'BUENA' }],
  ],
}

/** «Buenísimo» es el extremo bueno en toda área que se califica como buena o mala (no en cansancio ni estrés). */
const BUENISIMO = /\bbuenisim[oa]\b/
const EXTREMO_BUENO: Partial<Record<CampoCheckin, string>> = {
  rendimiento: 'BUENA', alimentacion: 'BUENA', calidadSueno: 'BUENA', motivacion: 'MUCHO',
}

/**
 * «No tanto» niega la CANTIDAD de lo que se nombra: «el estrés no tanto» = poco estrés, pero «la comida no tanto» =
 * la comida no tan bien. Por eso el par depende del campo. «Comí no tanto» es cuánto comió, no cómo: no vale.
 */
const NO_TANTO: Partial<Record<CampoCheckin, [string, string]>> = {
  estres: ['POCO', 'REGULAR'], cansancio: ['POCO', 'REGULAR'],
  motivacion: ['REGULAR', 'POCO'],
  rendimiento: ['REGULAR', 'MALA'], alimentacion: ['REGULAR', 'MALA'], calidadSueno: ['REGULAR', 'MALA'],
}

const NIEGA = /\b(no|nada|ni|tampoco|nunca|sin)\b/

function negadoAntes(n: string, desde: number): boolean {
  return NIEGA.test(n.slice(0, desde).trim().split(/\s+/).slice(-3).join(' '))
}

function deNoTanto(n: string, campo: CampoCheckin): ValorCorto | null {
  if (campo === 'alimentacion' && /\bcomi\b/.test(n)) return null
  const par = NO_TANTO[campo]
  return par ? { entre: par } : null
}

export function palabraNueva(cita: string, campo: CampoCheckin): ValorCorto | null {
  const n = normalizarTexto(cita)
  if (/\bno tanto\b/.test(n)) return deNoTanto(n, campo)
  const reglas: Regla[] = [...(POR_CAMPO[campo] ?? [])]
  const bueno = EXTREMO_BUENO[campo]
  if (bueno) reglas.push([BUENISIMO, { valor: bueno }])
  for (const [re, v] of reglas) {
    const m = re.exec(n)
    if (m) return negadoAntes(n, m.index) ? null : v
  }
  return null
}
