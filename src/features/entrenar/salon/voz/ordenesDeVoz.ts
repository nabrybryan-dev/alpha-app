import { filtroDeRiesgo, derivarPorRiesgo } from '../../../../domain/praxis/riesgo'
import type { Sesion } from '../../../../domain/types'
import { NOMBRE_DE_REGION, type IdDeRegion } from '../../sujeto/regiones'
import { normalizarNombre } from '../paredes/cargaAnterior'

/**
 * LAS ÓRDENES DE VOZ DE LA GUÍA: de lo que entendió el reconocedor a qué hacer con el sujeto.
 *
 * Lista cerrada y sin modelo: navegar no gasta la clave y aquí lo dicho no se guarda ni se envía. Lo que no
 * sea una orden ni una pregunta no se adivina: se contesta que no se entendió. Una pregunta se devuelve tal
 * cual para las dudas de Praxis, que hacen con ella lo mismo que con una escrita. El filtro de riesgo va
 * primero, porque esta frase la dijo una persona hablando: lo de salud nunca se vuelve navegación ni pregunta.
 */

export type Orden =
  | { tipo: 'zona'; id: IdDeRegion }
  | { tipo: 'ejercicio'; indice: number; nombre: string }
  | { tipo: 'movimiento' }
  | { tipo: 'cuerpo' }
  | { tipo: 'vuelta' }
  | { tipo: 'cara'; cara: 'frente' | 'espalda' }
  | { tipo: 'siguiente' }
  | { tipo: 'anterior' }
  | { tipo: 'hoy' }
  | { tipo: 'indice' }
  | { tipo: 'cerrar' }
  /** Es de salud o de riesgo: no se navega. Con `frase` es riesgo: va a la pantalla que da las líneas de ayuda. */
  | { tipo: 'salud'; respuesta: string; frase?: string }
  /** Una pregunta para las dudas de Praxis, con las palabras que se dijeron. */
  | { tipo: 'duda'; frase: string }
  /** Nombró varias cosas a la vez: se le dice entre cuáles. */
  | { tipo: 'cual'; opciones: readonly string[] }
  | { tipo: 'no_entendi' }

/** Cómo se nombra cada región al hablar. El orden importa: «espalda baja» antes que «espalda». */
const NOMBRES_DE_REGION: readonly (readonly [IdDeRegion, RegExp])[] = [
  ['lumb', /\b(lumbar|lumbares|espalda baja)\b/],
  ['pecho', /\b(pecho|pectoral|pectorales)\b/],
  ['delt', /\b(hombro|hombros|deltoide|deltoides)\b/],
  ['bic', /\b(bicep|biceps)\b/],
  ['tri', /\b(tricep|triceps)\b/],
  ['ante', /\b(antebrazo|antebrazos)\b/],
  ['abd', /\b(abdomen|abdominal|abdominales|abs)\b/],
  ['obl', /\b(oblicuo|oblicuos)\b/],
  ['trap', /\b(trapecio|trapecios)\b/],
  ['dors', /\b(dorsal|dorsales|espalda)\b/],
  ['glu', /\b(gluteo|gluteos|cola|nalga|nalgas)\b/],
  ['cua', /\b(cuadricep|cuadriceps)\b/],
  ['isq', /\b(isquio|isquios|isquiotibial|isquiotibiales|femoral|femorales)\b/],
  ['adu', /\b(aductor|aductores)\b/],
  ['gem', /\b(gemelo|gemelos|pantorrilla|pantorrillas)\b/],
]

/** Palabras que no alcanzan para decir qué ejercicio es: nombran una zona o un aparato. */
const PALABRAS_DEL_APARATO = /^(maquina|barra|polea|mancuerna|mancuernas|sentado|sentada|acostado|acostada|inclinado|inclinada|agarre|unilateral|ejercicio|movimiento)$/

const AMBIGUOS: readonly (readonly [RegExp, readonly IdDeRegion[]])[] = [
  [/\b(pierna|piernas)\b/, ['cua', 'isq', 'gem']],
  [/\b(brazo|brazos)\b/, ['bic', 'tri', 'ante']],
]

const DE_SALUD = /\b(duele|duelen|dolor|dolores|molesta|molestan|lesion|lesione|mareo|mareado|mareada)\b/
const NEGADA = /\b(no|nunca|tampoco)\s+(me\s+|lo\s+|la\s+)?(muestres|ensenes|abras|abre|quiero|vayas|pongas|mires)\b/
const PIDE_MOVIMIENTO = /\b(movimiento|como se hace|como se hacen|como lo hago|demuestra|demuestrame)\b/

