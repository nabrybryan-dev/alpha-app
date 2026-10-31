import { grados } from '../../../domain/patrones/algebra'

/**
 * LA CAMARA DE LA VISTA DE CUERPO: de frente, con el sujeto de pie y entero DEBAJO de la
 * linea de arriba (nombre, cifras y reloj, hasta ~205 px de 844) y por encima de la lectura
 * y de la hoja. Los cuadros grandes de la pared no se pintan en la portada.
 *
 * No es la del patron: el patron de un press plano mira a un cuerpo TUMBADO desde arriba, y
 * el sujeto de Blender esta siempre de pie. La sala de Blender no deja alejarse mas de ~5,1 m
 * mirando de frente (su muro corto esta a 5,5 m: `topeDeDistanciaEnSala`), asi que el cuerpo
 * de 1,72 m se ajusta con el campo: 45 grados (el del salon es 26; `encuadreDelSalon` no admite
 * mas). Mas alto y mas pequeno que antes para que los pies queden sobre la linea de Praxis.
 */
export const ENCUADRE_DEL_CUERPO = {
  azimut: 0,
  elevacion: 2,
  distancia: 5.1,
  centro: [0, 0.8, 0] as [number, number, number],
}

export function encuadreDelCuerpo() {
  return { ...ENCUADRE_DEL_CUERPO, centro: [...ENCUADRE_DEL_CUERPO.centro] as [number, number, number], campo: grados(45) }
}
