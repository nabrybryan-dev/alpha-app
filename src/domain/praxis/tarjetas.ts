/**
 * Las tarjetas que Praxis saca del cosmos cuando la conversación nombra su tema
 * (maqueta 7, decisión de Bryan del 22-oct).
 *
 * Es dominio puro: la regla que importa —en una frase de crisis no sale NINGUNA— no puede
 * depender de un componente. Los destinos son pantallas que ya existen; la tarjeta es un
 * atajo, no un flujo nuevo.
 */

export type TemaDeTarjeta = 'checkin' | 'grafica' | 'progreso' | 'dolor' | 'coach'

export interface TarjetaPraxis {
  id: TemaDeTarjeta
  titulo: string
  subtitulo: string
  destino: string
}

export const TARJETAS: Record<TemaDeTarjeta, TarjetaPraxis> = {
  checkin: { id: 'checkin', titulo: 'Mi check-in', subtitulo: 'Dolor, sueño y ánimo', destino: '/bienestar' },
  grafica: { id: 'grafica', titulo: '¿Cómo voy?', subtitulo: 'Tu progresión, aquí', destino: '/progreso' },
  progreso: { id: 'progreso', titulo: 'Mi progreso', subtitulo: 'Peso, cargas y medidas', destino: '/progreso' },
  dolor: { id: 'dolor', titulo: 'Me duele algo', subtitulo: 'Lo anotas para tu coach', destino: '/bienestar' },
  coach: { id: 'coach', titulo: 'Escribir a mi coach', subtitulo: 'Chat con tu equipo', destino: '/chat' },
}

/** Lo que despierta cada tema, en el orden en que lo cuenta la maqueta. */
const SENALES: { tema: TemaDeTarjeta; patron: RegExp; tarjetas: TemaDeTarjeta[] }[] = [
  {
    tema: 'dolor',
    patron: /\b(duele|dolor|molestia|lesion|rodilla|hombro|espalda|codo|muneca|cadera|lumbar)\b/,
    tarjetas: ['dolor', 'coach'],
  },
  {
    tema: 'progreso',
    patron: /\b(peso|medidas|kilos|kg|carga|marca|fuerza|progreso)\b/,
    tarjetas: ['progreso'],
  },
  {
    tema: 'grafica',
    patron: /\b(como voy|progresando|evolucion|mejorando|avance|estoy mejor)\b|\bestancad/,
    tarjetas: ['grafica', 'progreso'],
  },
  {
    tema: 'checkin',
    patron: /\b(check.?in|chequeo|como amaneci|como estoy|dormi|sueno|estres|ansiedad|animo|hambre)\b|\bcansad/,
    tarjetas: ['checkin'],
  },
  {
    tema: 'coach',
    patron: /\b(coach|manuela|nutricionista|escribir|hablar con|preguntar|duda)\b/,
    tarjetas: ['coach'],
  },
]

/**
 * Una crisis no despierta atajos: la Quieta ocupa la pantalla y estas tarjetas se retiran.
 * Se mira aquí, además de en el motor, para que la regla no dependa de un orden de eventos.
 *
 * La lista se exporta porque una frase de crisis se reconoce por partes (`suicid`, `cansad[oa]
 * de vivir`) y la prueba comprueba que no haya repetidos. «No quiero vivir» es literal y tiene
 * que estar nombrado: es la frase que más se dice y la que menos se puede dejar pasar.
 */
export const FRASES_DE_CRISIS: readonly string[] = [
  'quiero morir',
  'quitarme la vida',
  'suicid',
  'no aguanto',
  'no quiero vivir',
  'no quiero seguir viviendo',
  'acabar conmigo',
  'acabar con mi vida',
  'hacerme dano',
  'me quiero matar',
  'cansad[oa] de vivir',
  'mejor no existir',
]

const CRISIS = new RegExp(FRASES_DE_CRISIS.join('|'))

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function temasDe(texto: string): TemaDeTarjeta[] {
  const limpio = normalizar(texto)
  if (!limpio.trim() || CRISIS.test(limpio)) return []
  const salida: TemaDeTarjeta[] = []
  for (const senal of SENALES) {
    if (!senal.patron.test(limpio)) continue
    for (const tema of senal.tarjetas) if (!salida.includes(tema)) salida.push(tema)
  }
  return salida
}

/** Las tarjetas listas para pintar, con el tope de la maqueta: tres. */
export function tarjetasDe(texto: string, maximo = 3): TarjetaPraxis[] {
  return temasDe(texto)
    .slice(0, maximo)
    .map((tema) => TARJETAS[tema])
}
