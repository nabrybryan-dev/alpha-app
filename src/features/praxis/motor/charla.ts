import { decidirTurno, type Turno } from '../../../domain/praxis/conversacion'
import type { LoQuePraxisVe } from '../../../domain/praxis/plan/listaBlanca'
import type { Trato } from '../../../domain/praxis/plan/responder'
import { limpiarDictado } from './dictado'

/**
 * La charla básica humana de Praxis (Bryan, 2-oct): saludar, agradecer, despedirse, decir
 * quién es. Lo de Siri, sin profundizar. Local y al instante: no llama al servidor (0 ms,
 * 0 tokens), no guarda nada y no crea tarjetas.
 *
 * Es charla SOLO si la FRASE ENTERA lo es, ya normalizada (minúsculas, sin tildes, sin
 * signos, sin las pausas de dictado.ts). «hola, hice 4 series de sentadilla con 60» NO lo es
 * y va al registrador como siempre.
 *
 * ORDEN OBLIGATORIO: primero el filtro de riesgo de siempre (`decidirTurno`), y solo si no
 * marca nada, la charla (`decidirTurnoConCharla`). Una frase marcada nunca llega aquí.
 *
 * Es un módulo puro: el trato (tú / usted) y la hora local llegan en el contexto, igual que
 * `tu(textoTu, textoUsted)` los resuelve en el resto del motor.
 */
export type IntencionDeCharla =
  | 'saludo' | 'estado' | 'animoBueno' | 'animoMalo' | 'gracias' | 'quien' | 'real' | 'ayuda' | 'despedida' | 'disculpa' | 'cariño'

export interface ContextoDeCharla {
  trato: Trato
  /** La hora local, 0–23. */
  hora: number
  /** ¿Lo último que dijo Praxis fue una pregunta de ánimo (el saludo o el «¿Y tú, cómo vas?»)? Solo entonces «bien» o «mal» son respuesta. */
  esperaAnimo: boolean
  /** ¿La persona ya habló antes en esta sesión? Un «buenas noches» después de hablar es una despedida. */
  yaHablo: boolean
}

export interface RespuestaDeCharla {
  intencion: IntencionDeCharla
  texto: string
  /** Esta respuesta termina preguntando cómo está la persona: lo siguiente que diga («bien», «mal») es su ánimo. */
  esperaAnimo: boolean
}

/* ——— Normalizar: la frase entera, sin tildes, sin signos, sin pausas de dictado ——— */
export function normalizarCharla(frase: string): string {
  return limpiarDictado(frase)
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}
/** Con «Praxis» delante o detrás también (como se le llama a un asistente). */
const sinNombre = (n: string): string => n.replace(/^praxis /, '').replace(/ praxis$/, '')

