// Rutas con «.ts»: este módulo lo importa la Edge Function `praxis-charla` (Deno).

/**
 * Filtro de SALIDA de la respuesta provisional (11-nov-2026). PURO: sin red, sin base.
 *
 * Se aplica al texto que devuelve DeepSeek cuando NO hay pieza aprobada. Bloquea (`{ ok:false, motivo }`) si el texto trae:
 *  - `largo`: más de 120 palabras;
 *  - `autores_estudios`: autores, años, «según <Nombre>», «un estudio», «metaanálisis», «los estudios muestran», «et al.»,
 *    «científico», «demostrado», o una palabra con mayúscula a mitad de frase (nombre propio probable: falla seguro);
 *  - `cifras`: dígitos, porcentajes o números en letra que NO estén en la pregunta (puerto de `filtro_cifras_letras.py`,
 *    v2: un dígito vale si la pregunta lo trae en cifra o en letra, y al revés);
 *  - `prescripcion`: «te recomiendo», «debes», «tu dieta/plan/rutina…», kilos, gramos, calorías, y series o repeticiones
 *    pedidas con número o con orden («haz series…»);
 *  - `salud`: diagnóstico, medicación, síntoma, lesión, tratamiento, dolor y afines;
 *  - `rotunda`: absolutos y tranquilizaciones sin matiz («nunca», «jamás», «siempre» en afirmación, «no pasa nada», «es normal»,
 *    «se van solas», «seguro que», «nunca es tarde», «no vuelve»…). «A veces», «no siempre», «casi siempre» y «depende» pasan;
 *  - `vacio`: no es texto o está en blanco.
 * El motivo devuelto es el PRIMERO que salta, en ese orden de arriba abajo salvo `vacio` y `largo`, que van primero.
 *
 * Diferencias con el Python, a propósito: se quitaron los ordinales (primero, segundo…), que en español corriente
 * no son cifras y bloquearían explicaciones inocentes. Se bloquea por exceso: ante la duda, al coach.
 *
 * LÍMITES: es heurístico. Un consejo equivocado sin cifras, sin autores y sin las palabras de arriba PASA (por eso la
 * respuesta lleva rótulo y la ve el coach). Una palabra de salud con otro sentido («dolor de cabeza de planear») también
 * se bloquea. Un nombre propio escrito en minúscula no se detecta.
 */
export const MAX_PALABRAS_PROVISIONAL = 120

export type MotivoFiltro = 'vacio' | 'largo' | 'autores_estudios' | 'cifras' | 'prescripcion' | 'salud' | 'rotunda'
export type ResultadoFiltro = { ok: true } | { ok: false; motivo: MotivoFiltro }

const MAPA: Record<string, string> = {
  dos: '2', tres: '3', cuatro: '4', cinco: '5', seis: '6', siete: '7', ocho: '8', nueve: '9', diez: '10',
  once: '11', doce: '12', trece: '13', catorce: '14', quince: '15', dieciseis: '16', diecisiete: '17',
  dieciocho: '18', diecinueve: '19', veinte: '20', veintiuno: '21', veintidos: '22', veintitres: '23',
  veinticuatro: '24', veinticinco: '25', treinta: '30', cuarenta: '40', cincuenta: '50', sesenta: '60',
  setenta: '70', ochenta: '80', noventa: '90', cien: '100', ciento: '100', mil: '1000',
}
const SOLO_PALABRA = new Set(['doscientos', 'trescientos', 'quinientos', 'millon', 'mitad', 'doble', 'triple', 'tercio', 'tercios', 'cuarto', 'cuartos', 'quinto', 'decimo', 'centenar', 'docena'])
const PALABRAS_CIFRA = new Set([...Object.keys(MAPA), ...SOLO_PALABRA])
const NUM = /\d+(?:[.,]\d+)?/g

const normalizar = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const palabrasDe = (t: string): string[] => normalizar(t).match(/[a-z]+/g) ?? []