/** Con qué empieza una pregunta de entreno. «Qué» va acotado: «qué rico el almuerzo» no pregunta nada. */
const EMPIEZA_PREGUNTA =
  /^(por que|porque|para que|cuanto|cuanta|cuantos|cuantas|cuando|cual|cuales|como|debo|deberia|puedo|se puede|es malo|es mala|es bueno|es buena|es mejor|sirve|conviene|hay que|tengo que|necesito|vale la pena|que (es|son|significa|hago|hacer|pasa|sirve|tan|tanto|tanta|musculo|musculos|ejercicio|ejercicios|peso|debo|puedo))\b/
const SALUDO = /^((oye|hola|disculpa|praxis|tengo una duda|tengo una pregunta|una duda|una pregunta)\s+)+/
const PIDE_LO_DE_HOY = /\b(me toca|toca hoy|mi dia)\b/
/** El reconocedor no entrega signos: «llevo dos años, ¿cuántas series…?» llega sin ellos y con la pregunta a la mitad. */
const PREGUNTA_A_LA_MITAD = /\b(por que|para que|cuanto|cuanta|cuantos|cuantas|cuando|cual|cuales)\b/
/** Lo que manda de verdad al sujeto. Una frase larga sin ninguno de estos verbos es alguien contando o preguntando. */
const VERBO_DE_ORDEN = /\b(muestra|muestrame|abre|abreme|ensena|ensename|quiero ver|ver|ve|ir|vamos|llevame|pon|ponme|ponte|cierra|cerrar|gira|girate|voltea|volteate|vuelve|volver|regresa|sigue|dame)\b/
const PALABRAS_DE_UNA_FRASE_LARGA = 6

const RESPUESTA_DE_SALUD = 'Eso no lo resuelvo navegando. Cuéntaselo a tu coach.'

function regionesNombradas(frase: string): IdDeRegion[] {
  const hallados: IdDeRegion[] = []
  let resto = frase
  for (const [id, re] of NOMBRES_DE_REGION) {
    if (re.test(resto)) {
      hallados.push(id)
      resto = resto.replace(re, ' ')
    }
  }
  return hallados
}

function palabrasDelEjercicio(nombre: string): string[] {
  return normalizarNombre(nombre)
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .split(' ')
    .filter((p) => p.length >= 4 && !PALABRAS_DEL_APARATO.test(p) && !NOMBRES_DE_REGION.some(([, re]) => re.test(p)))
}

/** El ejercicio de hoy que la frase nombra: entero, o por la mayor parte de sus palabras propias. */
function buscarEjercicio(frase: string, sesion: Pick<Sesion, 'ejercicios'> | undefined): Orden | null {
  const ejercicios = sesion?.ejercicios ?? []
  const enFrase = new Set(frase.split(' '))
  const puntaje = ejercicios.map((e, indice) => {
    const entero = normalizarNombre(e.nombre).replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim()
    const dentro = entero.length > 0 && ` ${frase} `.includes(` ${entero} `)
    return { indice, nombre: e.nombre, puntos: dentro ? 100 : palabrasDelEjercicio(e.nombre).filter((p) => enFrase.has(p)).length }
  })
  const mejor = Math.max(0, ...puntaje.map((p) => p.puntos))
  if (mejor === 0) return null
  const empatados = puntaje.filter((p) => p.puntos === mejor)
  if (empatados.length > 1) return { tipo: 'cual', opciones: empatados.map((p) => p.nombre) }
  const { indice, nombre } = empatados[0]!
  return { tipo: 'ejercicio', indice, nombre }
}

