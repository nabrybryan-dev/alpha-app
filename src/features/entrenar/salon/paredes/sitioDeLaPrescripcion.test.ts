import { describe, expect, it } from 'vitest'
import { desvioParaQueQuepa, MARGEN_DE_PANTALLA } from './sitioDeLaPrescripcion'

/**
 * LA FILA DEL MURO, DENTRO DEL CUADRO.
 *
 * Las cifras de estas pruebas no son inventadas: son las que midió
 * `testigo/` en el salón el 2026-09-11 —pantalla de 390, tablón de x=2,8 a x=386,9,
 * fila desbordando 7,6 px por la izquierda y 7,4 por la derecha—.
 */
describe('que la fila de cifras no se corte por el borde', () => {
  const PANTALLA = 390

  it('si ya cabe, no la mueve', () => {
    // Y esto importa tanto como lo demás: una fila centrada que se moviera «por si acaso»
    // haría bailar el muro en el 70 % de los segundos en los que no pasa nada.
    expect(desvioParaQueQuepa({ x0: 100, x1: 290 }, PANTALLA)).toBe(0)
  })

  it('la empuja lo justo cuando se sale por la IZQUIERDA', () => {
    // El caso real: tablón en x=2,8 y la fila desbordándolo 7,6 → empieza en -4,8.
    const d = desvioParaQueQuepa({ x0: -4.8, x1: 298.2 }, PANTALLA)
    expect(d).toBeCloseTo(MARGEN_DE_PANTALLA + 4.8, 5)
    expect(-4.8 + d).toBeCloseTo(MARGEN_DE_PANTALLA, 5)
  })

  it('y cuando se sale por la DERECHA', () => {
    // El otro caso real: tablón acabando en 386,9 y la fila 7,4 más allá → 394,3.
    const d = desvioParaQueQuepa({ x0: 91.3, x1: 394.3 }, PANTALLA)
    expect(d).toBeLessThan(0)
    expect(394.3 + d).toBeCloseTo(PANTALLA - MARGEN_DE_PANTALLA, 5)
  })

  it('mueve lo JUSTO: después del desvío sigue tan a un lado como puede', () => {
    // Un desvío que centrara la fila la despegaría del tablón que la sostiene. Aquí el
    // muro se mueve con la cámara y la fila tiene que seguirlo hasta donde la dejen.
    const d = desvioParaQueQuepa({ x0: -1, x1: 250 }, PANTALLA)
    expect(d).toBeCloseTo(7, 5)
    expect(250 + d).toBeLessThan(PANTALLA - MARGEN_DE_PANTALLA)
  })

  it('si NO cabe ni centrada, reparte el recorte por los dos lados', () => {
    // Con la pared muy cerca la fila puede ser más ancha que la pantalla, porque las cifras
    // tienen suelo en píxeles para seguir siendo legibles. Perderlo todo por un lado se
    // comería una de las cuatro entera; repartido, se recorta el borde de las dos de fuera.
    const d = desvioParaQueQuepa({ x0: -40, x1: 420 }, PANTALLA)
    const izq = -40 + d
    const der = 420 + d
    expect(izq).toBeCloseTo(-(der - PANTALLA), 5)
  })

  it('no se realimenta: aplicado sobre el sitio NATURAL, el resultado es estable', () => {
    // El señuelo del lazo cerrado. Se calcula el desvío, se aplica, y se vuelve a preguntar
    // POR EL NATURAL: tiene que dar lo mismo. Calculado sobre el sitio ya desviado daría
    // cero, la fila volvería a salirse, y oscilaría para siempre.
    const natural = { x0: -4.8, x1: 298.2 }
    const primero = desvioParaQueQuepa(natural, PANTALLA)
    const segundo = desvioParaQueQuepa(natural, PANTALLA)
    expect(segundo).toBe(primero)
    // Y lo que NO hay que hacer, escrito para que se vea la diferencia:
    const yaDesviada = { x0: natural.x0 + primero, x1: natural.x1 + primero }
    expect(desvioParaQueQuepa(yaDesviada, PANTALLA)).toBe(0)
  })
})