/** «Las dos son…», «entre los dos hay…»: «dos» como «ambas», sin cantidad (medido en el examen A2). «Las dos series» sigue siendo cifra. */
const AMBOS = /\b(?:las|los)\s+dos(?=\s+(?:son|se|sirven|funcionan|tienen|trabajan|hay|ejercicios|opciones|variantes|formas|casos|enfoques|estilos|ideas|versiones|metodos|tecnicas)\b|\s*[,.;:!?]|\s*$)/gi

/** Dígitos y palabras-cifra de la respuesta que no están en la pregunta (ni en dígito ni en letra). */
function hayCifraAjena(respuesta: string, pregunta: string): boolean {
  const digitosPregunta = new Set(pregunta.match(NUM) ?? [])
  const palabrasPregunta = new Set(palabrasDe(pregunta))
  const permitidos = new Set([...digitosPregunta, ...[...palabrasPregunta].flatMap((w) => (MAPA[w] ? [MAPA[w]] : []))])
  if ((respuesta.match(NUM) ?? []).some((d) => !permitidos.has(d))) return true
  const propias = new Set([...palabrasPregunta, ...Object.entries(MAPA).filter(([, d]) => digitosPregunta.has(d)).map(([w]) => w)])
  if (palabrasDe(respuesta.replace(AMBOS, ' ')).some((w) => PALABRAS_CIFRA.has(w) && !propias.has(w))) return true
  // porcentajes: el símbolo o «por ciento» solo valen si la pregunta ya los usaba
  const pq = normalizar(pregunta)
  const rq = normalizar(respuesta)
  if (/%/.test(respuesta) && !/%/.test(pregunta)) return true
  if (/\bpor\s*ciento\b|\bporcentaje/.test(rq) && !/\bpor\s*ciento\b|\bporcentaje/.test(pq)) return true
  return false
}

const AUTORES_ESTUDIOS: RegExp[] = [
  /\bestudios?\b/,
  /\bmeta-?\s?analisis\b/,
  /\binvestigaci(?:on|ones)\b/,
  /\bcientific/,
  /\bdemostrad/,
  /\bet\s+al\b/,
  /\brevision(?:es)? sistematica/,
  /\bensayos? clinicos?\b/,
  /\b(?:19|20)\d{2}\b/, // un año: casi siempre cita
]

const esSigla = (p: string): boolean => p.length <= 4 && p === p.toUpperCase()

