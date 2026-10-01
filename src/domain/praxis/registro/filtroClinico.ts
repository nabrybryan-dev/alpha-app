/**
 * Filtro clínico: corre ANTES del modelo (DISENO §4.1).
 *
 * Si la frase trae dolor, lesión, síntoma, medicamento, conducta alimentaria o
 * riesgo, no llega a Haiku. Praxis responde con un texto fijo, se avisa a Bryan y
 * NO se interpreta nada: no se diagnostica, no se dice qué es, no se autoriza ni
 * se prohíbe entrenar.
 *
 * El sesgo es marcar de más. Una alerta sobrante cuesta un vistazo; una que falta
 * cuesta un asesorado. «Me duele no ir al gym» se deriva, y es preferible a lo
 * contrario.
 *
 * Las palabras de crisis y de salud coinciden con `responder-chat`
 * (`esCrisis`/`esTemaDeSalud`) y las amplían con lo que el registro necesita
 * (síntomas de entrenamiento, medicamentos, conducta alimentaria). Un test
 * comprueba que la lista de crisis de aquí incluye todas las de allá.
 */
import { normalizarTexto } from './numeros.ts'
import type { Propuesta } from './tipos.ts'

export type FiltroClinico = NonNullable<Propuesta['filtro']>

export interface MarcaClinica {
  filtro: FiltroClinico
  urgencia?: 'alta'
  /** SOLO la palabra que disparó, no la frase (privacidad, DISENO §4.1). */
  marca: string
}

// Copia de las frases de crisis de responder-chat (sin tildes). Si allá se añade
// una, el test de divergencia falla hasta que se añada aquí.
export const FRASES_CRISIS_CHAT: readonly string[] = [
  'no quiero vivir', 'no quiero seguir viviendo', 'quiero morirme', 'quiero morir',
  'quitarme la vida', 'acabar con mi vida', 'matarme', 'suicid', 'hacerme dano',
  'lastimarme', 'no vale la pena vivir',
]

const CRISIS_EXTRA: RegExp[] = [
  /\bno quiero seguir con nada\b/,
  /\bno quiero seguir\b/,
  /\bno le veo sentido\b/,
  /\bno le encuentro sentido\b/,
  /\bpienso en no despertar\b/,
  /\bno despertar\b/,
  /\bdesaparecer\b/,
  /\bhacerme dano\b/,
]

// "me quiero morir de X" / "me muero de X" son exageraciones, no crisis.
const EXAGERACION = /\b(me quiero morir|me muero|muerto|muerta)\s+(de|del|por)\s+\S+/g

// Negaciones benignas: "sin ninguna molestia", "no me duele nada". Se borran antes
// de buscar, para que decir que NO hay dolor no dispare la derivación.
const NEGACION_BENIGNA =
  /\b(sin (ninguna |nada de |ningun )?(molestia|molestias|dolor|dolores|lesion|problema|problemas)|no me (duele|dolio|molesta|molesto) (nada|para nada)|nada me (duele|molesta))\b/g

const ANIMO: RegExp[] = [/\bsin ganas de nada\b/, /\bni de comer ni de salir\b/]

const URGENTE: RegExp[] = [
  /(dolor|duele|dolio|ardor|opresion|presion|pinchazo|punzada|aprieta|quemazon)[^,.;]{0,30}\bpecho\b/,
  /\bpecho\b[^,.;]{0,20}(duele|dolio|ardor|opresion|aprieta|quema)/,
  /\bfalta de aire\b|\bme falto el aire\b|\bme falta el aire\b|\bsin aire\b|\bno puedo respirar\b/,
  /\bdesmay/,
]

const CONDUCTA: RegExp[] = [
  /\b(provoque|provocar|provoco|provocarme|obligue|obligarme|induje)\b[^,.;]{0,20}\b(vomit|vomito)/,
  /\bvomit\w*\b[^,.;]{0,25}\b(despues de comer|lo que comi)/,
  /\batracon/,
  /\blaxante/,
  /\bpurg/,
  /\bno comi nada (en )?todo el dia\b/,
]

const MEDICAMENTO: RegExp[] = [
  /\bmedicament/, /\bmedicina/, /\bpastilla/, /\bmelatonina\b/, /\bibuprofeno\b/, /\bacetaminofen\b/,
  /\bdosis\b/, /\bantibiotic/, /\bantiinflamatorio/, /\banticonceptiv/, /\binyeccion\b/,
]

const LESION: RegExp[] = [
  /\blesion/, /\blastim/, /\besguince/, /\bdesgarr/, /\bfractur/, /\bhernia\b/, /\btendinitis\b/,
  /\btendon/, /\bluxacion/, /\bhinch/, /\binflamad/, /\bjalon (en|del|de la|de los)\b/, /\btiron (en|del|de la)\b/,
]

