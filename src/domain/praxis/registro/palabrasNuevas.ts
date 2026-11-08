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
import { ZONAS_DEL_CUERPO } from './anotaciones.ts'
import type { CampoCheckin } from './mensajeLargo.ts'
import type { ValorCorto } from './respuestaCorta.ts'

type Regla = [RegExp, ValorCorto]

const ZONA = `(?:${ZONAS_DEL_CUERPO})(?:e?s)?`
/** «Molida» sin zona del cuerpo cerca, ni después («de las piernas») ni antes («las piernas molidas»). Con zona va al cuaderno. */
const MOLIDA_SIN_ZONA = new RegExp(
  `(?<!${ZONA} )\\bmolid[oa]s?\\b(?!\\s+(?:(?:de|del|en|por)\\s+)?(?:(?:la|las|el|los|mis|mi)\\s+)?${ZONA}\\b)`,
)
/** «Fresca» dicho de la PERSONA («me siento fresca», «amanecí fresco»), no del clima ni de la ensalada (sonda del 8-nov). */
const FRESCA_DE_LA_PERSONA =
  /\b(?:me siento|siento|estoy|ando|amaneci|me levante|me desperte|quede|me veo)(?: muy| re| super| bien| tan)? (?:fresc[oa]|fresquit[oa])\b|\bfresc[oa] como (?:una )?lechuga\b|^fresc[oa]$/
/** «Con toda» es ánimo solo si cierra la frase o lo sigue una palabra de ánimo; «con toda la pereza» no (sonda del 8-nov). */
const CON_TODA = /\bcon toda(?:\s+(?:(?:la\s+)?(?:energia|ganas|actitud|fuerza|motivacion|pila|bateria|disposicion)|(?:(?:al|a la|a|para el|para la)\s+)(?:gym|gimnasio|entreno|entrenamiento|rutina|entrenar)))?$/

const POR_CAMPO: Partial<Record<CampoCheckin, Regla[]>> = {
  estres: [
    [/\ba tope\b/, { valor: 'MUCHO' }],
    // «Fresco» en Colombia también es tranquilo (8-nov, Bryan: sí).
    [FRESCA_DE_LA_PERSONA, { valor: 'POCO' }],
  ],
  // «Con toda» y «a tope» se invierten según el campo (8-nov, Bryan: sí). Sin pregunta ni área no se llega aquí.
  motivacion: [
    [CON_TODA, { valor: 'MUCHO' }],
    [/\bcon (?:todas las|muchas|mil) ganas$/, { valor: 'MUCHO' }],
    [/\ba tope\b/, { valor: 'MUCHO' }],
  ],
  cansancio: [
    // «Molida» sola = muy cansada («de tanto trabajar» también). Con zona del cuerpo es recuperación: va al cuaderno.
    [MOLIDA_SIN_ZONA, { valor: 'MUCHO' }],
    [FRESCA_DE_LA_PERSONA, { valor: 'POCO' }],
    [CON_TODA, { valor: 'POCO' }],
    [/\benergia a tope\b|\ba tope de energia\b/, { valor: 'POCO' }],
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
    // «No descansé mal» NO es MALA: el lookahead lo suelta a la regla de «descansé mal», que la negación anula.
    [/\bno (?:descanse|he descansado)(?: bien| nada| casi nada| mucho)?(?! (?:mal|fatal|pesimo))\b/, { valor: 'MALA' }],
    [/\bdescanse (?:(?:super|muy|re|tan) )?(?:bien|rico|profundo|perfecto|de maravilla|de lujo|como nunca)\b/, { valor: 'BUENA' }],
    [/\bdescanse (?:(?:super|muy|re|tan) )?(?:mal|fatal|pesimo|horrible)\b/, { valor: 'MALA' }],
    [/\bdescanse (poco|poquito)\b/, { entre: ['REGULAR', 'MALA'] }],
    [/\bdesvel/, { valor: 'MALA' }],
    [/\bno dormi (casi )?nada\b/, { valor: 'MALA' }],
    // «Poquito» es cantidad, no calidad: la persona elige (y las horas se preguntan aparte).
    [/\bdormi (poquito|poco)\b/, { entre: ['REGULAR', 'MALA'] }],
  ],
  rendimiento: [
    [/\bre bien\b/, { valor: 'BUENA' }],
    // «Pesada después del almuerzo» es digestión, no rendimiento (8-nov, Bryan: no se mapea).
    // La palabra de comida puede ir antes («el desayuno me cayó pesado») o después: se mira toda la frase.
    [/^(?!.*\b(?:almuerzo|almorzar|comida|comi|comer|comiendo|cena|cenar|desayuno|desayunar|merienda|digest\w*)\b).*\bsenti\b.*\bpesad[oa]\b/, { valor: 'MALA' }],
    // «Me cayó pesado» es del entreno solo si la frase habla del entreno; «me cayó pesado el helado» es comida.
    [/^(?=.*\b(?:entreno|entrenamiento|gym|gimnasio|rutina|sesion|ejercicio|series?|sentadillas?|cardio|pesas)\b).*\bcay(?:o|eron)\b.*\bpesad[oa]s?\b/, { valor: 'MALA' }],
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