/** Palabra con mayúscula inicial que NO abre frase: nombre propio probable (autor, lugar, persona). */
function hayNombrePropio(texto: string): boolean {
  for (const m of texto.matchAll(/\p{Lu}\p{L}+/gu)) {
    if (esSigla(m[0])) continue
    const antes = texto.slice(0, m.index).replace(/[\s¿¡"'«([]+$/u, '')
    const abreFrase = antes === '' || /[.!?:;…]$/u.test(antes) || /\n\s*$/u.test(texto.slice(0, m.index))
    if (!abreFrase) return true
  }
  return false
}

const UNIDADES = String.raw`(?:series|repeticiones|reps)`
const NUMERAL = String.raw`(?:\d+|${Object.keys(MAPA).join('|')})`
const PRESCRIPCION: RegExp[] = [
  /\bte (?:recomiendo|sugiero|aconsejo|conviene|toca)\b/,
  /\b(?:debes|deberias|tienes que|haz)\b/,
  /\btus? (?:dieta|plan|rutina|entrenamiento|macros|alimentacion|peso|objetivo)\b/,
  /\b(?:kg|kilos?|kilogramos?|gramos?|calorias?|kcal)\b/,
  new RegExp(String.raw`\b${NUMERAL}\s+${UNIDADES}\b`),
  new RegExp(String.raw`\b(?:realiza|ejecuta|levanta|usa|sube|baja|mete)\b(?:\s+[a-z]+){0,3}\s+${UNIDADES}\b`),
]

/**
 * «Depende de tu objetivo», «según tu nivel y tu rutina», «el ajuste concreto de tu rutina»: el texto REMITE al coach, no
 * prescribe. Se quitan antes de buscar «tu plan/rutina/objetivo…» (medido en el examen A del 11-nov: 4 de 20 salidas inocentes
 * caían por esta frase). Solo vale justo detrás de la fórmula de remisión; «tu dieta debería…» sigue bloqueando.
 */
const POSESIVO = String.raw`tus?\s+[a-z]+`
const REMISION = new RegExp(
  String.raw`\b(?:segun|depende de|dependiendo de|de acuerdo con|en funcion de|ajustes?(?: concretos?)? de)\s+${POSESIVO}(?:(?:\s*,\s*|\s+[ye]\s+)${POSESIVO})*`,
  'g',
)

const SALUD =
  /\b(?:diagnostic\w*|enfermedad\w*|medic\w*|farmac\w*|dosis|sintoma\w*|lesion\w*|lesionad\w*|patolog\w*|tratamiento\w*|terapia\w*|dolor\w*|receta\w*|hipertens\w*|diabet\w*|embaraz\w*|cardiac\w*|infarto|depresion|ansiedad|anorexia|bulimia|esteroid\w*|anabolic\w*|cirugia|fractura|tendinitis|hernia)\b/

/**
 * Rotundas (decisión del dueño, 11-nov; examen B: «nunca es tarde para empezar», «no vuelve masculina»). Sobre texto normalizado.
 * «Siempre» solo bloquea en afirmación: antes se quitan «no/casi/tampoco siempre» y «siempre que», que son matiz.
 */
const MATIZ_DE_SIEMPRE = /\b(?:no|casi|tampoco|ni)\s+siempre\b|\bsiempre que\b/g
const ROTUNDA: RegExp[] = [
  /\b(?:nunca|jamas)\b/,
  /\bno pasa nada\b/,
  /\bsin (?:ningun )?(?:problemas?|riesgos?)\b/,
  /\bes (?:totalmente|completamente|absolutamente)\b/,
  /\bes seguro\b/,
  /\bes normal\b/,
  /\bse (?:van|va|pasa|pasan|quita|quitan|quitara|quitaran) (?:solos?|solas?|solito|solita|solitos|solitas)\b/,
  /\b100\s*%|\bcien por ciento\b/,
  /\bno hay (?:ningun )?riesgos?\b/,
  /\bseguro que\b/,
  /\bno (?:te )?vuelve\b/,
]

/**
 * Decide si el texto de DeepSeek (sin pieza) puede mostrarse como respuesta provisional.
 * `pregunta` es la frase LIMPIA con que se preguntó: las cifras que ya traía no cuentan como ajenas.
 */
export function filtrarProvisional(texto: unknown, pregunta = ''): ResultadoFiltro {
  if (typeof texto !== 'string' || !texto.trim()) return { ok: false, motivo: 'vacio' }
  if (texto.trim().split(/\s+/).length > MAX_PALABRAS_PROVISIONAL) return { ok: false, motivo: 'largo' }
  const n = normalizar(texto)
  if (/\bseg[uú]n\s+\p{Lu}/u.test(texto) || AUTORES_ESTUDIOS.some((r) => r.test(n)) || hayNombrePropio(texto)) return { ok: false, motivo: 'autores_estudios' }
  if (hayCifraAjena(texto, pregunta)) return { ok: false, motivo: 'cifras' }
  const sinRemision = n.replace(REMISION, ' ')
  if (PRESCRIPCION.some((r) => r.test(sinRemision))) return { ok: false, motivo: 'prescripcion' }
  if (SALUD.test(n)) return { ok: false, motivo: 'salud' }
  const sinMatiz = n.replace(MATIZ_DE_SIEMPRE, ' ')
  if (/\bsiempre\b/.test(sinMatiz) || ROTUNDA.some((r) => r.test(n))) return { ok: false, motivo: 'rotunda' }
  return { ok: true }
}
