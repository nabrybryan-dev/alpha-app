/**
 * Anotaciones del cuaderno de la persona (decisión de Bryan, 8-nov-2026; tabla `praxis_anotaciones_persona`, migración 0176).
 * Dos frases no llenan ningún campo del check-in pero dicen algo que vale revisar más adelante:
 *   · «estoy molida de las piernas»            -> recuperación tardía de esa zona.
 *   · «me sentí pesada después del almuerzo»   -> cómo reacciona su organismo a esa comida (patrón).
 * Puro: solo PROPONE. Se guarda cuando la persona toca la tarjeta. El alimento solo se rescata cuando la persona lo dijo
 * justo antes («comí frijoles y me sentí pesada»); nunca se adivina de una frase suelta.
 * Lo NEGADO no se anota («no me sentí pesada después del almuerzo»): guardar lo contrario de lo dicho es peor que perderlo.
 */
import { normalizarTexto } from './numeros.ts'

/** Zonas que se anotan. Las articulaciones (rodilla, codo, tobillo) NO: «molida de la rodilla» es clínico. */
export const ZONAS_DEL_CUERPO = 'pierna|brazo|espalda|pecho|hombro|gluteo|abdomen|cuadricep|isquio|gemelo|pantorrilla|triceps|biceps|cuello|cadera|musculo'

export type MomentoDeComida = 'desayuno' | 'almuerzo' | 'cena' | 'merienda' | 'otro'

export interface Anotacion {
  tipo: 'recuperacion_zona' | 'reaccion_comida'
  zona?: string
  momento?: MomentoDeComida
  /** Solo si la persona lo nombró en el trozo anterior («comí frijoles»). La persona lo ve en la tarjeta. */
  alimento?: string
  cita: string
}

/** La base rechaza una cita de más de 300 caracteres: se recorta aquí, antes de llegar a ella. */
const MAX_CITA = 300

const ZONA_DESPUES = new RegExp(`\\bmolid[oa]s?\\b.*?\\b(${ZONAS_DEL_CUERPO})(e?s)?\\b`)
const ZONA_ANTES = new RegExp(`\\b(${ZONAS_DEL_CUERPO})(e?s)?\\b(?:\\s+\\w+){0,2}?\\s+molid[oa]s?\\b`)
/** Una zona más de la misma lista («de las piernas, de los brazos y de la espalda»): el trozo es solo la zona. */
const ZONA_SUELTA = new RegExp(`^(?:y |tambien |ademas )?(?:(?:de|del|en|con) )?(?:(?:la|las|el|los|mis|mi) )?(${ZONAS_DEL_CUERPO})(e?s)?$`)
const NEGADO_MOLIDA = /\b(no|nunca|ni|tampoco|nada)\b(?:\s+\w+){0,3}?\s+molid/
const SINTIO_PESADO = /\b(senti|siento|sentia|cayo|cayeron|cae|caen|quede|estoy|estuve|estuvo|estaba|estuvieron|estaban|esta)\b.*\bpesad[oa]s?\b|\bpesad[oa]s?\b.*\b(despues|luego)\b/
const NEGADO_PESADO = /\b(no|nunca|ni|tampoco)\b(?:\s+\w+){0,4}?\s+pesad/
const MOMENTOS: [RegExp, MomentoDeComida][] = [
  [/\bdesayun/, 'desayuno'], [/\b(almuerz|almorz)/, 'almuerzo'], [/\b(cena\b|cenar|cenando|cene\b)/, 'cena'], [/\b(merienda|onces)\b/, 'merienda'],
]
const COMIDA = /\b(comi|comer|comiendo|comida|digest\w*|desayun\w*|almuerz\w*|almorz\w*|cena|cenar|cenando|merienda|onces)\b/
const ALIMENTO_DICHO = /\bcomi\s+(?:(?:el|la|los|las|un|una|unos|unas|mucho|mucha|muchos|muchas|poco|poca|bastante)\s+)?([a-z]{3,})\b/
const NO_ES_ALIMENTO = new Set(['mucho', 'poco', 'bastante', 'demasiado', 'algo', 'cosas', 'bien', 'mal', 'normal', 'como', 'tarde', 'temprano', 'rico', 'harto'])

/**
 * «Me cayó pesado el helado»: la comida no trae palabra de comida, pero el verbo «caer pesado» más un sustantivo que no es
 * del entreno ni de la vida diaria lo es. Lo que NO es comida va en la lista cerrada de abajo; si se escapa uno, la tarjeta
 * se lo enseña a la persona con ese nombre y ella no toca «Anotar».
 */
const CAYO_PESADO_DESPUES = /\bcay(?:o|eron)\s+(?:(?:muy|re|bien|super|tan)\s+)?pesad[oa]s?\s+(?:el|la|los|las|ese|esa|esos|esas|un|una)\s+([a-z]{3,})\b/
const CAYO_PESADO_ANTES = /\b(?:el|la|los|las|ese|esa|esos|esas|mi|mis)\s+([a-z]{3,})\s+(?:no\s+)?me\s+cay(?:o|eron)\s+(?:(?:muy|re|bien|super|tan)\s+)?pesad/
const NO_COMIDA = new Set([
  'entreno', 'entrenamiento', 'entrenos', 'gym', 'gimnasio', 'rutina', 'sesion', 'ejercicio', 'ejercicios', 'serie', 'series', 'sentadilla', 'sentadillas',
  'cardio', 'pierna', 'piernas', 'dia', 'dias', 'semana', 'trabajo', 'jefe', 'jefa', 'examen', 'clase', 'reunion', 'tarea', 'charla', 'noticia', 'mensaje',
  'comentario', 'viaje', 'calor', 'clima', 'ambiente', 'ritmo', 'peso', 'pesas', 'madrugon', 'plan', 'entrenador', 'entrenadora', 'companero', 'companera',
])
const DEL_ENTRENO = /\b(entreno|entrenamiento|gym|gimnasio|rutina|sesion|ejercicio|series?|sentadillas?|cardio|pesas)\b/

