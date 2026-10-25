import { grados } from '../../../domain/patrones/algebra'

/**
 * LA CAMARA DE LA VISTA DE CUERPO: de frente, con el sujeto de pie y entero DEBAJO de los
 * cuadros de la pared (nombre del ejercicio y las cuatro cifras, hasta ~205 px de arriba en
 * 844) y por encima de la lectura y de la hoja.
 *
 * No es la del patron: el patron de un press plano mira a un cuerpo TUMBADO desde arriba, y
 * el sujeto de Blender esta siempre de pie. La sala de Blender no deja alejarse mas de ~5,1 m
 * mirando de frente (su muro corto esta a 5,5 m: `topeDeDistanciaEnSala`), asi que el cuerpo
 * de 1,72 m se ajusta con el campo: 42 grados (el del salon es 26; `encuadreDelSalon` admite
 * hasta 45) lo deja en el 44 % del alto, con la cabeza al 25 % y los pies al 69 %.
 */
export const ENCUADRE_DEL_CUERPO = {
  azimut: 0,
  elevacion: 2,
  distancia: 5.1,
  centro: [0, 0.91, 0] as [number, number, number],
}

export function encuadreDelCuerpo() {
  return { ...ENCUADRE_DEL_CUERPO, centro: [...ENCUADRE_DEL_CUERPO.centro] as [number, number, number], campo: grados(42) }
}
