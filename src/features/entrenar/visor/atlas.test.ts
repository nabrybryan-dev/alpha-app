import { readFileSync } from 'node:fs'
import { brotliDecompressSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { leerPieza } from '../escena/piezas3d'
import { CREDITOS_DEL_GIMNASIO } from './creditos'
import { PIEZAS_DEL_ATLAS, piezasDelAtlas } from './piezas'

/**
 * EL ATLAS ANATOMICO ES EL SUJETO DE BLENDER (aprobado por Bryan el 28/29-sep), medido sobre
 * las piezas de verdad.
 *
 * - Escritorio: musculos completos (299 mil triangulos) y esqueleto completo.
 * - Celular: musculos de 200 mil triangulos y esqueleto `-movil` (decision de Bryan, 23-oct).
 * - La piel es la de la landing (`atlas-piel-alta`), alineada con estos musculos.
 * - Ningun musculo profundo se quita: las 522 partes siguen en las dos versiones.
 */

function cargar(ruta: string) {
  const crudo = readFileSync(`public${ruta}`)
  const comprimida = readFileSync(`public${ruta}.br`)
  const mallas = leerPieza(crudo.buffer.slice(crudo.byteOffset, crudo.byteOffset + crudo.byteLength))
  return { crudo, comprimida, mallas }
}

function triangulos(mallas: { indice: ArrayLike<number> }[]): number {
  return mallas.reduce((s, m) => s + m.indice.length / 3, 0)
}

describe.each([
  { nombre: 'escritorio', movil: false, musculos: '/piezas/atlas-musculos-alpha.pieza', esqueleto: '/piezas/atlas-esqueleto-alpha.pieza', trisMusculos: [299_000, 299_500], tope: 3.5e6 },
  { nombre: 'celular', movil: true, musculos: '/piezas/atlas-musculos-alpha-movil-200k.pieza', esqueleto: '/piezas/atlas-esqueleto-alpha-movil.pieza', trisMusculos: [197_000, 197_500], tope: 2.2e6 },
])('el sujeto de Blender en $nombre', ({ movil, musculos, esqueleto, trisMusculos, tope }) => {
  const piezas = piezasDelAtlas(movil)

  it('las tres capas siguen llamandose igual y apuntan a las piezas de Blender', () => {
    expect(Object.keys(piezas).sort()).toEqual(['atlas-esqueleto', 'atlas-musculos', 'atlas-piel'])
    expect(piezas['atlas-musculos'].ruta).toBe(musculos)
    expect(piezas['atlas-esqueleto'].ruta).toBe(esqueleto)
    expect(piezas['atlas-piel'].ruta).toBe('/piezas/atlas-piel-alta.pieza')
  })

  it('los musculos: 522 partes con nombre y los triangulos de la entrega', () => {
    const { mallas } = cargar(piezas['atlas-musculos'].ruta)
    expect(mallas.length).toBe(522)
    expect(mallas.every((m) => (m.textura ?? '').length > 0)).toBe(true)
    const t = triangulos(mallas)
    expect(t).toBeGreaterThanOrEqual(trisMusculos[0])
    expect(t).toBeLessThanOrEqual(trisMusculos[1])
  })

  it('el esqueleto trae sus 296 huesos y esta de pie en el suelo, a 1,71 m', () => {
    const { mallas } = cargar(piezas['atlas-esqueleto'].ruta)
    expect(mallas.length).toBe(296)
    let suelo = Infinity
    let techo = -Infinity
    for (const m of mallas) {
      for (let i = 1; i < m.posicion.length; i += 3) {
        suelo = Math.min(suelo, m.posicion[i])
        techo = Math.max(techo, m.posicion[i])
      }
    }
    expect(suelo).toBeCloseTo(0, 1)
    expect(techo).toBeCloseTo(1.71, 1)
  })

  it('pesa lo que se dijo, y la copia comprimida es la MISMA pieza', () => {
    let total = 0
    for (const p of Object.values(piezas)) {
      const { crudo, comprimida } = cargar(p.ruta)
      expect(Buffer.compare(brotliDecompressSync(comprimida), crudo), `${p.ruta}: el .br esta desfasado`).toBe(0)
      total += comprimida.byteLength
    }
    expect(total).toBeLessThan(tope)
  })
})

describe('compatibilidad', () => {
  it('PIEZAS_DEL_ATLAS es la version de escritorio', () => {
    expect(PIEZAS_DEL_ATLAS).toEqual(piezasDelAtlas(false))
  })
})

describe('creditos', () => {
  it('los musculos son de Z-Anatomy (CC BY-SA 4.0) y los huesos de BodyParts3D: las dos fuentes estan acreditadas', () => {
    const obras = CREDITOS_DEL_GIMNASIO.map((f) => f.obra)
    expect(obras.some((o) => /BodyParts3D/.test(o))).toBe(true)
    const z = CREDITOS_DEL_GIMNASIO.find((f) => /Z-Anatomy/.test(f.obra))
    expect(z, 'Z-Anatomy no esta en los creditos').toBeDefined()
    expect(z!.licencia).toBe('CC BY-SA')
  })
})
