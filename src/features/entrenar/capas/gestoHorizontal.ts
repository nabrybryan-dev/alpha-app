/**
 * EL GESTO QUE CAMBIA DE EJERCICIO: dedo en horizontal sobre el salón.
 *
 * Nace el 2026-09-05 porque Bryan no podía moverse por la app: «no me deja desplazarme
 * entre ejercicios». Y no le fallaba a él, estaba escondido. Hasta hoy había que apoyar el
 * dedo sobre el cuerpo, **aguantarlo 320 ms hasta que empezaba a hundirse**, y solo entonces
 * tirar a un lado; un deslizamiento normal no hacía nada, porque el arrastre horizontal
 * estaba reservado a girar la cámara. Eso no se parece a ninguna app que la gente use: en
 * todas, deslizar de lado pasa al siguiente y punto.
 *
 * Aquí está la regla, y es una función pura a propósito —como `gestoVertical.ts`—: qué
 * cuenta como barrido se tiene que poder probar sin navegador, sin WebGL y sin puntero.
 *
 * ## El bloqueo de dirección
 *
 * Los primeros píxeles deciden a quién pertenece el gesto, y una vez decidido **no cambia
 * de dueño hasta que se levanta el dedo**. Es lo que impide el peor de los resultados: un
 * gesto que orbita un poco, luego salta de ejercicio, y luego vuelve a orbitar. Mientras no
 * haya recorrido lo bastante para decidir, no se hace nada — ni se orbita ni se salta.
 *
 * ## Por qué el dedo suelto es de NAVEGAR y la órbita se va a dos dedos
 *
 * Es la convención de las apps con un modelo 3D dentro de algo por lo que se navega: un
 * dedo mueve la página o el carrusel, dos dedos manipulan el modelo. Aquí manda lo mismo,
 * y encaja con lo que el salón ya tenía: el pellizco de dos dedos ya acercaba y alejaba,
 * así que orbitar con dos dedos cae en la misma mano. Mantener el dedo QUIETO sigue siendo
 * hundirse en las capas: eso no compite, porque un gesto que no se mueve no es un barrido.
 */

/**
 * A quién pertenece el gesto.
 *
 * `no-es-barrido` no dice a QUIÉN es —eso lo decide quien llama—: con un dedo en el salón
 * es el eje W, y la cámara ya no entra aquí porque se maneja con dos dedos.
 */
export type DuenoDelGesto = 'sin-decidir' | 'barrido' | 'no-es-barrido'

/**
 * Cuánto dedo hace falta para decidir de quién es el gesto, en píxeles CSS.
 *
 * Doce, que es el orden en que lo resuelven los sistemas operativos táctiles antes de
 * bloquear la dirección de un desplazamiento. Por debajo está el temblor de un dedo que
 * solo quería tocar, y decidir ahí volvería impredecible el gesto; muy por encima, el
 * salón se movería un rato antes de saber si iba a saltar de ejercicio.
 */
export const PIXELES_QUE_DECIDEN = 12

/**
 * Cuánto tiene que dominar lo horizontal para que sea un barrido.
 *
 * 1,3 deja pasar cualquier gesto dentro de unos 37° de la horizontal, que es la holgura
 * con la que se desliza un pulgar —que no traza rectas—, y deja fuera la diagonal ambigua,
 * que no se lleva nadie: un gesto que no se sabe lo que quiere no debe cambiar de ejercicio.
 */
export const CUANTO_DOMINA_LO_HORIZONTAL = 1.3

/**
 * Cuánto dedo cuesta UN ejercicio, en píxeles CSS.
 *
 * Cincuenta y seis, un 14 % del ancho de un teléfono de 390. Es cómodo con el pulgar sin
 * ser un roce: el umbral viejo eran 40 px, y a esa distancia un resbalón mientras el dedo
 * ya estaba apoyado saltaba de ejercicio sin quererlo. Un arrastre largo NO atropella tres
 * de una vez: quien llama vuelve a poner el origen en el punto donde saltó, igual que hace
 * el eje W en `gestoVertical.ts`.
 */
export const PIXELES_POR_EJERCICIO = 56

/**
 * De quién es el gesto, dado lo recorrido DESDE EL ORIGEN del arrastre.
 *
 * Devuelve `sin-decidir` mientras no haya recorrido bastante: quien llama no debe hacer
 * nada todavía, ni saltar ni orbitar.
 */
export function duenoDelGesto(dx: number, dy: number): DuenoDelGesto {
  if (Math.abs(dx) < PIXELES_QUE_DECIDEN && Math.abs(dy) < PIXELES_QUE_DECIDEN) return 'sin-decidir'
  return Math.abs(dx) > Math.abs(dy) * CUANTO_DOMINA_LO_HORIZONTAL ? 'barrido' : 'no-es-barrido'
}

/**
 * Cuántos ejercicios avanza un barrido, y en qué sentido.
 *
 * Deslizar hacia la IZQUIERDA avanza al siguiente —el sentido de pasar página en un
 * carrusel—, así que un `dx` negativo devuelve +1. Cero significa que todavía no llega.
 */
export function ejerciciosQueAvanza(dx: number): number {
  if (Math.abs(dx) < PIXELES_POR_EJERCICIO) return 0
  return dx < 0 ? 1 : -1
}

/**
 * El ejercicio al que se llega, dando la vuelta por los dos extremos.
 *
 * El módulo se hace sumando el total para que retroceder desde el primero no dé −1.
 */
export function ejercicioTrasBarrido(actual: number, avance: number, total: number): number {
  if (total < 1) return 0
  return (((actual + avance) % total) + total) % total
}
