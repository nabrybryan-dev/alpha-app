import { filtrarClinico, type FiltroClinico } from './registro/filtroClinico'

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

const FUERTE: [LineaDeAyuda, RegExp][] = [
  ['vida', /hacerme dano|hacerme algo|no quiero vivir|no quiero seguir viviendo|quitarme la vida|matarme|suicid|mejor no existir|quiero morir|quiero morirme|ganas de morir|morirme\b|acabar con mi vida|dormirme y no despertar|quisiera no despertar/],
  ['pareja', /(mi )?(pareja|esposo|esposa|novio|novia|marido|companero|companera|ex) (me )?(pega|pego|golpea|golpeo|amenaza|amenazo|lastima|lastimo|maltrata|maltrato)|violencia (de pareja|en (la )?casa|domestica)/],
  ['nino', /(nino|nina|hijo|hija|bebe) (esta )?en (riesgo|peligro)|le pegan a (mi|un|una) (nino|nina|hijo|hija|bebe)/],
]
const AMBIGUO = /ya no puedo mas|no aguanto mas|no le veo sentido|no veo salida|para que seguir|todo seria mas facil sin mi|desaparecer\b|cansad[ao] de vivir|no vale la pena vivir|mejor sin mi/
/** «No quiero morirme de hambre» y «me muero de sueño» son exageraciones, no señales. */
const EXAGERACION = /no (quiero|tengo ganas de) morir\w*|\b(me quiero morir|me muero|morirme)\s+(de|del|por)\s+\S+/g

export function filtroDeRiesgo(frase: string): MarcaDeRiesgo | null {
  const n = sinTildes(frase).replace(EXAGERACION, ' ')
  if (!n.trim()) return null

  for (const [linea, re] of FUERTE) if (re.test(n)) return { tipo: 'quieta', linea }

  // El filtro clínico recibe la frase ya sin exageraciones: «no quiero morirme de hambre»
  // contiene «quiero morirme», y sin esto dispararía la Quieta.
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
