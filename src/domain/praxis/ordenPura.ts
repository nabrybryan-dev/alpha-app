import { sinTildes } from './riesgo'

/**
 * ORDEN PURA (regla estructural, 11-nov-2026): una orden de organizar, de navegar o un saludo local solo se
 * resuelve en el teléfono si es UNA orden limpia, de UNA sola cláusula. Si trae una segunda cláusula pegada
 * («pon el agua arriba, me quiero hacer daño»), no se resuelve en local: el camino sigue al servidor, que tiene
 * el lector de riesgo con modelo. No hay lista de palabras de riesgo aquí; solo la forma de la frase.
 *
 * Una cláusula nueva se reconoce por: coma, punto y coma, punto o signo de cierre seguido de más texto; un nexo
 * de explicación o contraste («pero», «porque», «aunque», «ya que», «es que»); o «y» seguido de un verbo o de una
 * primera persona («y me», «y no», «y quiero»).
 * Una muletilla al principio NO es una segunda cláusula («oye, ponme el agua arriba», «a ver, muéstrame mi semana»),
 * ni una cortesía al final («ponme el agua arriba, porfa»).
 *
 * Se equivoca hacia el lado seguro: una lista con comas («oculta el agua, el álbum») va al servidor en vez de
 * resolverse en local. Cuesta una espera; lo contrario podía costar una persona.
 */

/** Lo que se dice antes de la orden y no es otra cláusula. Mismo espíritu que `MULETILLAS` de la gramática. */
const MULETILLA_SOLA = /^((hey|ey|oye|oiga|hola|holi|buenas|buenos dias|buenas tardes|buenas noches|que mas|quiubo|praxis|mira|uy|ay|pues|bueno|entonces|listo|dale|ojo|a ver|disculpa|perdon|porfa|porfavor|por favor|la verdad|honestamente|ok|okay|vale|oiga usted)\s*)+$/
/** Cortesías que pueden cerrar la orden. */
const COLA_DE_CORTESIA = /^((porfa|porfavor|por favor|gracias|ya|ahora|ahorita|please|si|sí|quieres|puedes)\s*)+$/
const NEXO = /\b(pero|porque|aunque|ya que|es que|sino que|por eso|entonces yo)\b/
/** «y» + una primera persona o un verbo. Palabras de función que acaban en «o» y NO son verbo, aparte. */
const Y_NO_VERBO = /^(todo|todos|lo|luego|otro|otra|poco|mucho|mismo|primero|ultimo|despues|ahorita|solo|como|sino|tambien|mi|este|ese|ahi|asi|de|e|sobre|entre|hasta|desde|ante)$/
const Y_CLAUSULA = /\by\s+(me|yo|te|se|no|ya|ni|[a-zñ]+(?:o|oy|e|i|ia|ia?mos|aba|ia|are|ire))\b/

function sinMuletillasIniciales(t: string): string {
  let r = t.trim().replace(/^[¿¡\s]+/, '')
  for (;;) {
    // Solo una muletilla seguida de COMA: «hola. no tengo ganas de nada» son dos oraciones, no un rodeo.
    const m = r.match(/^([^,;.!?:]{1,30}),\s*(.*)$/s)
    if (!m || !MULETILLA_SOLA.test(m[1]!.trim() + ' ')) return r
    r = m[2]!.replace(/^[¿¡\s]+/, '')
  }
}

export function esOrdenPura(frase: string): boolean {
  let t = sinMuletillasIniciales(sinTildes(frase))
  // Cierre: signos finales sueltos y una cortesía («..., porfa») no son otra cláusula.
  t = t.replace(/[\s.!?]+$/, '')
  const cola = t.match(/^(.*?)[,;]\s*([^,;.!?]+)$/s)
  if (cola && COLA_DE_CORTESIA.test(cola[2]!.trim() + ' ')) t = cola[1]!
  if (/[,;]/.test(t)) return false
  if (/[.!?]\s*\S/.test(t)) return false
  if (NEXO.test(t)) return false
  // Rodeos de pedir que llevan una «y» y no son otra cláusula («cambiemos el orden de la app y colócame el agua primero»).
  t = t.replace(/\b(cambiemos|cambia|cambiame) el orden de la app y\b|\b(hazme el favor|me ayudas a|ayudame a) y\b/g, ' ')
  const y = t.match(Y_CLAUSULA)
  if (y && !Y_NO_VERBO.test(y[1]!)) return false
  return true
}
