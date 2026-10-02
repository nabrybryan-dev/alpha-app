// Rutas con «.ts»: este módulo lo importa también la Edge Function `praxis-registro` (Deno),
// para que la pantalla y el servidor filtren con la MISMA lista.
import { EXAGERACION_INOFENSIVA, derivarPorFiltro, filtrarClinico, type FiltroClinico } from './registro/filtroClinico.ts'
import type { Propuesta } from './registro/tipos.ts'

/**
 * El filtro de riesgo de Praxis: REGLAS, sin modelo, y lo primero que corre en cada mensaje.
 *
 * Junta las dos listas que ya existían —la de la escena cosmos (`RIESGO_FUERTE`,
 * `RIESGO_AMBIGUO`) y el filtro clínico del registrador— y aplica la regla firmada por
 * Bryan el 29-sep: cuando dos listas discrepan, gana la más protectora.
 *
 *   quieta   → señal explícita (vida, violencia de pareja, un niño en riesgo) o síntoma de
 *              urgencia. La pantalla se detiene y enseña las líneas de ayuda.
 *   cuidado  → frase ambigua («no aguanto más»). Se pregunta directo antes de seguir.
 *   salud    → dolor, lesión, síntoma, medicamento, conducta alimentaria, ánimo. No es un
 *              registro y no llega al modelo.
 *
 * LÍMITE CONOCIDO, y no se disimula: una lista de expresiones NO generaliza. Medido el
 * 29-sep contra el examen reservado, el léxico solo alcanzó 47 % en las frases de riesgo
 * que no había visto. La decisión firmada es diccionario + modelo en cada mensaje; aquí
 * está solo el diccionario. Por eso Praxis sigue cerrada a asesorados.
 *
 * Las frases y los textos los revisa un profesional de salud mental antes de abrir.
 */
export type LineaDeAyuda = 'vida' | 'pareja' | 'nino'

export type MarcaDeRiesgo =
  | { tipo: 'quieta'; linea: LineaDeAyuda }
  | { tipo: 'cuidado' }
  | { tipo: 'salud'; filtro: FiltroClinico }

/** Los únicos números que la base de respuestas de seguridad dio por verificados (29-sep). */
export const NUMEROS_VERIFICADOS = ['123', '106', '155', '141'] as const

/** Las líneas de la Quieta, por tipo de señal: [número, botón, rótulo]. */
export const LINEAS_DE_AYUDA: Record<LineaDeAyuda, [string, string, string][]> = {
  vida: [['123', 'Llamar al 123', 'Línea 123 · emergencias, en todo el país'], ['106', 'Llamar al 106', 'Línea 106 · salud mental, Ministerio de Salud, 24 horas']],
  pareja: [['155', 'Llamar a la Línea 155', 'Línea 155 · violencia de pareja'], ['123', 'Llamar al 123', 'Línea 123 · emergencias, en todo el país']],
  nino: [['141', 'Llamar a la Línea 141', 'Línea 141 · ICBF'], ['123', 'Llamar al 123', 'Línea 123 · emergencias, en todo el país']],
}

