/**
 * QUE LA FILA DE CIFRAS DEL MURO NO SE CORTE POR EL BORDE DE LA PANTALLA.
 *
 * ## Por qué existe esto
 *
 * La fila de las cuatro cifras del tablón **puede ser más ancha que su propia caja, y es a
 * propósito**: `.muro-prescripcion` lleva `width: max-content` y se centra sobre el cuadro
 * desde el 2026-09-07, cuando las cifras se amontonaban («31221») al verse la pared pequeña
 * con un sujeto tumbado. Entre amontonarse y desbordar, se eligió desbordar.
 *
 * Lo que faltaba era el segundo borde. Medido el 2026-09-11 dejando el salón quieto 40 s:
 * **el tablón NUNCA se sale de la pantalla** —va de x=2,8 a x=386,9 en una de 390— pero su
 * fila de cifras **desborda 7,6 px por la izquierda y 7,4 por la derecha**, así que cuando
 * el encuadre acerca el tablón a un lado, el filo de la pantalla corta «SERIES» y su 3, o
 * «RIR» y su 2, hasta un 15 %. Pasaba en 11 de 40 segundos.
 *
 * Importa más desde que las estaciones se retiran solas: el muro se quedó como el único
 * sitio donde la prescripción está siempre, así que una cifra suya cortada ya no la cubre
 * nadie.
 *
 * ## La regla
 *
 * La fila sigue pudiendo salirse de su caja —eso no se toca— pero **no de la pantalla**. Se
 * mueve lo justo, y solo cuando hace falta.
 *
 * ## La trampa que esto evita, y que ya costó una vez con los carteles
 *
 * El desvío se calcula contra el sitio NATURAL de la fila —el que tendría con el desvío a
 * cero—, nunca contra donde está ahora. Contra su sitio actual es un lazo cerrado: apartada
 * ya no se sale, así que el desvío pedido vuelve a cero, vuelve a salirse, y oscila para
 * siempre. Es la misma lección que `sitioDelCartel`.
 */

/** Cuánto aire se le deja al borde de la pantalla, en píxeles. */
export const MARGEN_DE_PANTALLA = 6

/**
 * Cuántos píxeles hay que mover la fila para que quepa. Cero si ya cabe.
 *
 * @param natural Dónde caería la fila sin desvío ninguno, en píxeles de PANTALLA.
 * @param anchoDePantalla El ancho útil, en píxeles.
 */
export function desvioParaQueQuepa(
  natural: { x0: number; x1: number },
  anchoDePantalla: number,
  margen: number = MARGEN_DE_PANTALLA,
): number {
  const ancho = natural.x1 - natural.x0
  const hueco = anchoDePantalla - 2 * margen
  // NO CABE NI CENTRADA. Puede pasar con la pared muy cerca, porque las cifras tienen un
  // suelo en píxeles para seguir siendo legibles. Entonces se centra: perder un poco por
  // los dos lados se lee mucho mejor que perderlo todo por uno, y sobre todo es SIMÉTRICO,
  // así que ninguna de las cuatro desaparece entera.
  if (ancho >= hueco) return anchoDePantalla / 2 - (natural.x0 + natural.x1) / 2
  if (natural.x0 < margen) return margen - natural.x0
  if (natural.x1 > anchoDePantalla - margen) return anchoDePantalla - margen - natural.x1
  return 0
}
