import type { ResumenSemanal } from './calcular'

/**
 * El guion que dice el vídeo de la revisión semanal.
 *
 * **Esto NO lo escribe un modelo.** En cuanto el vídeo dice números en voz
 * alta, el texto tiene que salir de los mismos números ya calculados que
 * alimentan la tarjeta: una plantilla con huecos, y los huecos los rellena la
 * cuenta. Un modelo suelto puede decirle a alguien que subió cinco kilos
 * cuando fueron tres, y eso no es un fallo de vídeo — es la palabra del coach.
 *
 * La regla, la misma que ya usan las fichas del chat: **si a una frase le falta
 * su dato, la frase se cae entera**. Nunca se rellena con un cero, nunca se
 * deja el hueco a la vista y nunca se dice «no tenemos tu dato» en medio de un
 * vídeo.
 *
 * Y **sin adjetivos**: el guion dice cuántas sesiones hizo, no si la semana
 * estuvo bien. Los cortes que separan un bien de un regular los pone el
 * entrenador y todavía no están escritos.
 */

export interface GuionSemanal {
  /** Las frases que sí tienen dato detrás, en el orden en que se dicen. */
  frases: string[]
  /** El guion entero, listo para leer. */
  texto: string
  /** Cuántas frases se cayeron por falta de dato. Para poder mirarlo después. */
  omitidas: number
}

/** Las cuatro filas que dictó Bryan en su propio vídeo, en su orden. */
type Fila = (r: ResumenSemanal, nombre: string) => string | undefined

const APERTURA: Fila = (_r, nombre) =>
  `Hola ${nombre}, esta es tu revisión de la semana.`

const QUE_HICISTE: Fila = (r) =>
  r.sesionesPautadas > 0
    ? `Te tocaban ${r.sesionesPautadas} sesiones y completaste ${r.sesionesHechas}.`
    : undefined

const LA_COMIDA: Fila = (r) =>
  r.adherenciaPct === undefined
    ? undefined
    : `En alimentación registraste un ${r.adherenciaPct} por ciento de adherencia.`

const EL_SUENO: Fila = (r) => {
  if (r.regularidad.estado === 'medido') {
    return `Tu regularidad de sueño va en ${r.regularidad.indice} sobre 100, sobre ${r.regularidad.nochesConDato} noches registradas.`
  }
  // El que NO tiene dato es el único caso en que se habla de la falta, porque
  // es una invitación y no una excusa: la barra que se llena tira más que un
  // número que aparece de la nada.
  if (r.regularidad.nochesConDato > 0) {
    return `De sueño llevas ${r.regularidad.nochesConDato} de 7 noches registradas: cuando estén las siete, esto ya es un número.`
  }
  return undefined
}

const CIERRE: Fila = () =>
  'Tu plan sigue en pie esta semana. Nos vemos en la próxima sesión.'

const FILAS: Fila[] = [APERTURA, QUE_HICISTE, LA_COMIDA, EL_SUENO, CIERRE]

export function guionSemanal(resumen: ResumenSemanal, nombre: string): GuionSemanal {
  const pila = (nombre ?? '').trim().split(/\s+/)[0] || 'atleta'
  const armadas = FILAS.map((fila) => fila(resumen, pila))
  const frases = armadas.filter((f): f is string => Boolean(f))

  return {
    frases,
    texto: frases.join(' '),
    omitidas: armadas.length - frases.length,
  }
}