/** Minúsculas y sin tildes, conservando el largo y la puntuación. */
export function sinTildes(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Fórmulas de morir o desaparecer que la gente también usa como exageración cuando habla de
 * lo pautado: «me quiero morir con esta rutina», «me pego un tiro si me vuelves a poner
 * cardio», «me quiero tirar por la ventana con esta dieta». Con un ancla de entreno o de
 * dieta y ninguna señal de literalidad, Praxis PREGUNTA (cuidado); si no, se detiene.
 */
const VIDA_EXAGERABLE = /quiero morir|quiero morirme|quisiera morir\w*|ganas de morir\w*|morirme\b|prefiero (estar muert[ao]|morir\w*)|matarme\b|me (quiero|voy a) matar|pegarme un tiro|me pego un tiro|darme un tiro|tirarme (de|del|por) (un|una|el|la) (puente|edificio|balcon|ventana|piso|terraza)|me (quiero|voy a) (tirar|lanzar) (de|del|por) (un|una|el|la) (puente|edificio|balcon|ventana|piso|terraza)/
/**
 * Lo que es literal SIEMPRE, con o sin ancla: decirlo sin rodeos, nombrar el suicidio o un
 * método que no es una muletilla. Nunca se baja a pregunta.
 */
const VIDA_LITERAL = /hacerme dano|hacerme algo|no quiero vivir|no quiero seguir viviendo|quitarme la vida|suicid|mejor no existir|acabar con mi vida|dormirme y no despertar|quisiera no despertar|colgarme|ahorcarme|me ahorque|por fin me colgue|se (quiere|va a) matar|quiere suicidarse|quitarse la vida/
/** Lo pautado: la rutina, un ejercicio, el entreno o la dieta. Lista cerrada. */
const ANCLA = /\b(burpees?|rutinas?|entreno|entrenos|entrenar|entrenamiento|sentadillas?|pierna|series?|cardio|ejercicios?|sesion|sesiones|gimnasio|gym|dieta|plan|madrugar|pesas|abdominales|zancadas|caminadora|spinning|crossfit|brocoli|pollo|ayuno|tabata|hiit|plancha|planchas|repeticiones|press|peso muerto|bulgaras?)\b/
/**
 * Señales de que va en serio aunque haya ancla: «de verdad», «en serio», «ya no», «otra vez»,
 * «todo», «la vida», «siempre», «desde hace», o un plan, un método o un medio.
 */
const LITERALIDAD = /de verdad|la verdad|en serio|ya no\b|otra vez|\btodo\b|\btoda\b|la vida|esta vida|siempre|desde hace|un plan\b|ya (se|tengo) como|las pastillas|unas pastillas|pastillas|cuchilla|cuchillo|veneno|soga|cortarme|me corto|arma\b|pistola/

const OTRAS: [LineaDeAyuda, RegExp][] = [
  ['pareja', /(mi )?(pareja|esposo|esposa|novio|novia|marido|companero|companera|ex) (me )?(pega|pego|golpea|golpeo|amenaza|amenazo|lastima|lastimo|maltrata|maltrato)|violencia (de pareja|en (la )?casa|domestica)|\b(pareja|esposo|esposa|novio|novia|marido|companero|companera|ex)\b.{0,60}\b(me mata|me va a matar|me casca|me casco|cascar\w*|me pega|me golpea)\b/],
  ['nino', /(nino|nina|hijo|hija|bebe) (esta )?en (riesgo|peligro)|le pegan a (mi|un|una) (nino|nina|hijo|hija|bebe)|abusa\w* (de|a) (mi|un|una|la|el) (hija|hijo|nina|nino|sobrina|sobrino)/],
]
/**
 * Un menor al que «tocan» o «manosean»: el verbo solo no basta («el profe lo toca para
 * corregir la postura»); tiene que haber además un menor en la frase.
 */
const TOCAN_A_UN_MENOR = /\b(la|lo|le) (toca|toco|tocan|tocaba|manosea|manoseo|manosean)\b/
const MENOR = /\b(hij[ao]|nin[ao]|sobrin[ao]|menor|\d{1,2} anos)\b/
/** Señales de un ataque cerebral: la cara o medio cuerpo que se duerme o se tuerce. */
const ACV = /se me (durmio|adormecio|cayo|torcio|paralizo) (medio lado|la mitad|un lado|el lado|la cara|la boca)|se me torcio la boca/
const AMBIGUO = /ya no puedo mas|no aguanto mas|no le veo sentido|no veo salida|para que seguir|todo seria mas facil sin mi|desaparecer\b|cansad[ao] de vivir|no vale la pena vivir|mejor sin mi|si (manana )?no aparezco/
/**
 * «No quiero morirme» y las exageraciones con un complemento inofensivo de lista cerrada
 * («me muero de sueño»). La lista vive en el filtro clínico y la usan los dos lados.
 */
const NO_QUIERO_MORIR = /no (quiero|tengo ganas de) morir(me)?\b/g

/**
 * El filtro, en este orden:
 *   1. pareja, un niño, un menor al que tocan, un ataque cerebral → Quieta con su línea;
 *   2. lo literal sin rodeos («no quiero vivir», «suicidarme», «ahorcarme») → Quieta;
 *   3. una fórmula de morir que se usa como exageración: con ancla de entreno o dieta y sin
 *      ninguna señal de literalidad → pregunta de cuidado; si no → Quieta. El humor («jaja»,
 *      un emoji) no cuenta para nada: nunca apaga la marca;
 *   4. el filtro clínico y las frases ambiguas.
 */
export function filtroDeRiesgo(frase: string): MarcaDeRiesgo | null {
  const n = sinTildes(frase).replace(EXAGERACION_INOFENSIVA, ' ').replace(NO_QUIERO_MORIR, ' ')
  if (!n.trim()) return null

  for (const [linea, re] of OTRAS) if (re.test(n)) return { tipo: 'quieta', linea }
  if (TOCAN_A_UN_MENOR.test(n) && MENOR.test(n)) return { tipo: 'quieta', linea: 'nino' }
  if (ACV.test(n)) return { tipo: 'quieta', linea: 'vida' }
  if (VIDA_LITERAL.test(n)) return { tipo: 'quieta', linea: 'vida' }
  if (VIDA_EXAGERABLE.test(n)) return ANCLA.test(n) && !LITERALIDAD.test(n) ? { tipo: 'cuidado' } : { tipo: 'quieta', linea: 'vida' }

  // El filtro clínico recibe la frase ya sin exageraciones.
  const clinico = filtrarClinico(n)
  if (clinico?.filtro === 'sintoma' && clinico.urgencia === 'alta') return { tipo: 'quieta', linea: 'vida' }
  if (AMBIGUO.test(n)) return { tipo: 'cuidado' }
  if (!clinico) return null
  if (clinico.filtro === 'crisis') {
    // Las frases de crisis del chat son explícitas; las demás («no quiero seguir») son ambiguas.
    return /no quiero seguir|no le (veo|encuentro) sentido|no despertar|desaparecer/.test(clinico.marca) ? { tipo: 'cuidado' } : { tipo: 'quieta', linea: 'vida' }
  }
  return { tipo: 'salud', filtro: clinico.filtro }
}

/**
 * Lo que la Edge Function devuelve cuando el filtro marca algo: una derivación, nada que
 * guardar y la marca de riesgo tal cual, para que la pantalla elija la misma línea de ayuda
 * que habría elegido ella. El texto lo pone la pantalla, no el servidor.
 */
export function derivarPorRiesgo(marca: MarcaDeRiesgo): Propuesta {
  if (marca.tipo === 'salud') return derivarPorFiltro({ filtro: marca.filtro, marca: marca.filtro })
  const base = derivarPorFiltro({ filtro: 'crisis', urgencia: 'alta', marca: marca.tipo === 'quieta' ? `riesgo: ${marca.linea}` : 'riesgo: ambiguo' })
  return { ...base, riesgo: marca.tipo === 'quieta' ? { tipo: 'quieta', linea: marca.linea } : { tipo: 'cuidado' } }
}
