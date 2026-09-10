import type { Color } from '../../../domain/patrones/malla'

/**
 * MATERIA de los implementos y las máquinas. Negro mate y acentos rojo profundo, contra la
 * iluminación fija del motor (dos luces y bruma azulada). Un color elegido a ojo fuera sale
 * distinto.
 *
 * Vivía dentro de `implementos.ts`. Salió a su propio módulo el 2026-09-06, cuando la máquina
 * de dominada asistida (`maquinaAsistida.ts`) necesitó el mismo acero y el mismo tapizado sin
 * importar `implementos.ts` de vuelta —que a su vez la importa a ella—.
 */

/** El acero de la barra: claro para que el contraluz la separe del fondo. */
export const ACERO: Color = [0.36, 0.385, 0.43]
/** La manga, un punto más apagada que la barra: es donde no se agarra. */
export const MANGA: Color = [0.26, 0.28, 0.32]
/** Caucho de disco. Casi negro: el disco es masa, no brillo. */
export const CAUCHO: Color = [0.055, 0.06, 0.068]
/** El filo del disco lleva el rojo de la marca. Es el único acento de la barra. */
export const FILO: Color = [0.42, 0.115, 0.125]
/** La cabeza de la mancuerna, hexagonal y mate. */
export const CABEZA: Color = [0.155, 0.165, 0.19]
/** Bastidor de máquina: más oscuro que la barra, para que no le robe la mirada. */
export const BASTIDOR: Color = [0.20, 0.215, 0.245]
/** La pila de placas. Gris medio: se tiene que leer que son muchas y apiladas. */
export const PLACA: Color = [0.30, 0.32, 0.36]
/** Tapizado del respaldo y de los rodillos. */
export const TAPIZADO: Color = [0.15, 0.155, 0.17]
/** El cable de la polea. Fino y claro, porque su DIRECCIÓN es el dato. */
export const CABLE: Color = [0.34, 0.36, 0.40]
