/**
 * La limpieza del dictado antes de mandar lo dicho: la misma idea que «Alpha Dictado»
 * (Murmur), en TypeScript y sin modelo (0 ms, nada sale del teléfono por esto).
 *
 * Solo quita lo que NO es palabra en ningún idioma: las pausas sonoras (eh, ehh, mmm,
 * emm…) y la «E.» suelta que el reconocedor escribe cuando alguien alarga un «eh» y lo
 * toma por una frase entera. NUNCA toca los marcadores del español —«este», «pues»,
 * «bueno», «o sea», «digamos»—: dicen algo de cómo se siente la persona y quitarlos
 * sería reescribirla. Tampoco toca la «e» de «padre e hijo».
 *
 * Después, un diccionario de correcciones de PALABRA ENTERA para el vocabulario de Alpha
 * que el reconocedor oye mal («R y R» → «RIR»). Cada entrada es una sustitución exacta:
 * nada de «parecidos», porque un arreglo por semejanza cambiaría «en el tanque» por algo
 * que la persona no dijo.
 */

/** Pausas sonoras: no son palabra en ningún idioma. «ah», «oh» y «eh?» como pregunta SÍ lo son en español… salvo «eh», que el dictado casi siempre trae como pausa. */
const PAUSA = /^(?:e+h+|e{2,}|e+h*m+|m{2,}|h+m+|u+h*m+|e+r+m+)$/i

/** Correcciones de palabra entera (sin distinguir mayúsculas). El orden importa: las largas primero. */
export const CORRECCIONES: readonly (readonly [string, string])[] = [
  ['erre i erre', 'RIR'],
  ['r y r', 'RIR'],
  ['r i r', 'RIR'],
  ['r.i.r.', 'RIR'],
  ['rir', 'RIR'],
  ['r p e', 'RPE'],
  ['rpe', 'RPE'],
  ['gobled', 'goblet'],
  ['goblé', 'goblet'],
  ['goblet', 'goblet'],
  ['bulgara', 'búlgara'],
  ['bulgaras', 'búlgaras'],
  ['hip trust', 'hip thrust'],
  ['mio reps', 'myo-reps'],
  ['myo reps', 'myo-reps'],
]

const LETRA = '[\\p{L}\\p{N}]'
const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')
const REGLAS = CORRECCIONES.map(([de, a]) => ({ re: new RegExp(`(?<!${LETRA})${escapar(de)}(?!${LETRA})`, 'giu'), a }))

/** Dónde había una pausa: un carácter de uso privado, que ningún reconocedor escribe. */
const MARCA = ''
const MARCA_Y_COMA = new RegExp(MARCA + '\\s*[,;:]?', 'g')
/** Quita las pausas sonoras sueltas, con la coma que las acompaña («Eh, dormí» → «dormí»). */
function quitarPausas(texto: string): string {
  return texto.replace(/(^|[\s,;:¿¡])([\p{L}]+)(?=$|[\s,;:.!?…])/gu, (m, antes: string, palabra: string) => (PAUSA.test(palabra) ? antes + MARCA : m))
}

/** La «E.» (o «Eh.») que el reconocedor escribe como frase entera por un «eh» alargado. */
function quitarEsSueltas(texto: string): string {
  return texto.replace(/(^|[.!?…]\s*)E\.(?=\s|$)/gu, '$1')
}

function ordenar(texto: string): string {
  return texto
    .replace(MARCA_Y_COMA, '') // la pausa y su coma
    .replace(/\s+([,;:.!?…])/g, '$1') // nada de espacio antes de un signo
    .replace(/([,;:])(?:\s*[,;:])+/g, '$1') // «dormí, , bien» → «dormí, bien»
    .replace(/^[\s,;:.]+/, '') // lo que quedó al principio
    .replace(/[\s,;:]+([.!?…]|$)/g, '$1') // ni coma colgando al final
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Limpia lo dictado. Devuelve '' si no quedaba nada que fuera palabra. */
export function limpiarDictado(crudo: string): string {
  if (!crudo) return ''
  const mayus = /^\p{Lu}/u.test(crudo.trim())
  let t = ordenar(quitarEsSueltas(quitarPausas(crudo.replace(/\s+/g, ' '))))
  for (const { re, a } of REGLAS) t = t.replace(re, a)
  if (mayus && t) t = t.charAt(0).toLocaleUpperCase('es') + t.slice(1)
  return /[\p{L}\p{N}]/u.test(t) ? t : ''
}

const plano = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zñ ]/g, ' ').replace(/\s+/g, ' ').trim()
const ORDENES_ESCRIBIR = new Set([
  'escribir', 'quiero escribir', 'voy a escribir', 'prefiero escribir', 'dejame escribir', 'mejor escribo', 'escribo',
  'despliega la barra', 'desplegar la barra', 'despliegue la barra', 'abre la barra', 'abrir la barra', 'abra la barra', 'muestra la barra', 'mostrar la barra',
  'abre el teclado', 'abrir el teclado', 'muestra el teclado', 'mostrar el teclado', 'teclado',
])
/** ¿Lo dicho es SOLO la orden de abrir la barra para escribir? (Con «Praxis» delante o detrás también.) No se manda: abre la barra. */
export function esOrdenDeEscribir(texto: string): boolean {
  const p = plano(texto).replace(/^praxis /, '').replace(/ praxis$/, '').replace(/^por favor /, '').replace(/ por favor$/, '')
  return ORDENES_ESCRIBIR.has(p)
}
