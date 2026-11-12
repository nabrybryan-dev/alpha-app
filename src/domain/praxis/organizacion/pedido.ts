import { normalizarNombre } from '../ordenes/normalizarNombre'
import { DE_SALUD } from '../ordenes/ordenesDeVoz'
import { interpretarPedidoDeshacer } from '../deshacer/pedido'
import { filtroDeRiesgo } from '../riesgo'
import { esOrdenPura } from '../ordenPura'
import { VOCABULARIO_DE_ORDENES, corregirPalabras } from './dictado'

/**
 * LA GRAMÁTICA DE ORGANIZACIÓN (fase O2 del diseño `docs/specs/2026-11-09-praxis-interactiva-organiza-la-app-diseno.md`):
 * de una frase dicha a «qué quiere hacer con la app», sin modelo y sin guardar nada.
 *
 * Lista cerrada, como las órdenes del salón y el deshacer de registros. Solo lee el VERBO (la intención); qué pieza
 * es la resuelve `app/organizacionPraxis.ts` con el catálogo.
 *
 * Cómo habla la gente (aprendido de 285 frases escritas a ciegas, 10-nov): casi nunca empieza con el verbo pelado.
 * Antepone muletillas («oye Praxis», «mira», «uy», «pues como que mejor»), pide con rodeo («necesito que me muestres»,
 * «quiero que desaparezca»), conjuga distinto (subjuntivo, «quitas»), pone el objeto primero («el historial más
 * arriba porfa», «la rutina esté siempre visible») o el verbo al final («ese cuadro de ahí bórralo»). Por eso, antes
 * de decidir, se quitan las muletillas y los rodeos del principio; lo que NO se hace es buscar un verbo en cualquier
 * parte de la frase: «mi hermano me dijo oculta el álbum» sigue sin ser una orden.
 *
 * Orden de decisión, el del enrutador: riesgo primero. Una orden de organizar que además habla de salud
 * («oculta lo de la rodilla que me duele») es `riesgo` y nunca organiza. Una frase de salud SIN orden de organizar no
 * es de este módulo: `ninguno`, y la atiende el filtro de riesgo del enrutador, que va antes.
 *
 * El deshacer de REGISTROS («quita lo último que anoté», «deshaz lo del agua») es de `deshacer/pedido.ts` y gana aquí.
 * «quita eso» sin decir qué es ambiguo (registro o pantalla) y se pregunta.
 *
 * Fuera de esta versión: varias órdenes en una frase y frases que solo se entienden con lo dicho antes.
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
  /** «déjame ver solo lo importante»: esconder de una vez todo lo libre (Bryan, 9-nov), con una tarjeta que dice cuántas cosas. */
  | 'solo_lo_importante'
  /** «quita eso»: puede ser quitar lo último que anotó o esconder algo de la pantalla; se le pregunta cuál (Bryan, 9-nov). */
  | 'quitar_ambiguo'

export type PedidoDeOrganizacion =
  /** Era una orden de organizar, pero habla de salud o de riesgo: no se organiza; sigue el camino de seguridad. */
  | { tipo: 'riesgo' }
  /**
   * `frase` es la frase limpia (sin tildes, signos, muletillas ni rodeos) para buscar la pieza con el catálogo.
   * `borrar`: dijo «borra» o «elimina»; Praxis solo esconde la tarjeta y debe decirlo («no borra tus datos»).
   */
  | { tipo: 'pedido'; verbo: VerboDeOrganizacion; frase: string; borrar?: boolean; suave?: boolean }
  | { tipo: 'ninguno' }

