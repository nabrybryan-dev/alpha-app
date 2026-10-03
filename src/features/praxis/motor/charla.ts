import { decidirTurno, type Turno } from '../../../domain/praxis/conversacion'
import type { LoQuePraxisVe } from '../../../domain/praxis/plan/listaBlanca'
import type { Trato } from '../../../domain/praxis/plan/responder'
import { limpiarDictado } from './dictado'

/**
 * La charla de Praxis (Bryan, 2-oct y 3-oct).
 *
 * 2-oct: la charla básica humana —saludar, agradecer, despedirse, decir quién es— era local y fija.
 * 3-oct: «que la charla la lleve el modelo, con respuesta corta inmediata mientras piensa».
 *   - Saludos y «¿cómo estás?» (y cualquier pregunta que no sea del plan) van al modelo, UNA sola llamada
 *     por frase (la del registrador). Mientras piensa, Praxis dice al instante una APERTURA corta y variada
 *     («Hola, Bryan.», «Buenas.»); la respuesta del modelo la continúa sin repetir el saludo.
 *   - Si el modelo tarda o falla (red, 401, tiempo), cae a este libreto LOCAL, con 3–4 variantes por
 *     intención y sin repetir la última dicha: nunca un silencio y nunca un «no te entendí».
 *   - Gracias, despedida, disculpa, cariño, «quién eres», «¿eres real?» y «qué puedes hacer» se quedan
 *     locales (0 ms): son respuestas exactas y no ganan nada con el modelo. «Bien»/«mal» después de la pregunta
 *     de ánimo también: dependen de lo último que dijo Praxis y no deben convertirse en una tarjeta.
 *
 * Es charla SOLO si la FRASE ENTERA lo es, ya normalizada (minúsculas, sin tildes, sin signos, sin las pausas de
 * dictado.ts). «hola, hice 4 series de sentadilla con 60» NO lo es y va al registrador como siempre.
 *
 * ORDEN OBLIGATORIO: primero el filtro de riesgo de siempre (`decidirTurno`), y solo si no marca nada, la
 * charla (`decidirTurnoConCharla`). Una frase marcada nunca llega aquí ni al modelo como charla.
 *
 * Es un módulo puro (salvo la memoria de «la última variante dicha»): el trato (tú / usted), el nombre y la
 * hora local llegan en el contexto.
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
  /** El nombre de pila, si existe. Se usa en algunas aperturas, no en todas. */
  nombre?: string | null
}