/* ——— Lo que se reconoce ——— */
const SALUDOS = 'hola|holi|holis|buenas|buenos dias|buenas tardes|buenas noches|que mas|quiubo|que hubo|hey|ey'
const ESTADOS = 'como estas|como esta|como esta usted|como vas|como le va|como te va|que tal|todo bien|y tu que|y tu|y usted'
const RE_SALUDO = new RegExp(`^(?:${SALUDOS})(?: (?:${SALUDOS}))*$`)
const RE_ESTADO = new RegExp(`^(?:(?:${SALUDOS}) )*(?:${ESTADOS})$`)
const RE_ANIMO_BUENO = /^(?:(?:estoy|me siento|ando|voy|todo) )?(?:muy bien|bien|super|excelente|genial|de maravilla|bastante bien)(?: gracias)?(?: y (?:tu|usted))?$/
const RE_ANIMO_MALO = /^(?:(?:estoy|me siento|ando|voy) )?(?:muy |un poco |algo )?(?:mal|regular|mas o menos|cansad[oa]|agotad[oa]|no muy bien|no tan bien|asi asi)(?: gracias)?(?: y (?:tu|usted))?$/
const RE_GRACIAS = /^(?:(?:ok|vale|listo|perfecto|bueno) )?(?:(?:muchas|mil|muchisimas|infinitas) )?gracias$/
const QUIEN = new Set(['quien eres', 'quien eres tu', 'tu quien eres', 'que eres', 'que eres tu', 'como te llamas', 'cual es tu nombre', 'quien es praxis', 'que es praxis', 'quien es usted', 'como se llama', 'cual es su nombre'])
const RE_REAL = /^(?:eres|tu eres|usted es|es usted|sos) (?:real|humana|humano|un robot|una robot|una persona|una ia|un ia|una inteligencia artificial|un bot|una maquina|una persona real|una persona de verdad|de verdad)$/
const AYUDA = new Set(['que puedes hacer', 'que puede hacer', 'que sabes hacer', 'que sabe hacer', 'que haces', 'para que sirves', 'para que sirve', 'como funciona', 'como funcionas', 'como funciona esto', 'como funciona praxis', 'como me ayudas', 'como puedes ayudarme', 'como puede ayudarme', 'en que me ayudas', 'en que puedes ayudarme', 'en que puede ayudarme', 'que puedes hacer por mi', 'que puede hacer por mi'])
const RE_DESPEDIDA = /^(?:chao|chau|adios|hasta luego|hasta manana|hasta pronto|nos vemos|bye)(?: chao| adios)?$/
const RE_DISCULPA = /^(?:ay )?(?:perdon|perdona|perdone|disculpa|disculpe|lo siento|sorry)(?: por favor)?$/
const RE_CARINO = /^(?:te quiero|te amo|te adoro|me gustas|eres (?:muy |tan )?(?:linda|hermosa|bonita|preciosa)|eres la mejor|usted es (?:muy )?(?:linda|hermosa|la mejor))(?: mucho)?$/

/* ——— Lo que se contesta: [tú, usted] ——— */
type Par = readonly [string, string]
const SALUDO_POR_HORA: Record<'manana' | 'tarde' | 'noche', Par> = {
  manana: ['Buenos días. ¿Cómo amaneciste?', 'Buenos días. ¿Cómo amaneció?'],
  tarde: ['Buenas tardes. ¿Cómo va el día?', 'Buenas tardes. ¿Cómo va el día?'],
  noche: ['Buenas noches. ¿Cómo te fue hoy?', 'Buenas noches. ¿Cómo le fue hoy?'],
}
const DESPEDIDA_POR_HORA: Record<'dia' | 'noche', Par> = {
  dia: ['Hasta luego. Aquí estoy cuando quieras.', 'Hasta luego. Aquí estoy cuando quiera.'],
  noche: ['Que descanses. Aquí estoy mañana.', 'Que descanse. Aquí estoy mañana.'],
}
const TEXTOS: Record<'estado' | 'animoBueno' | 'animoMalo' | 'gracias' | 'quien' | 'real' | 'ayuda' | 'disculpa' | 'cariño', Par> = {
  estado: ['Bien, gracias por preguntar. ¿Y tú, cómo vas?', 'Bien, gracias por preguntar. ¿Y usted cómo va?'],
  animoBueno: ['Me alegra. ¿Qué anotamos hoy?', 'Me alegra. ¿Qué anotamos hoy?'],
  animoMalo: ['Gracias por contarme. ¿Es el cuerpo, el sueño o el día? Si quieres, lo anoto.', 'Gracias por contarme. ¿Es el cuerpo, el sueño o el día? Si quiere, lo anoto.'],
  gracias: ['Con mucho gusto.', 'Con mucho gusto.'],
  quien: [
    'Soy Praxis, la guía de hábitos de Alpha. Anoto lo que entrenas, cómo duermes, lo que comes y cómo te sientes, y te respondo sobre tu plan.',
    'Soy Praxis, la guía de hábitos de Alpha. Anoto lo que entrena, cómo duerme, lo que come y cómo se siente, y le respondo sobre su plan.',
  ],
  real: ['Soy una inteligencia artificial de Alpha. Tu coach sí es una persona, y ve lo que anotamos.', 'Soy una inteligencia artificial de Alpha. Su coach sí es una persona, y ve lo que anotamos.'],
  ayuda: [
    'Cuéntame lo que hiciste, como «hice 4 series de sentadilla con 60», «dormí 6 horas» o «me tomé dos litros de agua». También puedes preguntarme por tu plan de hoy.',
    'Cuénteme lo que hizo, como «hice 4 series de sentadilla con 60», «dormí 6 horas» o «me tomé dos litros de agua». También puede preguntarme por su plan de hoy.',
  ],
  disculpa: ['No pasa nada.', 'No pasa nada.'],
  cariño: ['Gracias, qué amable. Estoy aquí para acompañarte con tus hábitos.', 'Gracias, qué amable. Estoy aquí para acompañarle con sus hábitos.'],
}

