/**
 * LA FÍSICA DEL TAMBOR DE LA SEMANA (maqueta 7, vuelve el 30-oct).
 *
 * Se llama `fisicaDelTambor` y no `tamborDeLaSemana` por una razón de Windows: dos archivos
 * que solo se diferencian en la mayúscula inicial —el módulo puro y su componente— chocan al
 * compilar, y el error no habla de mayúsculas sino de un archivo «ya incluido».
 *
 * ## Qué cambia respecto al tambor cilíndrico del 21-25 oct
 *
 * Aquel era un cilindro de siete filas a 360/7 grados: de frente solo se veían tres, y las dos
 * de cada lado quedaban de canto debajo de la ranura, sin poder tocarse. Éste es el de la
 * maqueta: una COLUMNA de siete filas con las vecinas escorzadas (±22° por fila), que no da la
 * vuelta —la semana no es un círculo: tras el sábado no hay otro domingo— y se ve y se toca a
 * dos filas de cada lado. Los días más lejanos se alcanzan arrastrando, con las flechas o
 * enfocándolos con Tab, y hay una prueba de que desde cualquier día se llega a los siete.
 *
 * La posición es el `centro`: un número de fila (0 = primer día) que puede ser fraccionario
 * mientras el dedo arrastra y es entero cuando el tambor encaja.
 *
 * ## Por qué la aritmética vive aquí y no en el componente
 *
 * Un umbral de inercia escrito dentro de un manejador de puntero solo se puede probar
 * montando el componente y moviendo un dedo falso. El gesto se dibuja en el componente, se
 * calcula aquí.
 */

/** Alto de cada fila, en píxeles: también lo que recorre el dedo por fila. Mayor que 44. */
export const ALTO_FILA = 52

/** Cuántas filas se ven y se tocan a cada lado de la de lectura. */
export const FILAS_A_CADA_LADO = 2

/** Grados de escorzo por fila de distancia, y su máximo (los de la maqueta). */
export const GRADOS_POR_FILA = 22
export const INCLINACION_MAXIMA = 70

/** Píxeles de recorrido por debajo de los cuales el gesto es un toque, no un arrastre. */
export const UMBRAL_DE_ARRASTRE = 6

/** Filas por fotograma por debajo de las cuales la inercia se para y el tambor encaja. */
export const VELOCIDAD_MINIMA = 0.02

/** Cuánto se frena la inercia por fotograma. */
export const ROZAMIENTO = 0.92

/** Mantiene el centro dentro de la semana. */
export function limitar(centro: number, n: number): number {
  return Math.min(n - 1, Math.max(0, centro))
}

/** El día entero más cercano: donde el tambor se queda al soltar. */
export function encajar(centro: number, n: number): number {
  return Math.round(limitar(centro, n))
}

/** Qué día queda en la fila de lectura. Nunca un índice fuera de la semana. */
export function diaEnLectura(centro: number, n: number): number {
  return encajar(centro, n)
}

/** Escorzo de una fila a `distancia` filas de la de lectura (negativo arriba). */
export function inclinacionDeFila(distancia: number): number {
  return Math.min(INCLINACION_MAXIMA, Math.max(-INCLINACION_MAXIMA, -distancia * GRADOS_POR_FILA))
}

/** Opacidad de una fila a `distancia` filas de la de lectura (la de maqueta: 1 − 0,3·d, mínimo 0,2). */
export function opacidadDeFila(distancia: number): number {
  return Math.min(1, Math.max(0.2, 1 - Math.abs(distancia) * 0.3))
}

/** Los días que se ven y se pueden tocar con el tambor encajado en `centro`. */
export function diasTocables(centro: number, n: number): number[] {
  const c = encajar(centro, n)
  const dias: number[] = []
  for (let i = c - FILAS_A_CADA_LADO; i <= c + FILAS_A_CADA_LADO; i++) {
    if (i >= 0 && i < n) dias.push(i)
  }
  return dias
}

/**
 * EL SIGUIENTE PASO DE LA INERCIA, en filas.
 *
 * Devuelve `null` cuando ya no queda velocidad o se llegó al tope de la semana: quien lo
 * llame encaja y para. Se devuelve el par entero en vez de mutar, para que un bucle de
 * animación no lleve dos cuentas que puedan separarse.
 */
export function inercia(
  centro: number,
  velocidad: number,
  n: number,
): { centro: number; velocidad: number } | null {
  if (Math.abs(velocidad) < VELOCIDAD_MINIMA) return null
  if ((centro >= n - 1 && velocidad > 0) || (centro <= 0 && velocidad < 0)) return null
  return { centro: limitar(centro + velocidad, n), velocidad: velocidad * ROZAMIENTO }
}