/** Habla de otra persona («mi esposo está molido de las piernas»): no es del cuaderno de quien escribe. */
const DE_OTRA_PERSONA = /\b(mi|su) (esposo|esposa|marido|pareja|novio|novia|hermano|hermana|mama|papa|madre|padre|hijo|hija|amigo|amiga|companero|companera|jefe|jefa|entrenador|entrenadora|abuelo|abuela|primo|prima|tio|tia|vecino|vecina)\b/
const PRIMERA_PERSONA = /\b(yo|me|estoy|ando|quede|amaneci|siento|senti|tengo)\b/
/** Una pregunta, un deseo o un «si estuviera…» no cuentan lo que le pasó. */
const NO_ES_UN_HECHO = /^\s*¿|\?\s*$|\bsi (estuviera|estuviese|estuvieras|me sintiera|fuera|tuviera)\b|\bojala\b/
/** «Pesada ANTES del almuerzo» no es una reacción a la comida. */
const ANTES_DE_COMER = /\bantes (?:de |del )(?:la |el )?(?:comer|almuerzo|almorzar|cena|cenar|desayuno|desayunar|merienda)/

/** Lo habitual («siempre me cae pesado el almuerzo») es del perfil, no de hoy. */
const HABITUAL = /\b(siempre|normalmente|por lo general|generalmente|suelo|todos los dias)\b/

const recortar = (c: string) => (c.length > MAX_CITA ? c.slice(0, MAX_CITA) : c)

const momentoDe = (n: string): MomentoDeComida => MOMENTOS.find(([re]) => re.test(n))?.[1] ?? 'otro'
const NEGADO_COMI = /\b(no|nunca|ni|tampoco)\b\s+(?:\w+\s+)?comi\b/

/** ¿El trozo cuenta algo PROPIO y de HOY? Ni clínico, ni habitual, ni pregunta o deseo, ni de otra persona. */
function esPropioYDeHoy(cita: string, n: string, esClinico: (c: string) => boolean): boolean {
  if (esClinico(cita) || HABITUAL.test(n) || NO_ES_UN_HECHO.test(cita.toLowerCase())) return false
  return !(DE_OTRA_PERSONA.test(n) && !PRIMERA_PERSONA.test(n))
}

/** «Molida de las piernas», «las piernas molidas», o una zona más de la misma lista. Lo negado no entra. */
function recuperacionDeZona(n: string, cita: string, seguidaDeZona: boolean): Anotacion | null {
  const suelta = seguidaDeZona ? ZONA_SUELTA.exec(n) : null
  const z = suelta ?? (NEGADO_MOLIDA.test(n) ? null : (ZONA_DESPUES.exec(n) ?? ZONA_ANTES.exec(n)))
  return z ? { tipo: 'recuperacion_zona', zona: `${z[1]}${z[2] ?? ''}`, cita: recortar(cita) } : null
}

/** «Comí frijoles» + «me sentí pesada»: una reacción partida por la «y». El alimento sale del trozo de antes. */
function comidaDelTrozoAnterior(cita: string, previo: string | undefined, esClinico: (c: string) => boolean): Anotacion | null {
  const p = previo ? normalizarTexto(previo) : ''
  if (!p || esClinico(previo ?? '') || !COMIDA.test(p) || NEGADO_COMI.test(p)) return null
  const alimento = ALIMENTO_DICHO.exec(p)?.[1]
  return {
    tipo: 'reaccion_comida', momento: momentoDe(p), cita: recortar(cita),
    ...(alimento && !NO_ES_ALIMENTO.has(alimento) ? { alimento } : {}),
  }
}

/** «Me cayó pesado el helado»: un alimento sin palabra de comida. El entreno, el jefe o el trabajo no cuentan. */
function alimentoCaidoPesado(n: string): string | undefined {
  if (/\bno\s+me\s+cay/.test(n)) return undefined
  return CAYO_PESADO_DESPUES.exec(n)?.[1] ?? CAYO_PESADO_ANTES.exec(n)?.[1]
}

function reaccionAUnaComida(n: string, cita: string, previo: string | undefined, esClinico: (c: string) => boolean): Anotacion | null {
  if (!SINTIO_PESADO.test(n) || NEGADO_PESADO.test(n)) return null
  if (ANTES_DE_COMER.test(n) && !/\bdespues\b/.test(n)) return null
  if (COMIDA.test(n)) return { tipo: 'reaccion_comida', momento: momentoDe(n), cita: recortar(cita) }
  const dicho = alimentoCaidoPesado(n)
  if (dicho) return NO_COMIDA.has(dicho) ? null : { tipo: 'reaccion_comida', momento: 'otro', alimento: dicho, cita: recortar(cita) }
  if (DEL_ENTRENO.test(n)) return null
  return comidaDelTrozoAnterior(cita, previo, esClinico)
}

/**
 * Anotación de un trozo (frase). `esClinico` lo pone el llamador: un trozo clínico no se anota por aquí.
 * `previo` = el trozo de antes; `seguidaDeZona` = el de antes fue una recuperación de zona (una lista de zonas).
 */
export function anotacionDeTrozo(cita: string, esClinico: (c: string) => boolean, previo?: string, seguidaDeZona = false): Anotacion | null {
  const n = normalizarTexto(cita)
  if (!esPropioYDeHoy(cita, n, esClinico)) return null
  return recuperacionDeZona(n, cita, seguidaDeZona) ?? reaccionAUnaComida(n, cita, previo, esClinico)
}
