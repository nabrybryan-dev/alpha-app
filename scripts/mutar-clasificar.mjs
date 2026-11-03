/**
 * Como se juzga la corrida de pruebas con UNA mutacion puesta (T-6 de la revision de Opus).
 *
 * Antes cualquier salida distinta de 0 contaba como «muerta», incluidos un timeout y una mutacion que
 * rompe la sintaxis y hace que el archivo ni cargue: eso mata cualquier mutacion sin que NINGUNA prueba
 * la haya visto. Solo cuenta como muerta si fallo al menos una PRUEBA.
 *
 *   sobrevive      las pruebas pasaron
 *   muerta         fallo al menos una prueba
 *   no_carga       fallo, pero ninguna prueba: error de carga o de sintaxis (no es un kill)
 *   indeterminada  timeout o el proceso no termino (no se sabe)
 */
export function clasificarCorrida({ status, signal = null, error = null, salida = '' }) {
  if (error || signal || status === null || status === undefined) return 'indeterminada'
  if (status === 0) return 'sobrevive'
  const limpia = salida.replace(/\x1b\[[0-9;]*m/g, '')
  return /Tests\s+(?:\d+\s+\w+\s+\|\s+)?\d+\s+failed/.test(limpia) ? 'muerta' : 'no_carga'
}
