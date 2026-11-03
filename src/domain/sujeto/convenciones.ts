/**
 * Convenciones del sujeto anatómico propio (M3 a M5 del plan operativo del 20-oct).
 *
 * Una sola vez y aquí, para que ningún módulo las reinvente:
 *
 *  · **Unidades SI en el núcleo.** Metros, kilogramos, segundos, newton, newton-metro y
 *    radianes. Los grados y los kilos con decimales de la pantalla se convierten en el borde.
 *    Un reparto o una razón es adimensional: se escribe `'1'` (0,35 y no 35), nunca `'%'`.
 *  · **Plano sagital del salón.** `z` hacia donde mira el sujeto (el salón lo mira hacia +Z) e
 *    `y` hacia arriba. Es el mismo par que usa `patrones/gravedad.ts` para la base de apoyo.
 *    Toda función del dominio declara en su cabecera en qué plano trabaja.
 *  · **Signo de un momento articular.** Se define en `dinamica.ts`, donde se usa, y cada prueba
 *    lo comprueba contra un caso escrito a mano.
 *  · **Estados de una cifra**: `observado` (salió de la imagen o de un sensor), `calculado`
 *    (función exacta de entradas dadas), `estimado` (usa una tabla poblacional o un supuesto,
 *    lleva banda), `simulado` (sale de un modelo sin medición) y `no_afirmable` (falta algo;
 *    el valor es `null`, nunca cero).
 *  · **Versión del modelo** guardada con cada resultado, para reproducir lo que se le dijo a
 *    alguien. Se sube cuando cambia una tabla, una ecuación o un supuesto.
 */

export const VERSION_DEL_MODELO = 'sujeto-0.1.0'

/** El conjunto cerrado de unidades que el núcleo acepta. `'1'` es adimensional. */
export const UNIDADES = [
  'm',
  'kg',
  's',
  'N',
  'N·m',
  'rad',
  'm/s',
  'm/s²',
  'rad/s',
  'rad/s²',
  'kg·m²',
  'm²',
  '1',
] as const
export type Unidad = (typeof UNIDADES)[number]

export const ESTADOS = ['observado', 'calculado', 'estimado', 'simulado', 'no_afirmable'] as const
export type EstadoDeCifra = (typeof ESTADOS)[number]

/** Aceleración de la gravedad (m/s²), valor convencional de la CGPM de 1901. */
export const GRAVEDAD = 9.80665

/** Un punto del plano sagital: `z` adelante, `y` arriba, en metros. */
export interface Punto {
  z: number
  y: number
}
