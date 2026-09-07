/**
 * HACIA DÓNDE SE TIRÓ DEL MANDO.
 *
 * La aritmética del joystick, separada de su dibujo, y por el mismo motivo por el que la
 * del eje W vive en `capas/gestoVertical.ts`: un umbral escrito dentro de un manejador de
 * puntero solo se puede probar montando el componente y moviendo un dedo falso. Aquí se
 * prueba con dos números.
 */

/** Los cuatro sitios a los que se puede tirar, más el centro. */
export type RumboDelMando = 'izquierda' | 'derecha' | 'arriba' | 'abajo' | 'centro'

/**
 * A PARTIR DE CUÁNTOS PÍXELES CUENTA COMO TIRÓN.
 *
 * Dieciséis, y no cero: el pulgar nunca vuelve al punto exacto donde bajó, así que sin una
 * zona muerta cualquier toque saldría con rumbo y el mando cambiaría el reloj al rozarlo.
 */
export const ZONA_MUERTA = 16

/**
 * HASTA DÓNDE SE SEPARA EL DISCO DEL CENTRO.
 *
 * Veintidós. El disco sigue al dedo, pero atado: un mando que se va con el dedo hasta el
 * borde de la pantalla deja de leerse como un mando y pasa a ser algo que se arrastra.
 */
export const AMARRE = 22

/**
 * EL EJE DOMINANTE DECIDE, y no el ángulo.
 *
 * Con umbrales por ángulo hay cuatro fronteras a 45° donde un tirón diagonal salta entre
 * dos rumbos mientras el dedo tiembla. Comparando |dx| con |dy| solo hay UNA frontera y el
 * rumbo elegido es siempre el del movimiento más largo, que es lo que la mano cree que
 * está haciendo.
 */
export function rumboDelJoystick(dx: number, dy: number): RumboDelMando {
  if (Math.hypot(dx, dy) < ZONA_MUERTA) return 'centro'
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'izquierda' : 'derecha'
  return dy < 0 ? 'arriba' : 'abajo'
}

/**
 * CUÁNTO HAY QUE AGUANTAR EL DISCO PARA QUEDARSE CON EL TIEMPO DE LA REPETICIÓN.
 *
 * Cuatrocientos veinte milisegundos, y el número separa dos gestos que salen del mismo
 * contacto: un tirón —el que cambia lo que cuenta la pared— se hace y se suelta en menos
 * de eso; aguantar es otra intención. Es el mismo reparto que ya usa el cuerpo entre tocar
 * y hundirse (`capas/hundirEnElCuerpo.ts`, 320 ms), un pelo más largo porque aquí el
 * tirón corto tiene que seguir siendo cómodo.
 *
 * Solo se toma el tiempo si el dedo NO ha salido de la zona muerta cuando vence: quien ya
 * está tirando hacia un lado está pidiendo otra cosa.
 */
export const ESPERA_DEL_RECORRIDO = 420

/**
 * CUÁNTO DEDO ES UNA REPETICIÓN ENTERA, en píxeles.
 *
 * Ciento ochenta: algo menos de la mitad del ancho de un teléfono, así que la repetición
 * entera cabe en un barrido del pulgar sin soltar y sin llegar al borde. Más corto y cada
 * píxel salta media fase —no se puede parar en el punto que se quiere mirar—; más largo y
 * no se llega al final sin recolocar la mano.
 */
export const RECORRIDO_COMPLETO = 180

/**
 * EN QUÉ FASE DEJA EL DEDO LA DEMOSTRACIÓN.
 *
 * De 0 (arriba, antes de bajar) a 1 (el fondo del recorrido). Hacia la derecha avanza el
 * gesto y hacia la izquierda se rebobina, que es el sentido en el que se lee una línea de
 * tiempo en cualquier reproductor.
 *
 * Es proporcional y con topes, no circular: pasarse por la derecha deja la fase en 1 y
 * quieta. Dar la vuelta al llegar al final convertiría un dedo que se pasa un poco en una
 * repetición entera hacia atrás.
 */
export function faseDelRecorrido(dx: number, faseAlAgarrar: number): number {
  const base = Number.isFinite(faseAlAgarrar) ? faseAlAgarrar : 0
  if (!Number.isFinite(dx)) return Math.min(1, Math.max(0, base))
  return Math.min(1, Math.max(0, base + dx / RECORRIDO_COMPLETO))
}

/** Dónde se pinta el disco mientras el dedo lo lleva, ya amarrado. */
export function tiroDelDisco(dx: number, dy: number): { x: number; y: number } {
  const largo = Math.hypot(dx, dy)
  if (largo === 0) return { x: 0, y: 0 }
  const atado = Math.min(largo, AMARRE)
  return { x: (dx / largo) * atado, y: (dy / largo) * atado }
}