function normalizarFrase(dicho: string): string {
  return normalizarNombre(dicho).replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function interpretarOrden(dicho: string, sesion?: Pick<Sesion, 'ejercicios'>): Orden {
  const marca = filtroDeRiesgo(dicho)
  if (marca) {
    const respuesta = derivarPorRiesgo(marca).respuesta ?? RESPUESTA_DE_SALUD
    return marca.tipo === 'salud' ? { tipo: 'salud', respuesta } : { tipo: 'salud', respuesta, frase: dicho.trim() }
  }
  const frase = normalizarFrase(dicho)
  if (!frase) return { tipo: 'no_entendi' }
  if (DE_SALUD.test(frase)) return { tipo: 'salud', respuesta: RESPUESTA_DE_SALUD }
  if (NEGADA.test(frase)) return { tipo: 'no_entendi' }
  if (esPregunta(frase, dicho)) return { tipo: 'duda', frase: dicho.trim() }

  return ordenDeGiro(frase) ?? buscarEjercicio(frase, sesion) ?? ordenDeZona(frase) ?? ordenDeNavegacion(frase)
}

/** Pedir un movimiento o lo de hoy suena a pregunta, pero es una orden y no gasta nada. */
function esPregunta(frase: string, dicho: string): boolean {
  if (PIDE_MOVIMIENTO.test(frase) || PIDE_LO_DE_HOY.test(frase)) return false
  if (/[¿?]/.test(dicho) || EMPIEZA_PREGUNTA.test(frase.replace(SALUDO, '')) || PREGUNTA_A_LA_MITAD.test(frase)) return true
  return frase.split(' ').length >= PALABRAS_DE_UNA_FRASE_LARGA && !VERBO_DE_ORDEN.test(frase)
}

function ordenDeGiro(frase: string): Orden | null {
  if (/\b(de espaldas|por detras|por atras|la espalda del cuerpo)\b/.test(frase)) return { tipo: 'cara', cara: 'espalda' }
  if (/\b(de frente|por delante)\b/.test(frase)) return { tipo: 'cara', cara: 'frente' }
  if (/\b(vuelta|voltea|voltear|volteate|gira|girar|girate)\b/.test(frase)) return { tipo: 'vuelta' }
  return null
}

function ordenDeZona(frase: string): Orden | null {
  const regiones = regionesNombradas(frase)
  if (regiones.length > 1) return { tipo: 'cual', opciones: regiones.map((id) => NOMBRE_DE_REGION[id]) }
  if (regiones.length === 1) return { tipo: 'zona', id: regiones[0]! }
  for (const [re, ids] of AMBIGUOS) {
    if (re.test(frase)) return { tipo: 'cual', opciones: ids.map((id) => NOMBRE_DE_REGION[id]) }
  }
  return null
}

function ordenDeNavegacion(frase: string): Orden {
  if (PIDE_MOVIMIENTO.test(frase)) return { tipo: 'movimiento' }
  if (/\b(siguiente|sigue|seguir|continua|continuar|adelante)\b/.test(frase)) return { tipo: 'siguiente' }
  if (/\b(anterior|atras|devuelve|devuelvete|regresa)\b/.test(frase)) return { tipo: 'anterior' }
  if (/\b(todas las zonas|las zonas|zonas|indice|lista|musculos)\b/.test(frase)) return { tipo: 'indice' }
  if (/\b(hoy|me toca|toca hoy|mi dia)\b/.test(frase)) return { tipo: 'hoy' }
  if (/\b(cuerpo|sujeto)\b/.test(frase)) return { tipo: 'cuerpo' }
  if (/\b(cierra|cerrar|salir|sal|listo|quita|quitar)\b/.test(frase)) return { tipo: 'cerrar' }
  return { tipo: 'no_entendi' }
}

/** Lo que Praxis contesta en pantalla. El nombre de lo pedido va siempre, para que se note qué entendió. */
export function respuestaDeLaOrden(orden: Orden): string {
  switch (orden.tipo) {
    case 'zona': return NOMBRE_DE_REGION[orden.id]
    case 'ejercicio': return orden.nombre
    case 'movimiento': return 'El movimiento'
    case 'cuerpo': return 'El cuerpo'
    case 'vuelta': return 'Doy la vuelta'
    case 'cara': return orden.cara === 'frente' ? 'De frente' : 'De espaldas'
    case 'siguiente': return 'Lo siguiente'
    case 'anterior': return 'Lo anterior'
    case 'hoy': return 'Lo de hoy'
    case 'indice': return 'Todas las zonas'
    case 'cerrar': return 'Listo'
    case 'salud': return orden.respuesta
    case 'duda': return `Te oí: «${orden.frase}»`
    case 'cual': return `¿Cuál? ${orden.opciones.join(', ')}.`
    case 'no_entendi': return 'No entendí. Prueba «muéstrame cuádriceps» o hazme una pregunta de entreno.'
  }
}