const DOLOR: RegExp[] = [
  /\b(duel|dolor|dolia|dolio|doliendo|dolieron|doler|adolor)/,
  /\bmolest/,
  /\bpinchazo/, /\bpunzada/, /\bpunzante/, /\bcalambre/,
]

const SINTOMA: RegExp[] = [
  /\bmareo/, /\bmaree/, /\bmareada/, /\bmareado/, /\bnausea/, /\bvomit/, /\bsangr/, /\bpalpitac/,
  /\btaquicardia/, /\bahogo/, /\bhormigue/, /\badormec/, /\bentumec/, /\bse me durmio (la|el|un|una)\b/,
  /\bpicazon/, /\bsarpullido/, /\bronchas/, /\bfiebre/, /\bdiarrea/, /\bembaraz/, /\bconvulsi/,
]

function primera(res: RegExp[], n: string): string | null {
  for (const re of res) {
    const m = n.match(re)
    if (m) return m[0].trim()
  }
  return null
}

/** `null` si la frase no trae nada clínico. */
export function filtrarClinico(frase: string): MarcaClinica | null {
  const n = normalizarTexto(frase).replace(EXAGERACION, ' ').replace(NEGACION_BENIGNA, ' ')

  const crisisChat = FRASES_CRISIS_CHAT.find((f) => n.includes(f))
  if (crisisChat) return { filtro: 'crisis', urgencia: 'alta', marca: crisisChat }
  const crisis = primera(CRISIS_EXTRA, n)
  if (crisis) return { filtro: 'crisis', urgencia: 'alta', marca: crisis }

  const urgente = primera(URGENTE, n)
  if (urgente) return { filtro: 'sintoma', urgencia: 'alta', marca: urgente }

  const conducta = primera(CONDUCTA, n)
  if (conducta) return { filtro: 'conducta_alimentaria', urgencia: 'alta', marca: conducta }

  const animo = primera(ANIMO, n)
  if (animo) return { filtro: 'animo', marca: animo }

  const medicamento = primera(MEDICAMENTO, n)
  if (medicamento) return { filtro: 'medicamento', marca: medicamento }

  const dolor = primera(DOLOR, n)
  if (dolor) return { filtro: 'dolor', marca: dolor }

  const lesion = primera(LESION, n)
  if (lesion) return { filtro: 'lesion', marca: lesion }

  const sintoma = primera(SINTOMA, n)
  if (sintoma) return { filtro: 'sintoma', marca: sintoma }

  return null
}

/**
 * Textos fijos. No pasan por el modelo, no interpretan y no aconsejan
 * tratamiento. Ninguno autoriza ni prohíbe entrenar.
 */
export const RESPUESTAS_CLINICAS: Record<FiltroClinico, string> = {
  dolor: 'Gracias por decírmelo. Le paso esto a Bryan para que lo revise; por ahora no anoto nada de este mensaje como un registro normal.',
  lesion: 'Lo que sentiste importa. Se lo paso a Bryan ya; por ahora no anoto nada de este mensaje como un registro normal.',
  sintoma: 'Gracias por avisarme. Se lo paso a Bryan ahora; no puedo decirte qué es. Si sigues mal, busca atención médica.',
  crisis:
    'Gracias por decírmelo. Lo que sientes importa más que el entreno. Le aviso a Bryan ahora. Si estás en peligro o piensas en hacerte daño, llama a la Línea 106 o al 123; no estás solo ni sola.',
  medicamento: 'No puedo recomendar medicamentos ni suplementos. Se lo paso a Bryan y, si te preocupa, consúltalo con un médico.',
  conducta_alimentaria: 'Gracias por contármelo. No registro esta comida. Bryan te va a escribir; no tienes que resolver esto sola ni solo.',
  animo: 'Gracias por decírmelo. Le pido a Bryan que te escriba hoy.',
}

export const RESPUESTA_URGENCIA_ALTA =
  'Lo que describes necesita atención médica pronto. Si sigue o te falta el aire, busca urgencias ahora. Aviso a Bryan de inmediato.'

/** La propuesta de derivación: nada que guardar, aviso a Bryan, texto fijo. */
export function derivarPorFiltro(marca: MarcaClinica): Propuesta {
  const urgente = marca.urgencia === 'alta' && marca.filtro === 'sintoma'
  return {
    accion: 'derivar',
    motivo: 'clinico',
    filtro: marca.filtro,
    urgencia: marca.urgencia,
    registros: [],
    descartado: [],
    notas_coach: [`Filtro clínico (${marca.filtro}): «${marca.marca}»`],
    respuesta: urgente ? RESPUESTA_URGENCIA_ALTA : RESPUESTAS_CLINICAS[marca.filtro],
    citas_invalidas: [],
  }
}