/** Sin tildes, mayúsculas ni signos, con un solo espacio entre palabras. */
export function limpiarFrase(frase: string): string {
  return normalizarNombre(frase)
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Lo que se dice antes de la orden sin cambiarla. Solo al principio, y varias veces seguidas. */
const MULETILLAS =
  /^((hey|oye|oiga|hola|praxis|mira|uy|ay|pues|bueno|entonces|listo|dale|ojo|a ver|disculpa|porfa|porfavor|por favor|la verdad|honestamente|como que mejor|hazme el favor y|hazme el favor de|hazme el favor|me puedes|puedes|podrias|me ayudas a|ayudame a|necesito que|quiero que|quisiera que|necesito|revisemos si|revisa si|revisame si|a ver si|mira si|ve si|cambiemos el orden de la app y|cambia el orden de la app y)\s+)+/

// ---- Intenciones, de la más específica a la más general ----

const CAMBIO_ATRAS =
  /^((dejalo|dejala|dejalos|dejalas|deja todo|ponlo|ponla) como (estaba|estaban|antes)|(deshaz|deshazlo|deshacer|deshace|deshaz el cambio)\b|vuelve atras|volver atras|(devuelve|devuelvelo|devuelvela|regresa|regresalo|regresala|regresame|devuelveme|vuelve|vuelvelo|volver|devolver)\b.*\b(como estaba|como estaban|como antes|a como estaba|como lo tenia|como lo tenias|hace un momento|a antes)|(ordena\w*|ponme|pon|dejame|deja)\b.*\bcomo (lo |la |los |las )?(tenia|tenias|estaba|estaban)( antes)?|(no )?(pon|ponme|dejame|deja) lo de antes|vuelve a como (estaba|estaban))(\s+(porfa|por favor))?\s*$/
const CAMBIO_ATRAS_SUELTO =
  /\b(ultimo cambio|ese cambio|ese ultimo cambio)\b|^(eso|lo) que (cambiaste|hiciste)\b.*\b(regresalo|devuelvelo|quitalo|deshazlo|regresala|devuelvela)\b|^(cancela|cancelalo|anula|anulalo|revierte|reviertelo)\b|\bvolvamos a como (estaba|estaban|antes)\b|^(dejame|deja|ponme|pon) lo anterior\b/
const RESTABLECER_A_FABRICA =
  /\b(de fabrica|por defecto|como el primer dia|como al principio|como al comienzo|como estaba al principio|como venia|como viene|configuracion inicial|configuracion original|(la )?(app|aplicacion) de siempre|como (estaba|era) antes (la app|la aplicacion|todo)|a cero|desde cero|la organizacion completa)\b/
const RESTABLECER_VERBO = /^(restablece|restablecer|reinicia|resetea|reseteame|reinicialo|limpiame la organizacion|limpia la organizacion)\b/
const RESTABLECER_OBJETO = /\b(todo|la app|la pantalla|ponlo|dejalo|deja|quede|quedar|este|regresa|regresalo|devuelve|devuelvelo|vuelve|vuelve a|ya la cague)\b/
const LISTAR_PUEDO = /^que (puedo|se puede|partes puedo|cosas puedo) (ocultar|mover|ordenar|cambiar)\b/
// «oculte» y «quite» suenan igual dichos como pasado («qué oculté») o como orden («que no se oculte»): solo cuentan
// pegados a la pregunta («qué quité», «lo que escondí»), nunca sueltos.
const LISTAR_ESCONDIDAS =
  /\b(que|cuales|cuantas) (cosas |partes? |areas? |secciones |opciones |apartados |pestanas |tarjetas |piezas |pantallas )?(de (la|mi) (app|aplicacion) )?(tengo|hay|he|tengo yo|es lo que) (escondid\w+|ocult\w+|quitad\w+|guardad\w+ fuera de la vista|fuera de la vista|que no me esta apareciendo|no me esta apareciendo|no se esta viendo|no se ve)\b|^(dime |recuerdame )?(que|cuales|cuantas|lo que|fue lo que)\s+(escondi|oculte|quite|ocultaste|escondiste|quitaste)\b|\b(que|cuales) (he|has) (ocultado|escondido|quitado)\b|^(lista|listame|ensename la lista|muestrame la lista|dame la lista|dime|recuerdame)\b.*\b(escondid\w+|ocult\w+|quitad\w+|no se (esta )?viendo)\b|\bya no me acuerdo cuales\b|\bcuales (son|eran)\b.*\b(escond|ocult|quit)/
// Solo cuenta si la frase TERMINA en «lo importante»: «muéstrame solo lo básico de mi nutrición» pide otra cosa y no
// activa un modo que esconde media app (hallazgo de la revisión adversarial, 10-nov).
const SOLO_LO_IMPORTANTE =
  /\b(solo|nomas|nada mas|unicamente|sin adornos solo)( lo| los| las cosas| las)? (importante|importantes|esencial|esenciales|escencial|escenciales|necesario|necesarios|basico|basicos|principal|principales|fundamental|vital|que uso|que de verdad uso)( hoy)?( y esconde el resto| y oculta el resto| y quita el resto)?(\s+(porfa|por favor))?\s*$|\b(modo minimalista|modo simple|modo enfoque|simplificame la app|simplifica la app|simplifica la pantalla|version light|version simple)\b|\b(esconde|oculta|quita)\b.*\b(el resto|todo lo demas|lo demas|todo lo que sobra|todo lo que no sea (necesario|importante|esencial))\b|\b(sin adornos|(la )?(app|pantalla|aplicacion) limpia|limpia la (app|pantalla))\b|\blo (basico|esencial|importante|principal) no mas\b|^(dejame|deja) lo (principal|vital|esencial|importante)\b|\b(reduce|reducelo|reduceme) todo a lo (basico|esencial|importante)\b|\bquita lo demas y deja lo\b/
// Quejas de ABURRIMIENTO o de inutilidad. A propósito NO entran las emocionales («me da ansiedad», «me da rabia»):
// eso no es un pedido de organizar y lo atiende la conversación, no esta gramática.
const QUEJA_FIN =
  /\b(sobra|sobran|no me sirve|no me sirven|ni lo miro|ni la miro|ni los miro|ni las miro|ni lo veo|jamas (la|lo|las|los) abro|nunca (lo|la|las|los) (abro|uso|miro)|(lo|la|las|los) (jamas|nunca) (abro|uso|miro)|no (lo|la|las|los) uso|me parece inutil|me parece una perdedera|me tiene(n)? (mamad[oa]s?|harto|hartos)|no me interesa(n)?|no (lo|la|las|los) necesito|no (me )?aporta(n)?|(llena|llenan) (la app|la pantalla)|no (lo |la |los |las )?necesito ver(lo|la|los|las)?)\b|\bme (aburre|aburren|estorba|estorban|fastidia|fastidian)\s*(porfa|por favor)?\s*$/
const QUEJA_INICIO = /^(a mi )?(me )?(aburre|aburren|estorba|estorban|fastidia|fastidian)\b|^(que pereza|que fastidio)\b/
const FIJAR_VERBO = /^(fija|fijame|fijalo|fijala|ancla|anclame|anclalo|anclala|mantenme)\b|^(dejame|deja|dejalo|dejala)\b.*\b(a la vista|siempre|visible|fij[oa]|pegad[oa])\b/
const FIJAR_OBJETO =
  /\bque (quede|este|se quede|siga|esta)\b.*\b(fij[oa]|siempre visible|siempre a la vista|a la vista|pegad[oa]|anclad[oa])\b|\b(no quiero que|que no) (se me |se |me )?(oculte|esconda|desaparezca|escondan|vayan a esconder|se vaya|se vayan|quite|quiten)\b|\bsiempre (visible|a la vista|ahi|ver)\b|\bque quede siempre\b|\b(dejala|dejalo|dejalas|dejalos|quede|este|esta|ponla|ponlo)\b.*\bfij[oa]s?\b|\bno (vayas a|me vayas a)\b.*\b(quitar|ocultar|esconder)\w*\b.*\b(nunca|jamas)\b|\bno (se me |me )?(quite|oculte|esconda|desaparezca)\b.*\b(nunca|jamas)\b|\bque no se me (quite|oculte|esconda|desaparezca)\b/
const MOVER_VERBO = /^(me )?(ponme|pon|ponla|ponlo|sube|subeme|subela|subelo|baja|bajame|bajala|bajalo|mueve|muevela|muevelo|pasa|pasame|manda|mandame|mandalo|mandala|llevame|llevalo|llevala|lleva|llevate|colocame|coloca|ubica|ubicame|deja|dejame|dejalo|dejala|dejalos|dejalas|subir|bajar|mover|poner|colocar|colocamos|ponemos|pongamos|coloquemos|subamos|bajemos)\b/
const HACIA_ARRIBA = /\b(arriba|primero|de primero|de primeras|donde (la|lo) vea|al principio|encima|mas arriba|hasta arriba|al tope|a la cabeza|en lo alto|en la cima)\b|^(sube|subeme|subela|subelo)\b|\b(subelo|subela|subeme)\b/
const HACIA_ABAJO = /\b(abajo|ultimo|de ultimo|de ultimas|al final|al fondo|hasta el fondo|hasta el final|debajo|mas abajo|pa abajo|para abajo|hasta abajo)\b|^(baja|bajame|bajala|bajalo|bajalos|bajalas)\b|\b(bajalo|bajala|bajame|bajalos|bajalas)\b/
const MOVER_OBJETO_PRIMERO = /^(quiero |necesito |que |el |la |los |las |lo |mi |mis |ese |esa |esos |esas )/
const PON_SIN_LUGAR = /^(ponme|pon|ponla|ponlo)\b/
const QUITA_FAMILIA = /^(me )?(quita|quitas|quitame|quitalo|quitala|quitalos|quitalas|borra|borras|borrame|borralo|borrala|elimina|eliminas|eliminame|saca|sacas|sacame|retira|retirame|desaparece|desapareces|desaparezca|desaparezcas|quite|quites|borre|borres|elimine|elimines|saque|saques)\b/
const DEMOSTRATIVO = /\b(eso|esto|esa vaina|ese cuadro|ese pedazo|esa cosa|esa parte|aquello|ese bloque|eso que sale (ahi|aqui))\b/
/** El verbo al FINAL («ese cuadro de ahí bórralo»): solo cuenta junto a un demostrativo, que es lo que no se sabe qué es. */
const QUITA_AL_FINAL = /\b(quitalo|quitala|borralo|borrala|sacalo|sacala)\s*(ya|porfa|por favor)?\s*$/
const OCULTAR_VERBO =
  /^(me )?(oculta|ocultas|ocultar|esconder|ocultame|ocultalo|ocultala|ocultalos|ocultalas|esconde|escondes|escondeme|escondelo|escondela|oculte|ocultes|esconda|escondas|tapa|tapame|tape|tapes)\b/
const OCULTAR_FRASE =
  /^(no me (muestres|ensenes|pongas|saques|salga|aparezca|muestre)|no quiero que (me )?(salga|salgan|aparezca|aparezcan|muestre|muestren|ponga|pongan|se vea|se vean)|quiero (ocultar|esconder|quitar)|ya no (quiero ver|mas con|quiero que|aparezca|me muestres)|que ya no (aparezca|salga|se vea)|no quiero ver)\b|\b(ocultalo|ocultala|ocultalos|ocultalas|escondelo|escondela|escondelos|borralo|borrala|quitalo|quitala|quitalos|quitalas)\s*(porfa|por favor)?\s*$|\b(de la vista|de la pantalla)\b.*$|\bya no (aparezca|aparezcan|salga|salgan|se vea|se vean)\b/
const VER_VERBO =
  /^(me )?(dejame ver|dejame mirar|muestrame|muestra|muestras|muestres|muestre|ensename|ensena|ensenes|abreme|abre|abres|abras|traeme|trae|traelo|traela|traigas|quiero ver|quisiera ver|necesito ver|vamos a|ve a|ir a|ver|pasame a|pasame al|llevame a|llevame al|ponme|pon|saca|sacame|saques|aparezca|aparezcan|pongas|ponga|revisa|revisame|revisemos|revisar|chequea|chequeame|miremos|veamos|mostrar|ensenar|abrir|traer)\b/
// Preguntas sobre LO PROPIO que piden ver una pieza («cuánta agua llevo», «cómo voy de hidratación», «me enseñas el contador»).
// «cuánta proteína debería comer» NO entra: no habla de lo que la persona lleva ni de lo que le falta.
const VER_LO_PROPIO = /\b(cuant[oa]s?)\b.*\b(llevo|he tomado|me falta|me faltan)\b|\bcomo voy (de|con|en)\b|\b(ya )?(tome|he tomado) suficiente\b|\bme (ensenas|muestras|puedes mostrar|puedes ensenar)\b|^como (esta|va|van|andan|estan) (mi|mis|la|el|las|los)\b/
const VER_FRASE = /\bcomo (hago|puedo|hago pa|hago para) (ver|encontrar|sacar)\b|\b(otra vez|de nuevo)\b.*\b(quiero ver|tr[aá]elo|traelo|mostrar)\b|\b(traelo|traela|traelos|traelas)\s*(porfa|por favor)?\s*$|\b(aparezca|aparezcan)\b.*\b(pantalla|principal)\b|\bsacame\b.*\b(aqui|aca|pantalla)\b|\bsaques\b.*\b(aqui|aca|pantalla)\b/
/** Una pregunta de entrenamiento o de nutrición no es una orden de organizar aunque lleve «muéstrame». */
const ES_PREGUNTA_DE_CONTENIDO = /\bcomo (se |lo |la |los |las )?(hace|hacen|hago|respiro|respirar|debo|puedo|se)\b(?!.*\b(ver|encontrar|sacar)\b)|\bpara que (sirve|es)\b|\bpor que\b|\bcuanto\b|\bcuantas\b/

interface Intencion {
  verbo: VerboDeOrganizacion
  borrar?: boolean
  /**
   * «revisa…» pide ver algo, pero también abre preguntas de contenido («revisemos qué comidas me recomiendas»): si la
   * frase no nombra ninguna pieza, NO se contesta «eso no existe», se deja a la conversación.
   */
  suave?: boolean
}
const REVISAR = /^(me )?(revisa|revisame|revisemos|revisar|chequea|chequeame|miremos|veamos)\b/

/** Hacia dónde manda mover la frase, o `null` si no manda mover nada. */
function direccionDeMover(t: string): 'mover_arriba' | 'mover_abajo' | null {
  const arriba = HACIA_ARRIBA.test(t)
  const abajo = HACIA_ABAJO.test(t)
  if (MOVER_VERBO.test(t) && (arriba || abajo)) return abajo && !arriba ? 'mover_abajo' : 'mover_arriba'
  if (MOVER_OBJETO_PRIMERO.test(t) && arriba !== abajo) return arriba ? 'mover_arriba' : 'mover_abajo'
  if (/\b(bajalo|bajala|bajame|bajalos|bajalas)\b/.test(t)) return 'mover_abajo'
  if (/\b(subelo|subela|subeme)\b/.test(t)) return 'mover_arriba'
  return null
}

const dice = (verbo: VerboDeOrganizacion) => (): Intencion => ({ verbo })
const BORRA = /^(me )?(borra|borras|borrame|borralo|borrala|elimina|eliminas|eliminame|borre|borres|elimine|elimines)\b/

/**
 * Las reglas, de la más específica a la más general: la PRIMERA que acierta decide. `da` devuelve `null` para decir
 * «esto no es una orden» y cortar ahí (una pregunta de entrenamiento no sigue buscando verbos).
 */
const REGLAS: readonly { si: (t: string) => boolean; da: (t: string) => Intencion | null }[] = [
  // Lo que no toca una pieza concreta: restablecer, deshacer.
  { si: (t) => RESTABLECER_VERBO.test(t), da: dice('restablecer') },
  { si: (t) => RESTABLECER_A_FABRICA.test(t) && RESTABLECER_OBJETO.test(t), da: dice('restablecer') },
  { si: (t) => CAMBIO_ATRAS.test(t) || CAMBIO_ATRAS_SUELTO.test(t), da: dice('deshacer') },
  // «no quiero que se oculte X jamás» pide dejar a la vista: se lee antes que la lista de lo escondido.
  { si: (t) => FIJAR_VERBO.test(t) || FIJAR_OBJETO.test(t), da: dice('fijar') },
  { si: (t) => LISTAR_PUEDO.test(t), da: dice('listar') },
  { si: (t) => LISTAR_ESCONDIDAS.test(t), da: dice('listar_ocultas') },
  // El modo «solo lo importante» (antes que ocultar: lleva «esconde el resto»).
  { si: (t) => SOLO_LO_IMPORTANTE.test(t), da: dice('solo_lo_importante') },
  // Mover: con verbo de movimiento y dirección, o con el objeto primero y la dirección después.
  { si: (t) => direccionDeMover(t) !== null, da: (t) => ({ verbo: direccionDeMover(t)! }) },
  // Quitar sin decir qué («quita eso», «ese cuadro de ahí bórralo»): se pregunta cuál. Antes de ocultar y de traer.
  { si: (t) => (QUITA_FAMILIA.test(t) || QUITA_AL_FINAL.test(t) || /^no quiero eso\b/.test(t)) && DEMOSTRATIVO.test(t), da: dice('quitar_ambiguo') },
  // Sacar DE la pantalla es esconder; sacar EN la pantalla es traer.
  { si: (t) => /^(me )?(saca|sacas|sacame|saque|saques)\b.*\bde (la |mi )?(pantalla|vista)\b/.test(t), da: dice('ocultar') },
  { si: (t) => OCULTAR_VERBO.test(t) || OCULTAR_FRASE.test(t), da: dice('ocultar') },
  { si: (t) => QUITA_FAMILIA.test(t) && !/\b(aqui|aca|pantalla)\b/.test(t), da: (t) => ({ verbo: 'ocultar', ...(BORRA.test(t) ? { borrar: true } : {}) }) },
  // Quejas: se OFRECE esconder.
  { si: (t) => QUEJA_INICIO.test(t) || QUEJA_FIN.test(t), da: dice('sugerir_ocultar') },
  // Una pregunta de contenido con «muéstrame» no es una orden: se corta aquí.
  { si: (t) => ES_PREGUNTA_DE_CONTENIDO.test(t) && !VER_FRASE.test(t) && !VER_LO_PROPIO.test(t), da: () => null },
  // Traer.
  { si: (t) => VER_FRASE.test(t) || VER_LO_PROPIO.test(t) || VER_VERBO.test(t) || PON_SIN_LUGAR.test(t), da: (t) => ({ verbo: 'traer', ...(REVISAR.test(t) || VER_LO_PROPIO.test(t) ? { suave: true } : {}) }) },
]

function leerIntencion(t: string): Intencion | null {
  const regla = REGLAS.find((r) => r.si(t))
  return regla ? regla.da(t) : null
}

export function leerPedidoDeOrganizacion(dicho: string): PedidoDeOrganizacion {
  // Solo una orden limpia de una cláusula se resuelve aquí; con una segunda cláusula pegada sigue al servidor (lector de riesgo).
  if (!esOrdenPura(dicho)) return { tipo: 'ninguno' }
  const frase = limpiarFrase(dicho)
  const t = corregirPalabras(frase, VOCABULARIO_DE_ORDENES).replace(MULETILLAS, '')
  const registro = interpretarPedidoDeshacer(dicho)
  if (registro) {
    // «quita eso» sin decir qué: la gramática de registros lo lee como «quita lo último que anoté» y la de organización
    // como «esconde algo de la pantalla». No se adivina: se pregunta. «deshaz eso» sí es solo de registros.
    const sinObjeto = registro.referencia === 'eso' && registro.tipo === undefined && !registro.pideVarios
    if (sinObjeto && QUITA_FAMILIA.test(t)) return { tipo: 'pedido', verbo: 'quitar_ambiguo', frase: t }
    return { tipo: 'ninguno' }
  }
  const intencion = leerIntencion(t)
  if (!intencion) return { tipo: 'ninguno' }
  if (filtroDeRiesgo(dicho) || DE_SALUD.test(frase)) return { tipo: 'riesgo' }
  return { tipo: 'pedido', verbo: intencion.verbo, frase: t, ...(intencion.borrar ? { borrar: true } : {}), ...(intencion.suave ? { suave: true } : {}) }
}
