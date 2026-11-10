import { normalizarNombre } from '../ordenes/normalizarNombre'
import { DE_SALUD } from '../ordenes/ordenesDeVoz'
import { interpretarPedidoDeshacer } from '../deshacer/pedido'
import { filtroDeRiesgo } from '../riesgo'

/**
 * LA GRAMÁTICA DE ORGANIZACIÓN (fase O2 del diseño `docs/specs/2026-11-09-praxis-interactiva-organiza-la-app-diseno.md`):
 * de una frase dicha a «qué quiere hacer con la app», sin modelo y sin guardar nada.
 *
 * Lista cerrada, como las órdenes del salón y el deshacer de registros: la frase tiene que EMPEZAR con la orden
 * («oculta Logros», «ponme el agua arriba»). «Mi hermano ocultó todo» o «toca ocultar eso» no empiezan con ella:
 * devuelven `ninguno`. Solo lee el VERBO; qué pieza es la resuelve `app/organizacionPraxis.ts` con el catálogo.
 *
 * Orden de decisión, el del enrutador: riesgo primero. Una orden de organizar que además habla de salud
 * («oculta lo de la rodilla que me duele») es `riesgo` y nunca organiza. Una frase de salud SIN orden de organizar
 * no es de este módulo: `ninguno`, y la atiende el filtro de riesgo del enrutador como siempre.
 *
 * El deshacer de REGISTROS («quita lo último que anoté», «deshaz lo del agua») es de `deshacer/pedido.ts` y gana
 * aquí: «quita el agua» (la pieza) no está en su lista cerrada, así que sí es de organización; «deshaz lo del agua»
 * sí está, y no lo es.
 *
 * Las etiquetas de Bryan sobre 20 frases (9-nov) afinaron los verbos: «borra el ranking» y «no quiero que me salga el álbum»
 * esconden; «regrésamelo todo como venía» restablece; «ordéname hoy como lo tenía antes» deshace; «pon el agua de primera» trae;
 * «qué tengo escondido» lista lo oculto; «me aburre el álbum» ofrece esconderlo.
 *
 * Fuera de esta primera versión (no se adivina): frases con rodeo («¿puedes ocultar…?», «quiero que ocultes…»),
 * varias órdenes en una frase y órdenes a medias («ocúltalo» sin nombre se contesta preguntando qué).
 */

export type VerboDeOrganizacion =
  | 'traer'
  | 'fijar'
  | 'ocultar'
  | 'mover_arriba'
  | 'mover_abajo'
  | 'deshacer'
  | 'restablecer'
  | 'listar'
  /** «qué tengo escondido»: lo que la persona ya ocultó. */
  | 'listar_ocultas'
  /** Una queja («me aburre el álbum»): no manda nada, Praxis OFRECE esconderlo y la persona decide. */
  | 'sugerir_ocultar'

export type PedidoDeOrganizacion =
  /** Era una orden de organizar, pero habla de salud o de riesgo: no se organiza; sigue el camino de seguridad. */
  | { tipo: 'riesgo' }
  /** `frase` es la frase limpia (sin tildes, signos ni saludo) para buscar la pieza con el catálogo. */
  | { tipo: 'pedido'; verbo: VerboDeOrganizacion; frase: string }
  | { tipo: 'ninguno' }

