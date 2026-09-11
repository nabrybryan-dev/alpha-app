/**
 * LA FÍSICA DEL TAMBOR DE LA SEMANA.
 *
 * Se llama `fisicaDelTambor` y no `tamborDeLaSemana` por una razón de Windows: dos
 * archivos que solo se diferencian en la mayúscula inicial —el módulo puro y su
 * componente— chocan al compilar, y el error no habla de mayúsculas sino de un archivo
 * «ya incluido».
 *
 * Los siete días no van en una lista: van en un cilindro que se arrastra, coge inercia y
 * encaja solo. Aparte de que es lo que pide el diseño de la sala, hay una razón de uso: en
 * una lista de siete filas el dedo tapa tres, y elegir el jueves obliga a mirar dónde está
 * la mano. En un tambor se tira y se suelta; la fila de lectura no se toca nunca.
 *
 * ## Por qué la aritmética vive aquí y no en el componente
 *
 * Porque un umbral de inercia escrito dentro de un manejador de puntero solo se puede
 * probar montando el componente y moviendo un dedo falso a mano. Es la misma regla que ya
 * cumplen `capas/gestoVertical.ts` y `mando/rumboDelJoystick.ts`: el gesto se dibuja en el
 * componente, se calcula aquí.
 */

/** Los siete días del cilindro. De aquí sale el paso entre filas. */
export const DIAS_DEL_TAMBOR = 7

/** Cuántos grados gira el tambor por cada fila. */
export const PASO = 360 / DIAS_DEL_TAMBOR

/** Grados que gira el tambor por píxel arrastrado. */
export const GRADOS_POR_PIXEL = 0.55

/** Por debajo de esta velocidad la inercia se para y el tambor encaja. */
export const VELOCIDAD_MINIMA = 0.4

/** Cuánto se frena la inercia por fotograma. */
export const ROZAMIENTO = 0.92

/**
 * QUÉ DÍA QUEDA EN LA FILA DE LECTURA, dado el giro del tambor.
 *
 * El módulo se hace DOS veces —una tras dividir y otra tras sumar siete— porque el resto
 * de un negativo en JavaScript es negativo: con `-8 % 7` sale `-1`, y un índice de día en
 * −1 no es ningún día. Girando el tambor hacia arriba varias vueltas, esto se rompería sin
 * la segunda vuelta.
 */
export function diaEnLectura(giro: number): number {
  return ((Math.round(-giro / PASO) % DIAS_DEL_TAMBOR) + DIAS_DEL_TAMBOR) % DIAS_DEL_TAMBOR
}

/** El giro que deja un día concreto en la fila de lectura. */
export function giroDelDia(dia: number): number {
  return -dia * PASO
}

/** El múltiplo de paso más cercano: donde el tambor se queda al soltar. */
export function encajar(giro: number): number {
  return Math.round(giro / PASO) * PASO
}

/**
 * EL SIGUIENTE PASO DE LA INERCIA.
 *
 * Devuelve `null` cuando ya no queda velocidad: quien lo llame encaja y para. Se devuelve
 * el par entero —giro y velocidad— en vez de mutar, para que un bucle de animación no
 * tenga que llevar dos cuentas suyas que puedan separarse.
 */
export function inercia(
  giro: number,
  velocidad: number,
): { giro: number; velocidad: number } | null {
  if (Math.abs(velocidad) < VELOCIDAD_MINIMA) return null
  return { giro: giro + velocidad, velocidad: velocidad * ROZAMIENTO }
}
