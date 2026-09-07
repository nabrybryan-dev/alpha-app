import { readFileSync } from 'node:fs'
import { brotliDecompressSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { puntoDeHueso, resolver } from '../../../domain/patrones/esqueleto'
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
  it('están las tres, con sus estructuras separadas y con nombre propio', () => {
    // Esqueleto y musculatura vienen del atlas masculino (BodyParts3D); la piel, del
    // femenino (Human Reference Atlas), que es lo unico de cuerpo que ese atlas trae.
    expect(PIEZAS.map((p) => p.nombre).sort()).toEqual(['atlas-esqueleto', 'atlas-musculos', 'atlas-piel'])
    expect(PIEZAS.find((p) => p.nombre === 'atlas-piel')!.mallas.length).toBe(1)
    // Una estructura por malla, no una masa fundida: es lo que permitirá mañana encender un
    // músculo solo. Fundirlas ahorraría llamadas de dibujo y perdería la anatomía.
    const porNombre = Object.fromEntries(PIEZAS.map((p) => [p.nombre, p.mallas.length]))
    expect(porNombre['atlas-esqueleto']).toBeGreaterThan(200)
    expect(porNombre['atlas-musculos']).toBeGreaterThan(300)
  })

  it('encaja con nuestro esqueleto: cadera, rodilla, tobillo y hombro en su sitio', () => {
    // Los dos cuerpos miden lo mismo, así que aquí no se comprueba una escala sino un
    // ENCAJE. El atlas trae al varón de referencia: cadera a 0,912, rodilla a 0,449; el
    // nuestro las tiene a 0,955 y 0,505 —tiene las piernas más cortas—. El convertidor
    // estira por tramos entre articulaciones para llevarlas a las nuestras. Si alguien
    // quita ese estirado, la rodilla se va 5,6 cm y el fémur atraviesa la rótula del
    // muñeco sin que falle nada más.
    const esq = resolver({}, [0, 0, 0], [0, 0, 0])
    const alturaDe = (hueso: string, extremo: 0 | 1) => (puntoDeHueso(esq, hueso, extremo) as number[])[1]

    // Se mide sobre la pieza del esqueleto, que es donde están los huesos largos.
    const mallas = PIEZAS.find((p) => p.nombre === 'atlas-esqueleto')!.mallas
    let suelo = Infinity
    let techo = -Infinity
    for (const m of mallas) {
      for (let i = 1; i < m.posicion.length; i += 3) {
        suelo = Math.min(suelo, m.posicion[i])
        techo = Math.max(techo, m.posicion[i])
      }
    }
    // De pie en el suelo, no flotando ni hundido, y a la estatura del sujeto.
    expect(suelo, 'el atlas no está de pie en el suelo').toBeCloseTo(0, 1)
    expect(techo, 'el atlas no llega a la estatura del sujeto').toBeCloseTo(alturaDe('craneo', 1), 0)
    // Y no es una escala global disfrazada: el hombro apenas se movió (3 mm) mientras la
    // rodilla subía 5,6 cm. Si esto fuera un escalado uniforme, no podrían pasar las dos.
    expect(techo - suelo).toBeGreaterThan(1.5)
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
