import { describe, expect, it } from 'vitest'
import { PATRONES } from '../../../domain/patrones/catalogo'
import { esqueletoEnFase } from '../../../domain/patrones/escena'
import { puntoDeHueso } from '../../../domain/patrones/esqueleto'
import { Malla } from '../../../domain/patrones/malla'
import { construirImplementos } from './dibujarImplementos'
import { implementosDeEscena } from './implementos'

/**
 * EL CARDIO TIENE SU MÁQUINA, Y LA MÁQUINA ESTÁ DONDE ESTÁ EL CUERPO.
 *
 * Las seis fichas cíclicas (Bryan, 2026-09-07) no llevan carga, así que no pasan por la
 * tabla de implementos: reciben una máquina propia —cinta, escaladora, bicicleta, elíptica
 * y el ergómetro de remo— y NADA más: ni barra, ni polea, ni banco. Y la máquina se construye contra el
 * cuerpo, como el banco y la prensa, así que lo que se comprueba no es dónde está sino que
 * ABARCA al sujeto: su huella en el suelo contiene los dos pies en las tres fases que se
 * miran, y no hay un solo vértice bajo la goma.
 */

const ciclicos = PATRONES.filter((p) => p.ciclo)
const primerEjemplo = (p: (typeof PATRONES)[number]) => p.ejemplos.split('·')[0].trim()

describe('la máquina del cardio', () => {
  it('cada ficha cíclica recibe una máquina y nada más', () => {
    expect(ciclicos.length).toBeGreaterThanOrEqual(5)
    for (const p of ciclicos) {
      const piezas = implementosDeEscena(p.categoria, primerEjemplo(p)).piezas
      expect(piezas.map((x) => x.pieza), p.id).toEqual(['maquina'])
      expect(['cinta', 'escaladora', 'bicicleta', 'eliptica', 'remo'], p.id).toContain(piezas[0].forma)
    }
  })

  it.each(ciclicos.map((p) => [p.id, p] as const))('%s: abarca a los pies y no cruza el suelo', (_id, p) => {
    const escena = implementosDeEscena(p.categoria, primerEjemplo(p))
    for (const fase of [0, 0.5, 1]) {
      const esq = esqueletoEnFase(p, fase)
      const m = new Malla(8192)
      construirImplementos(m, escena, esq)
      expect(m.vertices, `${p.id} en fase ${fase}: la máquina no dibuja nada`).toBeGreaterThan(0)
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity
      for (let i = 0; i < m.vertices; i++) {
        const x = m.posicion[i * 3], y = m.posicion[i * 3 + 1], z = m.posicion[i * 3 + 2]
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); minY = Math.min(minY, y)
      }
      expect(minY, `${p.id} en fase ${fase}: la máquina cruza el suelo`).toBeGreaterThan(-0.005)
      for (const pie of ['pieD', 'pieI']) {
        const q = puntoDeHueso(esq, pie, 0.5)
        expect(q[0], `${p.id} ${pie} fuera de la máquina en X`).toBeGreaterThan(minX - 0.05)
        expect(q[0]).toBeLessThan(maxX + 0.05)
        expect(q[2], `${p.id} ${pie} fuera de la máquina en Z`).toBeGreaterThan(minZ - 0.05)
        expect(q[2]).toBeLessThan(maxZ + 0.05)
      }
    }
  })
})