/** Sin tildes, mayúsculas ni signos, con un solo espacio entre palabras. */
export function limpiarFrase(frase: string): string {
  return normalizarNombre(frase)
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const SALUDO = /^((oye|hola|praxis|por favor|porfa|porfavor|disculpa)\s+)+/

const DESHACER_CAMBIO =
  /^((dejalo|dejala|dejalos|dejalas|deja todo|ponlo|ponla) como (estaba|estaban|antes)|(deshaz|deshacer|deshace) (el cambio|ese cambio|lo que cambiaste|el ultimo cambio)|vuelve a como (estaba|estaban)|(ordena\w*|regres\w*|devuelv\w*|ponme|pon|dejame|deja)\b.*\bcomo (lo |la |los |las )?(tenia|tenias|estaba|estaban)( antes)?)\s*$/
const RESTABLECER =
  /^((restablece|restablecer|reinicia|resetea)( todo| mi organizacion| la app)?|((regres|devuelv)\w*|vuelve a|dejalo|deja todo|ponlo todo)( todo)? como (venia|viene|de fabrica|al principio))\s*$/
const LISTAR = /^que (puedo|se puede|partes puedo|cosas puedo) (ocultar|mover|ordenar|cambiar)\b/
const LISTAR_OCULTAS =
  /^((que|cuales|cuantas)( cosas| partes| pestanas| tarjetas| piezas| pantallas)? (tengo|hay|he|tengo yo) (escondid\w+|ocult\w+)|(que|cuales)( cosas| partes| pestanas| tarjetas| piezas)? (escondi|oculte|ocultaste|escondiste)\b)/
const QUEJA = /^(me (aburre|aburren|estorba|estorban|sobra|sobran)|no uso|ya no uso|no me (sirve|sirven))\b/
const MOVER = /^(ponme|pon|ponla|ponlo|sube|subeme|subela|subelo|baja|bajame|bajala|bajalo|mueve|muevela|muevelo|pasa|pasame)\b/
const PON_SIN_LUGAR = /^(ponme|pon|ponla|ponlo)\b/
const HACIA_ARRIBA = /\b(arriba|primero|al principio)\b|^(sube|subeme|subela|subelo)\b/
const HACIA_ABAJO = /\b(abajo|ultimo|al final)\b|^(baja|bajame|bajala|bajalo)\b/
const FIJAR = /^((dejame|deja|dejalo|dejala|mantenme)\b.*\b(a la vista|siempre|visible)\b|(fija|fijame|fijalo|fijala)\b)/
const OCULTAR =
  /^(oculta|ocultame|ocultalo|ocultala|esconde|escondeme|quita|quitame|saca|sacame|borra|borrame|borralo|borrala|elimina|eliminame|no me (muestres|ensenes|pongas|saques)|no quiero que (me )?(salga|salgan|aparezca|aparezcan|muestre|muestren|ponga|pongan)|quiero ocultar|quiero esconder|ya no quiero ver|no quiero ver)\b/
const TRAER = /^(muestrame|muestra|abreme|abre|traeme|trae|ensename|ensena|llevame|quiero ver|quisiera ver|vamos a|ir a|ve a|ver)\b/

function verboDe(t: string): VerboDeOrganizacion | null {
  if (DESHACER_CAMBIO.test(t)) return 'deshacer'
  if (RESTABLECER.test(t)) return 'restablecer'
  if (LISTAR.test(t)) return 'listar'
  if (LISTAR_OCULTAS.test(t)) return 'listar_ocultas'
  if (QUEJA.test(t)) return 'sugerir_ocultar'
  if (MOVER.test(t)) {
    if (HACIA_ARRIBA.test(t)) return 'mover_arriba'
    if (HACIA_ABAJO.test(t)) return 'mover_abajo'
    // «pon el agua» sin decir dónde es traerla (así lo etiquetó Bryan el 9-nov); «mueve el agua» sin dónde no se adivina.
    return PON_SIN_LUGAR.test(t) ? 'traer' : null
  }
  if (FIJAR.test(t)) return 'fijar'
  if (OCULTAR.test(t)) return 'ocultar'
  if (TRAER.test(t)) return 'traer'
  return null
}

export function leerPedidoDeOrganizacion(dicho: string): PedidoDeOrganizacion {
  if (interpretarPedidoDeshacer(dicho)) return { tipo: 'ninguno' }
  const frase = limpiarFrase(dicho)
  const t = frase.replace(SALUDO, '')
  const verbo = verboDe(t)
  if (!verbo) return { tipo: 'ninguno' }
  if (filtroDeRiesgo(dicho) || DE_SALUD.test(t)) return { tipo: 'riesgo' }
  return { tipo: 'pedido', verbo, frase: t }
}