export interface RespuestaDeCharla {
  intencion: IntencionDeCharla
  /** Lo que se dice si la respuesta es local: la apertura y la cola juntas, cuando hay apertura. */
  texto: string
  /** Esta respuesta termina preguntando cómo está la persona: lo siguiente que diga («bien», «mal») es su ánimo. */
  esperaAnimo: boolean
  /** Solo en saludos: la entrada corta que se dice YA, mientras el modelo piensa. */
  apertura?: string
  /** Solo en saludos: lo que sigue a la apertura si el modelo no contesta. */
  cola?: string
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
/** La frase EMPIEZA con un saludo (para la apertura inmediata). */
const RE_EMPIEZA_SALUDANDO = new RegExp(`^(?:${SALUDOS})(?: |$)`)
const RE_ANIMO_BUENO = /^(?:(?:estoy|me siento|ando|voy|todo) )?(?:muy bien|bien|super|excelente|genial|de maravilla|bastante bien)(?: gracias)?(?: y (?:tu|usted))?$/
const RE_ANIMO_MALO = /^(?:(?:estoy|me siento|ando|voy) )?(?:muy |un poco |algo )?(?:mal|regular|mas o menos|cansad[oa]|agotad[oa]|no muy bien|no tan bien|asi asi)(?: gracias)?(?: y (?:tu|usted))?$/
const RE_GRACIAS = /^(?:(?:ok|vale|listo|perfecto|bueno) )?(?:(?:muchas|mil|muchisimas|infinitas) )?gracias$/
const QUIEN = new Set(['quien eres', 'quien eres tu', 'tu quien eres', 'que eres', 'que eres tu', 'como te llamas', 'cual es tu nombre', 'quien es praxis', 'que es praxis', 'quien es usted', 'como se llama', 'cual es su nombre'])
const RE_REAL = /^(?:eres|tu eres|usted es|es usted|sos) (?:real|humana|humano|un robot|una robot|una persona|una ia|un ia|una inteligencia artificial|un bot|una maquina|una persona real|una persona de verdad|de verdad)$/
const AYUDA = new Set(['que puedes hacer', 'que puede hacer', 'que sabes hacer', 'que sabe hacer', 'que haces', 'para que sirves', 'para que sirve', 'como funciona', 'como funcionas', 'como funciona esto', 'como funciona praxis', 'como me ayudas', 'como puedes ayudarme', 'como puede ayudarme', 'en que me ayudas', 'en que puedes ayudarme', 'en que puede ayudarme', 'que puedes hacer por mi', 'que puede hacer por mi'])
const RE_DESPEDIDA = /^(?:chao|chau|adios|hasta luego|hasta manana|hasta pronto|nos vemos|bye)(?: chao| adios)?$/
const RE_DISCULPA = /^(?:ay )?(?:perdon|perdona|perdone|disculpa|disculpe|lo siento|sorry)(?: por favor)?$/
const RE_CARINO = /^(?:te quiero|te amo|te adoro|me gustas|eres (?:muy |tan )?(?:linda|hermosa|bonita|preciosa)|eres la mejor|usted es (?:muy )?(?:linda|hermosa|la mejor))(?: mucho)?$/

/* ——— Lo que se contesta: variantes, cada una [tú, usted] ——— */
type Par = readonly [string, string]
type Momento = 'manana' | 'tarde' | 'noche'

/** Aperturas del saludo. `{n}` es «, Nombre» (o nada, si no hay nombre). Sin la persona de la frase: una entrada corta. */
const APERTURAS: Record<Momento, readonly string[]> = {
  manana: ['Buenos días{n}.', 'Hola{n}.', 'Buenas{n}.', 'Muy buenos días.'],
  tarde: ['Buenas tardes{n}.', 'Hola{n}.', 'Buenas{n}.', 'Qué más{n}.'],
  noche: ['Buenas noches{n}.', 'Hola{n}.', 'Buenas{n}.', 'Qué más{n}.'],
}
/** Lo que sigue a la apertura cuando el modelo no contesta. */
const COLAS: Record<Momento, readonly Par[]> = {
  manana: [['¿Cómo amaneciste?', '¿Cómo amaneció?'], ['¿Cómo arrancó el día?', '¿Cómo arrancó el día?'], ['¿Qué tal amaneciste?', '¿Qué tal amaneció?'], ['¿Cómo vas hoy?', '¿Cómo va hoy?']],
  tarde: [['¿Cómo va el día?', '¿Cómo va el día?'], ['¿Cómo te ha ido hoy?', '¿Cómo le ha ido hoy?'], ['¿Qué tal va la tarde?', '¿Qué tal va la tarde?'], ['¿Cómo vas?', '¿Cómo va?']],
  noche: [['¿Cómo te fue hoy?', '¿Cómo le fue hoy?'], ['¿Cómo estuvo el día?', '¿Cómo estuvo el día?'], ['¿Qué tal te fue hoy?', '¿Qué tal le fue hoy?'], ['¿Cómo terminó el día?', '¿Cómo terminó el día?']],
}
const DESPEDIDAS: Record<'dia' | 'noche', readonly Par[]> = {
  dia: [
    ['Hasta luego. Aquí estoy cuando quieras.', 'Hasta luego. Aquí estoy cuando quiera.'],
    ['Nos vemos. Cuando me necesites, aquí estoy.', 'Nos vemos. Cuando me necesite, aquí estoy.'],
    ['Chao. Cuando quieras, seguimos.', 'Chao. Cuando quiera, seguimos.'],
    ['Hasta pronto. Por aquí ando.', 'Hasta pronto. Por aquí ando.'],
  ],
  noche: [
    ['Que descanses. Aquí estoy mañana.', 'Que descanse. Aquí estoy mañana.'],
    ['Descansa. Mañana seguimos.', 'Descanse. Mañana seguimos.'],
    ['Buenas noches. Que descanses.', 'Buenas noches. Que descanse.'],
    ['Que tengas buena noche. Mañana seguimos.', 'Que tenga buena noche. Mañana seguimos.'],
  ],
}
const TEXTOS: Record<'estado' | 'animoBueno' | 'animoMalo' | 'gracias' | 'quien' | 'real' | 'ayuda' | 'disculpa' | 'cariño', readonly Par[]> = {
  estado: [
    ['Bien, gracias por preguntar. ¿Y tú, cómo vas?', 'Bien, gracias por preguntar. ¿Y usted cómo va?'],
    ['Todo bien por aquí. ¿Y tú, qué tal?', 'Todo bien por aquí. ¿Y usted, qué tal?'],
    ['Bien, gracias. ¿Cómo has estado tú?', 'Bien, gracias. ¿Cómo ha estado usted?'],
    ['Por aquí todo en orden. ¿Y tú, cómo te sientes hoy?', 'Por aquí todo en orden. ¿Y usted, cómo se siente hoy?'],
  ],
  animoBueno: [
    ['Me alegra. ¿Qué anotamos hoy?', 'Me alegra. ¿Qué anotamos hoy?'],
    ['Qué bueno. ¿Qué anotamos hoy?', 'Qué bueno. ¿Qué anotamos hoy?'],
    ['Buenísimo. Cuéntame qué hiciste hoy.', 'Buenísimo. Cuénteme qué hizo hoy.'],
    ['Me alegra oírlo. ¿Qué quieres anotar?', 'Me alegra oírlo. ¿Qué quiere anotar?'],
  ],
  animoMalo: [
    ['Gracias por contarme. ¿Es el cuerpo, el sueño o el día? Si quieres, lo anoto.', 'Gracias por contarme. ¿Es el cuerpo, el sueño o el día? Si quiere, lo anoto.'],
    ['Te escucho. ¿Es el cuerpo, el sueño o el día? Si quieres, lo anoto.', 'Lo escucho. ¿Es el cuerpo, el sueño o el día? Si quiere, lo anoto.'],
    ['Gracias por decírmelo. ¿Qué pesó más: el cuerpo, el sueño o el día? Lo puedo anotar.', 'Gracias por decírmelo. ¿Qué pesó más: el cuerpo, el sueño o el día? Lo puedo anotar.'],
    ['Qué pena que andes así. ¿Quieres que lo anote? Dime si es el cuerpo, el sueño o el día.', 'Qué pena que ande así. ¿Quiere que lo anote? Dígame si es el cuerpo, el sueño o el día.'],
  ],
  gracias: [['Con mucho gusto.', 'Con mucho gusto.'], ['Con gusto.', 'Con gusto.'], ['De nada.', 'De nada.'], ['Para eso estoy.', 'Para eso estoy.']],
  quien: [
    ['Soy Praxis, la guía de hábitos de Alpha. Anoto lo que entrenas, cómo duermes, lo que comes y cómo te sientes, y te respondo sobre tu plan.', 'Soy Praxis, la guía de hábitos de Alpha. Anoto lo que entrena, cómo duerme, lo que come y cómo se siente, y le respondo sobre su plan.'],
    ['Me llamo Praxis. Te ayudo a llevar tus hábitos en Alpha: lo que entrenas, lo que comes y cómo duermes.', 'Me llamo Praxis. Le ayudo a llevar sus hábitos en Alpha: lo que entrena, lo que come y cómo duerme.'],
    ['Soy Praxis, de Alpha. Llevo contigo el día a día: entreno, comida y sueño, y lo que dice tu plan.', 'Soy Praxis, de Alpha. Llevo con usted el día a día: entreno, comida y sueño, y lo que dice su plan.'],
  ],
  real: [
    ['Soy una inteligencia artificial de Alpha. Tu coach sí es una persona, y ve lo que anotamos.', 'Soy una inteligencia artificial de Alpha. Su coach sí es una persona, y ve lo que anotamos.'],
    ['Soy una IA, no una persona. Tu coach sí lo es, y ve lo que anotamos.', 'Soy una IA, no una persona. Su coach sí lo es, y ve lo que anotamos.'],
    ['No, soy una inteligencia artificial de Alpha. Tu coach es quien te conoce en persona, y ve lo que anotamos.', 'No, soy una inteligencia artificial de Alpha. Su coach es quien lo conoce en persona, y ve lo que anotamos.'],
  ],
  ayuda: [
    ['Cuéntame lo que hiciste, como «hice 4 series de sentadilla con 60», «dormí 6 horas» o «me tomé dos litros de agua». También puedes preguntarme por tu plan de hoy.', 'Cuénteme lo que hizo, como «hice 4 series de sentadilla con 60», «dormí 6 horas» o «me tomé dos litros de agua». También puede preguntarme por su plan de hoy.'],
    ['Anoto lo que me cuentes, por ejemplo «hice 4 series de sentadilla con 60» o «dormí 6 horas», y te contesto lo que diga tu plan de hoy.', 'Anoto lo que me cuente, por ejemplo «hice 4 series de sentadilla con 60» o «dormí 6 horas», y le contesto lo que diga su plan de hoy.'],
    ['Dime qué entrenaste, qué comiste o cómo dormiste y lo anoto. Y si quieres saber qué te toca hoy, me preguntas.', 'Dígame qué entrenó, qué comió o cómo durmió y lo anoto. Y si quiere saber qué le toca hoy, me pregunta.'],
  ],
  disculpa: [['No pasa nada.', 'No pasa nada.'], ['No hay problema.', 'No hay problema.'], ['Listo, sin problema.', 'Listo, sin problema.'], ['Todo bien, no pasa nada.', 'Todo bien, no pasa nada.']],
  cariño: [
    ['Gracias, qué amable. Estoy aquí para acompañarte con tus hábitos.', 'Gracias, qué amable. Estoy aquí para acompañarle con sus hábitos.'],
    ['Gracias por lo que dices. Sigamos con tus hábitos: ¿qué anotamos?', 'Gracias por lo que dice. Sigamos con sus hábitos: ¿qué anotamos?'],
    ['Qué amable, gracias. Yo estoy para tu entreno, tu comida y tu sueño.', 'Qué amable, gracias. Yo estoy para su entreno, su comida y su sueño.'],
  ],
}
/** Cuando la frase parece charla pero el modelo no contesta y no hay otra cosa que decir. Siempre una pista concreta. */
const SUELTAS: readonly Par[] = [
  ['Aquí estoy. Cuéntame qué hiciste hoy o pregúntame por tu plan.', 'Aquí estoy. Cuénteme qué hizo hoy o pregúnteme por su plan.'],
  ['Te escucho. Si quieres, me cuentas cómo vas con el entreno, la comida o el sueño.', 'Lo escucho. Si quiere, me cuenta cómo va con el entreno, la comida o el sueño.'],
  ['Cuéntame cómo vas hoy: el entreno, la comida o el sueño.', 'Cuénteme cómo va hoy: el entreno, la comida o el sueño.'],
  ['Por aquí ando. Dime qué quieres anotar o qué quieres saber de tu plan.', 'Por aquí ando. Dígame qué quiere anotar o qué quiere saber de su plan.'],
]

/** Mañana 5–11:59, tarde 12–18:59, noche el resto. */
export function momentoDelDia(hora: number): Momento {
  return hora >= 5 && hora < 12 ? 'manana' : hora >= 12 && hora < 19 ? 'tarde' : 'noche'
}

const elegirPar = (p: Par, trato: Trato): string => (trato === 'usted' ? p[1] : p[0])

/* ——— Variar sin repetir la última dicha ——— */
const ultimas = new Map<string, number>()
let azar: () => number = Math.random
/** Para las pruebas: un generador propio (siempre entre 0 y 1) o `null` para volver al normal. */
export function fijarAzarDeCharla(f: (() => number) | null): void { azar = f ?? Math.random }
/** Para las pruebas: olvida cuál fue la última variante dicha. */
export function reiniciarVariantes(): void { ultimas.clear() }

function elegirVariante<T>(clave: string, lista: readonly T[]): T {
  if (lista.length === 1) return lista[0]
  const ultima = ultimas.get(clave)
  let i = Math.min(lista.length - 1, Math.floor(azar() * lista.length))
  if (i === ultima) i = (i + 1 + Math.min(lista.length - 2, Math.floor(azar() * (lista.length - 1)))) % lista.length
  ultimas.set(clave, i)
  return lista[i]
}

function aperturaDe(momento: Momento, nombre: string | null | undefined): string {
  const n = nombre?.trim() || null
  return elegirVariante(`apertura:${momento}`, APERTURAS[momento]).replace('{n}', n ? `, ${n}` : '')
}

/** Todas las frases que Praxis puede decir con esta intención (para comprobarlas: calcos, trato, límites). */
export function textosPosibles(intencion: IntencionDeCharla | 'suelta', trato: Trato, hora = 9): string[] {
  const k = trato === 'usted' ? 1 : 0
  const m = momentoDelDia(hora)
  switch (intencion) {
    case 'saludo': return APERTURAS[m].flatMap((a) => COLAS[m].map((c) => `${a.replace('{n}', '')} ${c[k]}`))
    case 'despedida': return DESPEDIDAS[m === 'noche' ? 'noche' : 'dia'].map((p) => p[k])
    case 'suelta': return SUELTAS.map((p) => p[k])
    default: return TEXTOS[intencion].map((p) => p[k])
  }
}
/** Las aperturas y colas sueltas, para las pruebas del saludo por partes. */
export function aperturasPosibles(hora: number, nombre: string | null = null): string[] {
  return APERTURAS[momentoDelDia(hora)].map((a) => a.replace('{n}', nombre ? `, ${nombre}` : ''))
}
export function colasPosibles(hora: number, trato: Trato): string[] {
  return COLAS[momentoDelDia(hora)].map((c) => elegirPar(c, trato))
}

/** Algo que decir cuando la frase parece charla y el modelo no contestó: nunca «no te entendí». */
export function charlaSuelta(trato: Trato): string {
  return elegirPar(elegirVariante('suelta', SUELTAS), trato)
}

/**
 * ¿La frase PARECE charla? Corta, sin cifras y sin palabras de registro. Solo sirve para decidir si, cuando
 * el servidor falla, se contesta con el libreto local o con el mensaje de la falla. No decide nada de seguridad.
 */
const PALABRAS_DE_REGISTRO = /\b(hice|hizo|entren|serie|series|reps|repeticion|kilo|kilos|kg|libras|dormi|dormir|sueno|comi|comer|almorc|desayun|cene|merend|tome|agua|litros|vasos|camin|pasos|pese|peso|rir|rpe|calentamiento|cardio|sentadilla|prensa|banco|dominada)/
export function pareceCharla(frase: string): boolean {
  const n = normalizarCharla(frase)
  if (!n || /\d/.test(n)) return false
  if (n.split(' ').length > 10) return false
  return !PALABRAS_DE_REGISTRO.test(n)
}

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

/**
 * La entrada inmediata de una frase que EMPIEZA saludando y es corta («hola», «buenas, ¿qué me cuentas?»,
 * «qué más, cómo vas»). `null` si no saluda, si trae cifras o si es larga: «hola, hice 4 series…» no lleva apertura.
 */
export function aperturaInmediata(frase: string, ctx: ContextoDeCharla): string | null {
  const n = sinNombre(normalizarCharla(frase))
  if (!n || /\d/.test(n) || n.split(' ').length > 7 || !RE_EMPIEZA_SALUDANDO.test(n)) return null
  if (n === 'buenas noches' && ctx.yaHablo) return null // ahí es una despedida
  return aperturaDe(momentoDelDia(ctx.hora), ctx.nombre)
}

/** Si la frase ENTERA es charla, qué se contesta; si no, `null` (va al flujo de siempre). No decide nada de seguridad: eso ya pasó. */
export function responderCharla(frase: string, ctx: ContextoDeCharla): RespuestaDeCharla | null {
  const n = normalizarCharla(frase)
  const intencion = intencionDe(n, ctx) ?? intencionDe(sinNombre(n), ctx)
  if (!intencion) return null
  const { trato, hora } = ctx
  const m = momentoDelDia(hora)
  switch (intencion) {
    case 'saludo': {
      const apertura = aperturaDe(m, ctx.nombre)
      const cola = elegirPar(elegirVariante(`cola:${m}`, COLAS[m]), trato)
      return { intencion, texto: `${apertura} ${cola}`, esperaAnimo: true, apertura, cola }
    }
    case 'estado': {
      const texto = elegirPar(elegirVariante('estado', TEXTOS.estado), trato)
      const apertura = aperturaInmediata(frase, ctx)
      return { intencion, texto, esperaAnimo: true, ...(apertura ? { apertura } : {}) }
    }
    case 'despedida': {
      const noche = m === 'noche' || n.includes('noches')
      return { intencion, texto: elegirPar(elegirVariante(`despedida:${noche ? 'noche' : 'dia'}`, DESPEDIDAS[noche ? 'noche' : 'dia']), trato), esperaAnimo: false }
    }
    default: return { intencion, texto: elegirPar(elegirVariante(intencion, TEXTOS[intencion]), trato), esperaAnimo: false }
  }
}

/* ——— El orden: primero la seguridad, después la charla ——— */
export interface CharlaConModelo {
  paso: 'charlaModelo'
  /** Se dice YA, mientras el modelo piensa. `null`: no hay saludo que adelantar. */
  apertura: string | null
  /** Si el modelo tarda o falla: lo que sigue a la apertura (o la respuesta entera si no hubo apertura). `null`: usar el plan. */
  alFallar: string | null
  /** El plan que se contesta si el modelo falla y no hay libreto (una pregunta fuera del plan: se ofrece preguntarle al coach). */
  plan: Extract<Turno, { paso: 'plan' }> | null
  /** La respuesta del modelo, si pregunta, abre la pregunta de ánimo («bien», «mal» ahora son respuesta). */
  abreAnimo: boolean
  vaAlModelo: true
}
export type TurnoConCharla = Turno | { paso: 'charla'; respuesta: RespuestaDeCharla; vaAlModelo: false } | CharlaConModelo

/**
 * Preguntas de nutrición, suplementos, medicación o cuerpo: NO son charla. Se quedan en el camino de siempre
 * (dato del plan si lo hay y, si no, «¿se lo pregunto a tu coach o a tu nutricionista?»), sin pasar por la charla del modelo.
 */
const TEMAS_DEL_COACH = /creatina|suplement|proteina|whey|dieta|ayuno|calori|kcal|macro|carbohidrat|grasa|adelgaz|bajar de peso|subir de peso|medic|pastilla|vitamina|cafeina|pre ?entren|esteroid|anabol|hormon|dosis|lesion|dolor|molest|mareo|embaraz|enfermedad/
export function esTemaDelCoach(frase: string): boolean {
  return TEMAS_DEL_COACH.test(normalizarCharla(frase))
}

/** Lo que lleva al modelo: los saludos y el «¿cómo estás?». Lo demás de la charla básica se queda local. */
const AL_MODELO: ReadonlySet<IntencionDeCharla> = new Set<IntencionDeCharla>(['saludo', 'estado'])

/**
 * El turno de una frase CONECTADA. 1) `decidirTurno` corre el filtro de riesgo de siempre. 2) Solo si no
 * marcó nada (ni quieta, ni cuidado, ni salud) y la frase iba a seguir por el plan o por el registrador,
 * se mira si es charla. Una frase marcada nunca se trata como charla: «hola, ya no quiero vivir» va a la Quieta.
 * 3) Una pregunta que el plan no puede contestar («¿qué me cuentas?») ya no termina en «eso no está en lo que
 * veo de tu plan»: va al modelo, con el plan como respaldo si el modelo falla.
 * `charla` se puede cambiar para probar que el orden se respeta.
 */
export function decidirTurnoConCharla(
  frase: string, ve: LoQuePraxisVe, hoy: string, ctx: ContextoDeCharla,
  charla: (frase: string, ctx: ContextoDeCharla) => RespuestaDeCharla | null = responderCharla,
): TurnoConCharla {
  const turno = decidirTurno(frase, ve, hoy, ctx.trato)
  if (turno.paso !== 'plan' && turno.paso !== 'registrar') return turno
  const respuesta = charla(frase, ctx)
  if (respuesta) {
    if (AL_MODELO.has(respuesta.intencion)) {
      return {
        paso: 'charlaModelo', apertura: respuesta.apertura ?? null, alFallar: respuesta.cola ?? respuesta.texto,
        plan: null, abreAnimo: true, vaAlModelo: true,
      }
    }
    return { paso: 'charla', respuesta, vaAlModelo: false }
  }
  if (turno.paso === 'plan' && turno.respuesta.queFalto === 'fuera_del_plan' && turno.respuesta.citas.length === 0 && !esTemaDelCoach(frase)) {
    // Si parece charla, el respaldo es el libreto; si parece una pregunta de verdad, el respaldo es el plan (que ofrece preguntarle al coach).
    const suelta = pareceCharla(frase)
    return { paso: 'charlaModelo', apertura: aperturaInmediata(frase, ctx), alFallar: suelta ? charlaSuelta(ctx.trato) : null, plan: suelta ? null : turno, abreAnimo: false, vaAlModelo: true }
  }
  return turno
}
