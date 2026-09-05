import type { EjercicioPrescrito } from '../../../../domain/types'

/**
 * EL RELOJ DE LA PARED Y SUS TRES MODOS.
 *
 * El muro tiene un único hueco que cambia de contenido, y el reloj es lo que hay en él el
 * 95 % del tiempo. Lo que NO es siempre lo mismo es qué está contando:
 *
 * - **sesión** — hacia arriba desde que se abre el salón. Es el modo de reposo.
 * - **descanso** — hacia atrás desde el descanso pautado del ejercicio.
 * - **excéntrico** — hacia atrás desde el tiempo de bajada recomendado de la serie.
 *
 * ## Por qué esto es una función pura y no tres cronómetros
 *
 * Un cronómetro es un `setInterval` y un estado. Tres cronómetros son tres relojes que se
 * desincronizan entre sí y con el de la sesión, y el día que uno se pause mal nadie sabrá
 * cuál manda. Aquí hay UN reloj de pared —un intervalo— y una función que, dado el modo y
 * dos instantes, dice qué texto toca. Los modos no tienen estado propio: tienen un ancla.
 *
 * ## Y por qué se cuenta contra un instante y no restando
 *
 * Restar un tick por intervalo pierde el tiempo que el teléfono estuvo bloqueado: se vuelve
 * de la pantalla de bloqueo y el descanso sigue donde se dejó, marcando de menos. Contra
 * un `Date.now()` guardado, el reloj se recalcula solo y da igual cuánto estuvo apagado.
 */

export type ModoDelReloj = 'sesion' | 'descanso' | 'excentrico'

/**
 * SEGUNDOS DE FASE EXCÉNTRICA POR REPETICIÓN.
 *
 * Tres, y es una CONSTANTE porque el repo no guarda el tempo: `EjercicioPrescrito` no
 * tiene campo de cadencia, y la prescripción del coach lo dice —cuando lo dice— dentro de
 * la prosa. Tres segundos de bajada es la recomendación por defecto del método.
 *
 * // DECISIÓN PENDIENTE: si el tempo llega a guardarse como campo, este número sale de él
 * // y esta constante se queda solo como valor por defecto de los ejercicios que no lo
 * // traigan. Hoy no hay de dónde leerlo sin interpretar prosa.
 */
export const SEGUNDOS_DE_EXCENTRICO = 3

/** Cuánto dura la cuenta atrás de cada modo, en segundos. `0` = ese modo no cuenta atrás. */
export function duracionDelModo(
  modo: ModoDelReloj,
  ejercicio: EjercicioPrescrito | undefined,
): number {
  if (!ejercicio) return 0
  if (modo === 'descanso') return Math.max(0, Math.round(ejercicio.descansoMin * 60))
  if (modo === 'excentrico') {
    return Math.max(0, Math.round(SEGUNDOS_DE_EXCENTRICO * ejercicio.repsDiana))
  }
  return 0
}

/** Qué rótulo lleva el reloj encima. */
export function rotuloDelModo(modo: ModoDelReloj): string {
  if (modo === 'descanso') return 'Descanso'
  if (modo === 'excentrico') return 'Excéntrico'
  return 'Sesión'
}

export interface AnclasDelReloj {
  /** Cuándo se abrió el salón. De aquí cuenta hacia arriba el modo sesión. */
  abierto: number
  /** Cuándo arrancó la cuenta atrás en curso, si hay alguna. */
  cuenta?: number
  /** Cuántos segundos dura esa cuenta atrás. */
  duracion?: number
}

/**
 * SEGUNDOS QUE ENSEÑA EL RELOJ AHORA MISMO.
 *
 * En cuenta atrás puede salir NEGATIVO, y eso es a propósito: quien lo pinte necesita
 * saber que ya pasó de cero para lanzar el aviso y volver al modo sesión. Acotarlo aquí
 * dejaría el reloj clavado en `0:00` sin que nadie se enterara de que terminó.
 */
export function segundosDelReloj(
  modo: ModoDelReloj,
  anclas: AnclasDelReloj,
  ahora: number,
): number {
  if (modo === 'sesion') return Math.max(0, (ahora - anclas.abierto) / 1000)
  if (anclas.cuenta === undefined || anclas.duracion === undefined) return 0
  return anclas.duracion - (ahora - anclas.cuenta) / 1000
}

/**
 * `m:ss`, y el signo se pierde a propósito.
 *
 * Un `-0:03` en la pared no dice nada útil: el aviso ya salió al cruzar el cero. Lo que se
 * enseña mientras el modo vuelve a sesión es `0:00`.
 */
export function comoReloj(segundos: number): string {
  const s = Math.max(0, Math.round(segundos))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
