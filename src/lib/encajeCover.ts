/**
 * Encaje `cover` a mano, para pintar en `<canvas>`.
 *
 * CSS resuelve esto con `background-size: cover`, pero un lienzo no: hay que
 * darle a `drawImage` las cuatro medidas, y ahí es donde se cuela el fallo. La
 * primera versión de `LienzoCinematico` llevaba la condición al revés, así que
 * en la ventana de Entrenar —390x352 en el móvil de referencia— la pieza se
 * pintaba a 390x219 y dejaba **66 px de negro arriba y otros 66 abajo**. O sea,
 * exactamente la banda 16:9 flotando sobre negro que este trabajo existe para
 * quitar. Y no se ve desarrollando: sobre un fondo `bg-ink-900` la banda parece
 * una decisión de diseño.
 *
 * La regla, en una línea: **cover escala por el lado que se queda corto.**
 * - Si la imagen es más ancha que la caja, se iguala el ALTO y sobra por los
 *   lados, que es lo que se recorta.
 * - Si es más alta, se iguala el ANCHO y sobra por arriba y por abajo.
 *
 * Nunca deforma —las dos medidas salen de la misma escala— y nunca deja hueco.
 */
export interface Medidas {
  ancho: number
  alto: number
}

export function encajeCover(imagen: Medidas, caja: Medidas): Medidas {
  const escala = Math.max(caja.ancho / imagen.ancho, caja.alto / imagen.alto)
  return { ancho: imagen.ancho * escala, alto: imagen.alto * escala }
}

/**
 * Cuánto se amplía la imagen para cubrir la caja. Por encima de 1 se está
 * inventando detalle que no existe, y R1 pone el techo en 1,05.
 *
 * Es el mismo criterio que usa `fondos-de-tarjeta.test.ts` con las fotos de
 * tarjeta; aquí se comparte para que las piezas cinemáticas se midan igual que
 * ellas y no con una regla propia más blanda.
 */
export function escalaCover(imagen: Medidas, caja: Medidas): number {
  return Math.max(caja.ancho / imagen.ancho, caja.alto / imagen.alto)
}