/** Mañana 5–11:59, tarde 12–18:59, noche el resto. */
export function momentoDelDia(hora: number): 'manana' | 'tarde' | 'noche' {
  return hora >= 5 && hora < 12 ? 'manana' : hora >= 12 && hora < 19 ? 'tarde' : 'noche'
}

const elegir = (p: Par, trato: Trato): string => (trato === 'usted' ? p[1] : p[0])

function intencionDe(n: string, ctx: ContextoDeCharla): IntencionDeCharla | null {
  if (!n || n.length > 60) return null
  if (ctx.esperaAnimo) { // «bien» y «mal» solo son respuesta si Praxis acaba de preguntar
    if (RE_ANIMO_BUENO.test(n)) return 'animoBueno'
    if (RE_ANIMO_MALO.test(n)) return 'animoMalo'
  }
  if (n === 'buenas noches' && ctx.yaHablo) return 'despedida'
  if (RE_SALUDO.test(n)) return 'saludo'
  if (RE_ESTADO.test(n)) return 'estado'
  if (RE_GRACIAS.test(n)) return 'gracias'
  if (QUIEN.has(n)) return 'quien'
  if (RE_REAL.test(n)) return 'real'
  if (AYUDA.has(n)) return 'ayuda'
  if (RE_DESPEDIDA.test(n)) return 'despedida'
  if (RE_DISCULPA.test(n)) return 'disculpa'
  if (RE_CARINO.test(n)) return 'cariño'
  return null
}

/** Si la frase ENTERA es charla, qué se contesta; si no, `null` (va al flujo de siempre). No decide nada de seguridad: eso ya pasó. */
export function responderCharla(frase: string, ctx: ContextoDeCharla): RespuestaDeCharla | null {
  const n = normalizarCharla(frase)
  const intencion = intencionDe(n, ctx) ?? intencionDe(sinNombre(n), ctx)
  if (!intencion) return null
  const { trato, hora } = ctx
  switch (intencion) {
    case 'saludo': return { intencion, texto: elegir(SALUDO_POR_HORA[momentoDelDia(hora)], trato), esperaAnimo: true }
    case 'estado': return { intencion, texto: elegir(TEXTOS.estado, trato), esperaAnimo: true }
    case 'despedida': {
      const noche = momentoDelDia(hora) === 'noche' || n.includes('noches')
      return { intencion, texto: elegir(DESPEDIDA_POR_HORA[noche ? 'noche' : 'dia'], trato), esperaAnimo: false }
    }
    default: return { intencion, texto: elegir(TEXTOS[intencion], trato), esperaAnimo: false }
  }
}

/* ——— El orden: primero la seguridad, después la charla ——— */
export type TurnoConCharla = Turno | { paso: 'charla'; respuesta: RespuestaDeCharla; vaAlModelo: false }

/**
 * El turno de una frase CONECTADA. 1) `decidirTurno` corre el filtro de riesgo de siempre. 2) Solo si no
 * marcó nada (ni quieta, ni cuidado, ni salud) y la frase iba a seguir por el plan o por el registrador,
 * se mira si es charla. Una frase marcada nunca se trata como charla: «hola, ya no quiero vivir» va a la Quieta.
 * `charla` se puede cambiar para probar que el orden se respeta.
 */
export function decidirTurnoConCharla(
  frase: string, ve: LoQuePraxisVe, hoy: string, ctx: ContextoDeCharla,
  charla: (frase: string, ctx: ContextoDeCharla) => RespuestaDeCharla | null = responderCharla,
): TurnoConCharla {
  const turno = decidirTurno(frase, ve, hoy, ctx.trato)
  if (turno.paso !== 'plan' && turno.paso !== 'registrar') return turno
  const respuesta = charla(frase, ctx)
  return respuesta ? { paso: 'charla', respuesta, vaAlModelo: false } : turno
}
