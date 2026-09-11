import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const AQUI = dirname(fileURLToPath(import.meta.url))
const FUENTE = readFileSync(join(AQUI, 'useCaptura.ts'), 'utf8')

/**
 * QUIEN ESCRIBE EL ÁNGULO ESCRIBE SU CONSEJO, AUNQUE SEA VACÍO.
 *
 * El bucle de captura tiene TRES salidas que escriben la lectura del ángulo, y cada una es
 * un modo distinto: la del disco con su geometría, la de detección perdida, y la de las
 * cuatro marcas. Desde que el consejo vive en su propia línea, **una salida que escriba el
 * valor y no el consejo hereda el del fotograma anterior**: el «⚠ endereza la diana» del
 * modo del disco se queda pegado debajo de un número que ya no lo justifica, señalando algo
 * que esa pantalla ni siquiera mide.
 *
 * Pasó de verdad: de las tres salidas, la del modo de marcas se quedó sin borrarlo.
 *
 * ## Por qué se vigila leyendo el archivo y no ejecutándolo
 *
 * Porque el bucle vive dentro de un `requestAnimationFrame` sobre un `<canvas>` con una
 * cámara detrás, y en el entorno de prueba no hay ni cámara ni contexto de dibujo: montar
 * eso para comprobar un `textContent` daría un test que pasa sin ejercitar nada — que es
 * justo el guardián que nace verde contra el que este repo lleva avisos escritos.
 *
 * Lo que se comprueba es la FORMA del código, que es donde vive el error: **cada vez que
 * alguien añada una salida nueva que escriba el ángulo, este test se pone rojo** hasta que
 * escriba también su consejo. Es una red contra el olvido, no contra el cálculo — el
 * cálculo ya lo cubre `lecturaDeAngulo.test.ts`.
 */
describe('el consejo del ángulo no se queda pegado de un fotograma al siguiente', () => {
  /**
   * La fuente sin un solo espacio en blanco.
   *
   * Se cuenta así, y no con una expresión regular, por dos motivos: una de las tres
   * llamadas está partida en varias líneas por el formateador —así que buscar la línea
   * entera no la ve— y una regular escrita dentro de una cadena es justo lo que se
   * estropea al pasar por un heredoc, que ya nos ha mordido hoy.
   */
  const APRETADA = FUENTE.replace(/\s/g, '')

  /** Las veces que se ESCRIBE cada nodo. El `setProperty` del color no cuenta: pinta. */
  const escrituras = (nodo: string) => APRETADA.split(`escribir(medidas.${nodo}`).length - 1

  it('hay tantas escrituras del consejo como del ángulo', () => {
    const angulo = escrituras('angulo')
    const consejo = escrituras('consejo')
    // Si esto se rompe al añadir una salida, lo que falta NO es bajar el número: es
    // escribir el consejo en la salida nueva, aunque sea con la cadena vacía.
    expect(consejo).toBe(angulo)
  })

  it('y son las tres salidas del bucle, no menos', () => {
    // Fija el número a propósito. Si mañana hay una cuarta salida, este test obliga a
    // mirarla en vez de dejar que el recuento se ajuste solo.
    expect(escrituras('angulo')).toBe(3)
  })

  it('el consejo es opcional en el contrato, para que una pantalla pueda no pintarlo', () => {
    // Las tres escrituras van tras `if (medidas.consejo)`: una pantalla que no declare el
    // nodo no puede romperse por esto.
    const sinGuarda = escrituras('consejo')
    const conGuarda = APRETADA.split('if(medidas.consejo)escribir(medidas.consejo').length - 1
    expect(conGuarda).toBe(sinGuarda)
  })
})
