/**
 * LOS MUELLES DE `tokens.css` NO SE HAN SEPARADO DE SU ORIGEN.
 *
 * Las cinco curvas de la jerarquía de movimiento se generan resolviendo la
 * ecuación de un oscilador amortiguado (`scripts/generar-muelles.mjs`). Como
 * acaban pegadas en la hoja de estilo, existe la tentación de ajustar un número
 * «solo un poco» directamente ahí — y entonces la hoja y su origen dicen cosas
 * distintas, nadie sabe cuál manda, y el siguiente que regenere borra el ajuste
 * sin enterarse.
 *
 * Esto lo impide. Y de paso fija las propiedades que hacen que la jerarquía SEA
 * una jerarquía: si alguien toca las masas hasta que lo pesado rebote más que lo
 * ligero, el sistema deja de significar nada aunque cada curva por separado sea
 * válida.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MUELLES, tokens } from '../../scripts/generar-muelles.mjs'

// Se resuelve desde la raíz del proyecto y no con `import.meta.url`: dentro de
// vitest ese URL no siempre es de esquema `file:`, y `new URL(...)` lanza.
const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')

describe('los cinco pesos', () => {
  it('están escritos en tokens.css exactamente como los genera su origen', () => {
    for (const { nombre, ms, curva } of tokens()) {
      // Se busca la línea LITERAL: el token aparece dos veces —el respaldo en
      // `:root` y el muelle dentro del `@supports`— y buscarlo por nombre
      // cazaría la Bézier de respaldo.
      expect(css, `--dur-${nombre} no coincide`).toContain(`--dur-${nombre}: ${ms}ms;`)
      expect(css, `--muelle-${nombre} no coincide`).toContain(`--muelle-${nombre}: ${curva};`)
    }
  })

  it('declara un respaldo para el navegador que no sabe `linear()`', () => {
    // Sin esto, un Safari 17.1 se queda SIN curva —no con la Bézier—, porque el
    // respaldo por declaración repetida no funciona a través de `var()`.
    for (const nombre of Object.keys(MUELLES)) {
      // Sin expresión regular a propósito: escaparla dentro de una plantilla ya
      // dio un falso rojo al montar esto, y aquí basta con la subcadena.
      expect(css, `${nombre} no tiene respaldo`).toContain(`--muelle-${nombre}: var(--ease-`)
    }
    expect(css).toContain('@supports (transition-timing-function: linear(0, 1))')
  })

  it('todos son subamortiguados, que es lo que los hace muelles', () => {
    // Con zeta >= 1 no hay sobrepaso y la curva se vuelve indistinguible de una
    // Bézier — además de que la fórmula se indetermina justo en 1.
    for (const [nombre, m] of Object.entries(MUELLES)) {
      const zeta = m.amortiguacion / (2 * Math.sqrt(m.rigidez * m.masa))
      expect(zeta, `${nombre} tiene zeta ${zeta.toFixed(3)}`).toBeLessThan(0.99)
      expect(zeta, `${nombre} tiene zeta ${zeta.toFixed(3)}`).toBeGreaterThan(0.3)
    }
  })

  it('lo pesado se asienta y lo ligero rebota, no al revés', () => {
    // ES LA REGLA QUE HACE QUE LA JERARQUÍA SIGNIFIQUE ALGO. Un botón puede
    // permitirse una chispa; el atleta no. Si esto se invierte, el resultado se
    // siente a juguete por mucho que cada curva sea físicamente correcta.
    const pico = (nombre: string) =>
      Math.max(...tokens().find((t) => t.nombre === nombre)!.curva
        .replace(/^linear\(|\)$/g, '')
        .split(',')
        .map(Number))

    expect(pico('microinteraccion')).toBeGreaterThan(pico('informativo'))
    expect(pico('informativo')).toBeGreaterThan(pico('protagonista'))
    // Y el protagonista no debe sobrepasar de forma perceptible: por encima del
    // 1 % ya se lee como un rebote, y lo pesado no rebota.
    expect(pico('protagonista')).toBeLessThanOrEqual(1.01)
  })
})
