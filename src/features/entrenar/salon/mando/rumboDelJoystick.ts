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

/** Dónde se pinta el disco mientras el dedo lo lleva, ya amarrado. */
export function tiroDelDisco(dx: number, dy: number): { x: number; y: number } {
  const largo = Math.hypot(dx, dy)
  if (largo === 0) return { x: 0, y: 0 }
  const atado = Math.min(largo, AMARRE)
  return { x: (dx / largo) * atado, y: (dy / largo) * atado }
}
