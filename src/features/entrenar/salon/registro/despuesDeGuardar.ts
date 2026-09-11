import { ejercicioCompleto } from '../../../../domain/cumplimiento'
import type { EjercicioPrescrito } from '../../../../domain/types'

/**
 * QUÉ PASA DESPUÉS DE GUARDAR UNA SERIE.
 *
 * ## Por qué esto es una función y no cuatro `setTimeout` sueltos
 *
 * Guardar una serie dispara cuatro cosas —la ficha se cierra, sale una frase, arranca el
 * descanso, y si era la última el salón pasa al siguiente ejercicio— y no todas ocurren
 * siempre. Escrito dentro del componente, ese «no siempre» son cuatro condiciones cruzadas
 * repartidas por un manejador, y el día que una se toque nadie sabrá qué combinaciones
 * quedaban vivas.
 *
 * Aquí es una decisión pura con nombre: se le da el ejercicio **ya con la serie escrita** y
 * dice qué toca. Se puede probar sin montar el salón, que es lo que hace que las
 * combinaciones raras —la última serie de la última sesión, un ejercicio de una sola
 * serie— tengan prueba en vez de esperanza.
 *
 * ## El descanso NO arranca al terminar el ejercicio
 *
 * Y no es un detalle: el descanso pautado es el que va ENTRE series del mismo ejercicio.
 * Al cerrar el ejercicio, lo que viene es otro ejercicio con su propio calentamiento y su
 * propia primera serie; arrancar ahí una cuenta atrás de tres minutos sería cronometrar
 * algo que el coach no prescribió, y peor: el asesorado la respetaría.
 *
 * ## Y la frase se lee ANTES de que cambie la pantalla
 *
 * Cuando la serie era la última, el salón pasa al siguiente ejercicio solo —`ejercicio` es
 * el primero incompleto de la sesión—. Si eso ocurriera en el mismo fotograma, la frase de
 * logro saldría sobre un salón que ya está anunciando otra cosa. Por eso el relevo se
 * retrasa: primero se lee lo que se acaba de cerrar, y después cambia la sala.
 */

/** Cuánto se queda la frase de logro en pantalla. */
export const LOGRO_MS = 2400

/**
 * Cuánto tarda el salón en pasar al siguiente ejercicio cuando se cierra uno.
 *
 * Novecientos milisegundos: lo justo para leer «completado» sobre la sala que lo era. Es
 * más corto que la frase a propósito —la frase sigue mientras la sala ya cambia—, porque
 * lo que se celebra es el ejercicio, no la pantalla.
 */
export const RELEVO_MS = 900

export interface LoQuePasaAlGuardar {
  /** La frase que sale sobre la sala. */
  frase: string
  /** El rótulo de encima: de qué serie o de qué ejercicio se habla. */
  rotulo: string
  /**
   * Segundos de descanso que arrancan solos. `0` = no arranca ninguno, que es el caso de
   * la última serie: lo que viene no es otra serie de este ejercicio.
   */
  descansoSeg: number
  /** Si el salón tiene que pasar al siguiente ejercicio. */
  cierraElEjercicio: boolean
}

/**
 * @param ejercicio El ejercicio **ya con la serie escrita**. Se relee de la base después de
 *   `registrarSerie`, no se le suma uno a mano: dos cuentas de lo mismo se separan.
 * @param frase La frase de logro, que la pone quien la sortea (`frasePorSerie`).
 */
export function loQuePasaAlGuardar(
  ejercicio: EjercicioPrescrito,
  frase: string,
): LoQuePasaAlGuardar {
  const cierraElEjercicio = ejercicioCompleto(ejercicio)
  const hechas = ejercicio.series.length
  return {
    frase,
    rotulo: cierraElEjercicio
      ? `${ejercicio.nombre} · completado`
      : `Serie ${hechas} de ${ejercicio.sets}`,
    // `descansoMin` puede venir a 0 —hay trabajo que no descansa— y entonces tampoco
    // arranca nada. Redondear hacia arriba evita que 0,4 min se convierta en 24 s de
    // cuenta atrás que nadie pidió; el mínimo es un segundo o no es una cuenta.
    descansoSeg: cierraElEjercicio ? 0 : Math.max(0, Math.round(ejercicio.descansoMin * 60)),
    cierraElEjercicio,
  }
}
