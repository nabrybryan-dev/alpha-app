import { readFileSync } from 'node:fs'
import { brotliDecompressSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { leerPieza } from '../escena/piezas3d'
import { CREDITOS_DEL_GIMNASIO } from './creditos'
import { PIEZAS_DEL_ATLAS } from './piezas'

/**
 * EL ATLAS ANATÓMICO, medido sobre las piezas de verdad.
 *
 * Lo que aquí se vigila no es que el atlas «esté»: es que siga cumpliendo las tres cosas
 * que costaron encontrar, y que en cuanto una se rompa el cuerpo deje de verse sin que
 * nada falle en rojo.
 *
 * 1. **La escala.** El atlas viene en metros de persona (1,709 m) y nuestro sujeto no está
 *    en metros: mide 0,555. El convertidor hornea la conversión; si alguien la quita, el
 *    atlas sale tres veces más grande y en el cuadro solo entra el tórax.
 * 2. **El peso.** Son 1,09 MB comprimidos entre las dos, el doble que el gimnasio entero.
 *    Ese número es el que hace que esto se pueda tener dentro; si se dispara, hay que
 *    enterarse aquí y no en el móvil de alguien.
 * 3. **El crédito.** BodyParts3D es CC BY 4.0: usarlo sin nombrar la fuente lo deja fuera
 *    de licencia. No es una comprobación estética.
 */

const PIEZAS = Object.entries(PIEZAS_DEL_ATLAS).map(([nombre, p]) => {
  const ruta = `public${p.ruta}`
  const crudo = readFileSync(ruta)
  return {
    nombre,
    ruta,
    crudo,
    comprimida: readFileSync(`${ruta}.br`),
    mallas: leerPieza(crudo.buffer.slice(crudo.byteOffset, crudo.byteOffset + crudo.byteLength)),
  }
})

describe('las piezas del atlas', () => {
  it('están las dos, con sus estructuras separadas y con nombre propio', () => {
    expect(PIEZAS.map((p) => p.nombre).sort()).toEqual(['atlas-esqueleto', 'atlas-musculos'])
    // Una estructura por malla, no una masa fundida: es lo que permitirá mañana encender un
    // músculo solo. Fundirlas ahorraría llamadas de dibujo y perdería la anatomía.
    const porNombre = Object.fromEntries(PIEZAS.map((p) => [p.nombre, p.mallas.length]))
    expect(porNombre['atlas-esqueleto']).toBeGreaterThan(200)
    expect(porNombre['atlas-musculos']).toBeGreaterThan(300)
  })

  it('vienen a la escala del sujeto, no en metros de persona', () => {
    // Sin esto el atlas mide 1,709 y el sujeto 0,555: tres veces, y en pantalla solo entra
    // el tórax. La caja de las dos piezas juntas tiene que parecerse a la del sujeto.
    let min = Infinity
    let max = -Infinity
    for (const p of PIEZAS) {
      for (const m of p.mallas) {
        for (let i = 1; i < m.posicion.length; i += 3) {
          min = Math.min(min, m.posicion[i])
          max = Math.max(max, m.posicion[i])
        }
      }
    }
    expect(max - min, 'el atlas no está a la escala del sujeto').toBeCloseTo(0.555, 1)
    // Y plantado a la altura del sujeto, no en cero: sus pies están donde los del muñeco.
    expect(min).toBeCloseTo(-0.092, 1)
  })

  it('pesa lo que se dijo, y la copia comprimida es la MISMA pieza', () => {
    let total = 0
    for (const p of PIEZAS) {
      expect(Buffer.compare(brotliDecompressSync(p.comprimida), p.crudo), `${p.nombre}: el .br está desfasado`).toBe(0)
      total += p.comprimida.byteLength
    }
    // 1,09 MB medidos. El margen deja sitio a un reexportado, no a que se doble.
    expect(total).toBeLessThan(1.4e6)
  })

  it('la fuente está acreditada, que es lo que exige su licencia', () => {
    const autores = CREDITOS_DEL_GIMNASIO.map((f) => f.obra)
    expect(autores.some((o) => /BodyParts3D/.test(o)), 'el atlas no está en los créditos').toBe(true)
  })
})
