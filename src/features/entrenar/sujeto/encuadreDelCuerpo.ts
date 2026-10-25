import { CAMPO_VISUAL } from '../../../domain/patrones/escena'

/**
 * LA CAMARA DE LA VISTA DE CUERPO: de frente, a la altura del pecho, con el sujeto de pie y
 * entero en la mitad de arriba (la hoja y la lectura ocupan la de abajo).
 *
 * No es la del patron: el patron de un press plano mira a un cuerpo TUMBADO desde arriba, y
 * el sujeto de Blender esta siempre de pie. Medido con el campo del salon (26 grados): a 6,3 m
 * el cuerpo de 1,72 m ocupa el 59 % del alto de la pantalla, con la cabeza a ~46 px del borde
 * y los pies al 64 %. El centro mira por debajo del centro del cuerpo (0,42 m) justo para
 * subirlo en el cuadro.
 */
export const ENCUADRE_DEL_CUERPO = {
  azimut: 0,
  elevacion: 4,
  distancia: 6.3,
  centro: [0, 0.42, 0] as [number, number, number],
}

export function encuadreDelCuerpo() {
  return { ...ENCUADRE_DEL_CUERPO, centro: [...ENCUADRE_DEL_CUERPO.centro] as [number, number, number], campo: CAMPO_VISUAL }
}
