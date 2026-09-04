import { formatoDuracion, type EstadoRitmo, type RitmoSesion } from '../../../../domain/ritmoSesion'
import type { EjercicioPrescrito, ItemMarcable } from '../../../../domain/types'

/**
 * LA MARQUESINA DE AVISOS, y de dónde sale cada aviso.
 *
 * Es uno de los rótulos que Bryan marcó en amarillo: una banda que cruza el muro y va
 * pasando lo que hay que saber sin que nadie la toque. La diferencia entre una marquesina
 * y una lista de avisos es que la marquesina no pide sitio: ocupa una línea y el tiempo
 * hace el resto.
 *
 * Función pura, sin React y sin reloj propio: entra el ritmo ya calculado por el dominio y
 * salen las frases. Que se puedan comprobar una a una sin montar la pantalla es lo que
 * permite cambiar el texto de un aviso sin abrir el navegador.
 *
 * ## De dónde sale cada uno, y qué NO se inventa aquí
 *
 * - el bloque en curso, el ejercicio y los minutos que le quedan → `calcularRitmo()`;
 * - el estado del ritmo (acelerado, en ritmo, lento) → el mismo, con su umbral del ±18 %;
 * - el descanso pautado → el `descansoMin` del ejercicio, que lo escribió el coach;
 * - las notas de la semana → los títulos tal cual, sin reescribirlos.
 *
 * **Ninguna frase de prescripción se recorta ni se reescribe aquí.** Las notas del coach
 * viajan con su título literal, y si un título es largo, la marquesina lo pasa entero: es
 * una banda que corre, no una caja con tope. Reescribir lo que dice el coach es cosa del
 * coach, no de la pantalla.
 */

/** El estado del ritmo, dicho en la lengua de la marquesina. */
const ESTADO: Record<EstadoRitmo, string> = {
  acelerado: 'Vas acelerado · respira y cuida la técnica',
  'en-ritmo': 'Vas en ritmo · así se hace',
  lento: 'Se hace tarde · enfoca y acorta charlas',
}

/** El nombre largo del bloque en curso. */
const BLOQUE: Record<string, string> = {
  FUERZA: 'Bloque de fuerza',
  ACCESORIO: 'Bloque accesorio',
  'DINÁMICO': 'Bloque dinámico y de control',
}

/** Cómo se llama el bloque en curso, o la sesión si aún no hay ninguno. */
export function nombreDeBloque(ritmo: RitmoSesion): string {
  return ritmo.bloqueActual ? BLOQUE[ritmo.bloqueActual] : 'Sesión'
}

/**
 * La línea del muro con la duración estimada, el bloque y el ejercicio n de N.
 *
 * Los tres datos van juntos y en ese orden porque responden a la misma pregunta —«¿por
 * dónde voy?»— y separarlos en tres rótulos sería volver a las tarjetas.
 */
export function lineaDeRitmo(ritmo: RitmoSesion): string {
  const partes = [`≈ ${formatoDuracion(ritmo.totalSeg)}`, nombreDeBloque(ritmo)]
  if (ritmo.totalEjercicios > 0 && ritmo.ejercicioActual > 0) {
    partes.push(`Ejercicio ${ritmo.ejercicioActual}/${ritmo.totalEjercicios}`)
  }
  return partes.join('  ·  ')
}

export interface AvisosDelSalon {
  /** Las frases, en el orden en que pasan. */
  frases: readonly string[]
  /** El estado del ritmo, para teñir la banda. */
  estado: EstadoRitmo
}

/**
 * Los avisos que pasan por la marquesina.
 *
 * El orden no es casual: primero lo que corre (cuánto queda del ejercicio), luego cómo se
 * va de tiempo, luego lo que el coach dejó escrito para la semana, y al final el recordatorio
 * del descanso, que es el que más se salta y el que menos urge.
 */
export function avisosDelSalon(
  ritmo: RitmoSesion,
  ejercicio: EjercicioPrescrito | undefined,
  notas: readonly ItemMarcable[],
): AvisosDelSalon {
  const frases: string[] = []

  if (ritmo.ejercicioActual > 0 && ritmo.restaEjercicioMin > 0) {
    frases.push(`~${ritmo.restaEjercicioMin} min para el siguiente ejercicio`)
  }
  frases.push(ESTADO[ritmo.estado])
  for (const nota of notas) frases.push(nota.titulo)
  if (ejercicio) {
    frases.push(`Descanso pautado: ${ejercicio.descansoMin} min entre series`)
  }
  frases.push('Respeta los descansos: son parte del estímulo')

  return { frases, estado: ritmo.estado }
}

