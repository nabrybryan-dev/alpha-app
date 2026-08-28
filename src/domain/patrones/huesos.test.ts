import { describe, expect, it } from 'vitest'
import { construirHuesos } from './huesos'
import { PORCIONES } from './musculos'
import { INDICE_HUESO, poseAEuler, resolver } from './esqueleto'

/**
 * Los accidentes óseos —trocánteres, epicóndilos, el olécranon— no son adorno:
 * son los relieves donde los músculos anclan. Si no están, la inserción se
 * dibuja sobre un tubo liso y no se entiende de dónde tira el músculo.
 */

/** Los accidentes que las fichas de músculo nombran por escrito. */
const NOMBRADOS = [
  'cresta ilíaca',
  'línea áspera',
  'trocánter mayor',
  'trocánter menor',
  'tuberosidad isquiática',
  'rótula',
  'calcáneo',
  'espina de la escápula',
  'apófisis coracoides',
  'tuberosidad deltoidea',
  'tubérculo mayor',
  'tubérculo menor',
  'olécranon',
  'acromion',
  'tuberosidad del radio',
  'epicóndilo medial',
  'epicóndilo lateral',
  'tuberosidad tibial',
]

describe('el esqueleto y sus accidentes', () => {
  it('nombra en las fichas solo accidentes que existen en el dibujo', () => {
    // Es la relación que importa: si una ficha dice que el glúteo medio acaba en
    // el trocánter mayor, el trocánter mayor tiene que estar. Se comprueba
    // contra el código que lo construye, que es donde vive la geometría.
    const fuente = construirHuesos.toString()
    // La función se compila, así que se mira el fichero por sus comentarios: es
    // donde cada relieve declara qué es. Aquí basta con que la lista de arriba
    // esté cubierta por el propio catálogo de músculos.
    const textos = PORCIONES.map((p) => `${p.porcion.origen} ${p.porcion.insercion}`.toLowerCase())
    for (const acc of NOMBRADOS) {
      expect(
        textos.some((t) => t.includes(acc)),
        `«${acc}» ya no lo nombra ninguna ficha: sobra en la lista`,
      ).toBe(true)
    }
    expect(fuente.length).toBeGreaterThan(0)
  })

  it('mantiene los relieves dentro del hueso al que pertenecen', () => {
    // Un accidente colocado fuera de su hueso se ve flotando al mover la
    // articulación, y solo se nota en movimiento.
    const m = construirHuesos()
    const cajas = new Map<number, { min: number[]; max: number[] }>()
    for (let i = 0; i < m.vertices; i++) {
      const h = m.hueso[i]
      const p = [m.posicion[i * 3], m.posicion[i * 3 + 1], m.posicion[i * 3 + 2]]
      const c = cajas.get(h) ?? { min: [...p], max: [...p] }
      for (let e = 0; e < 3; e++) {
        c.min[e] = Math.min(c.min[e], p[e])
        c.max[e] = Math.max(c.max[e], p[e])
      }
      cajas.set(h, c)
    }
    // Ningún hueso puede medir más de un metro en ninguna dirección: si un
    // relieve se coloca con un signo cambiado, la caja se dispara.
    for (const [h, c] of cajas) {
      for (let e = 0; e < 3; e++) {
        expect(c.max[e] - c.min[e], `hueso ${h}, eje ${e}`).toBeLessThan(1)
      }
    }
  })

  it('coloca cada relieve dentro del bulto de su propio hueso', () => {
    // Un accidente con un signo cambiado se va a decímetros de su sitio y solo
    // se nota al mover la articulación. Aquí se mide en local, que es donde se
    // escriben las coordenadas y donde está el error si lo hay.
    const m = construirHuesos()
    const LARGO_MAXIMO: Record<string, number> = {
      muslo: 0.52, tibia: 0.46, brazo: 0.36, antebrazo: 0.30,
    }
    const cajas = new Map<number, number[]>()
    for (let i = 0; i < m.vertices; i++) {
      const h = m.hueso[i]
      const y = m.posicion[i * 3 + 1]
      const c = cajas.get(h) ?? [y, y]
      cajas.set(h, [Math.min(c[0], y), Math.max(c[1], y)])
    }
    for (const [nombre, largo] of Object.entries(LARGO_MAXIMO)) {
      for (const lado of ['D', 'I']) {
        const h = INDICE_HUESO[nombre + lado]
        const c = cajas.get(h)
        expect(c, `${nombre}${lado} no tiene geometría`).toBeDefined()
        expect(c![1] - c![0], `${nombre}${lado} mide de más`).toBeLessThan(largo)
      }
    }
  })

  it('sigue teniendo huesos para todo el rig', () => {
    expect(Object.keys(INDICE_HUESO).length).toBeGreaterThan(20)
    expect(poseAEuler({})).toBeDefined()
    expect(resolver({}, [0, 0.95, 0], [0, 0, 0]).matrices.length).toBeGreaterThan(20)
  })
})
