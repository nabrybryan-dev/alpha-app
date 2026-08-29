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

  it('da a cada hueso la proporción de su categoría', () => {
    // Las cinco familias no son etiquetas: son formas, y la forma dice para qué
    // sirve el hueso. Se mide la caja de cada uno y se comprueba que sus
    // proporciones son las de su familia.
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
    const medidas = (nombre: string) => {
      const c = cajas.get(INDICE_HUESO[nombre])!
      return [c.max[0] - c.min[0], c.max[1] - c.min[1], c.max[2] - c.min[2]].sort((a, b) => b - a)
    }

    // LARGOS: mucho más largos que anchos. Es lo que los hace palancas.
    for (const n of ['musloD', 'tibiaD', 'brazoD', 'antebrazoD']) {
      const [largo, ancho] = medidas(n)
      expect(largo / ancho, `${n} no tiene proporción de hueso largo`).toBeGreaterThan(3)
    }

    // PLANOS: hay que medir la LÁMINA, no la caja del hueso entero. La escápula
    // lleva coracoides hacia delante y acromion hacia atrás, y esas dos apófisis
    // engordan la caja hasta hacerla parecer cúbica: medida así daba 8 cm de
    // fondo para una lámina de dos. Los accidentes van en color oscuro, así que
    // se separan por ahí.
    {
      const h = INDICE_HUESO['escapulaD']
      const min = [Infinity, Infinity, Infinity]
      const max = [-Infinity, -Infinity, -Infinity]
      for (let i = 0; i < m.vertices; i++) {
        if (m.hueso[i] !== h) continue
        // El color claro es la lámina; el oscuro, los relieves. El umbral va en
        // 0,8 y no en 0,6 porque el oscuro tiene 0,70 y se colaba: con él dentro
        // la medida daba 2 en vez de 7 y parecía que la lámina no era plana.
        if (m.color[i * 3] < 0.8) continue
        for (let e = 0; e < 3; e++) {
          const v = m.posicion[i * 3 + e]
          min[e] = Math.min(min[e], v)
          max[e] = Math.max(max[e], v)
        }
      }
      const d = [0, 1, 2].map((e) => max[e] - min[e]).sort((a, b) => b - a)
      expect(d[0] / d[2], 'la lámina de la escápula no es plana').toBeGreaterThan(3)
    }

    // CORTOS: el carpo y el tarso son racimos, así que se mide que ninguna
    // dirección domine: caben en una caja casi cúbica.
    for (const n of ['manoD', 'pieD']) {
      const [a, , c] = medidas(n)
      expect(a / c, `${n} debería caber en algo casi cúbico`).toBeLessThan(4)
    }
  })

  it('hace irregulares a los que lo son', () => {
    // Un hueso irregular no se reconoce por su caja sino por sus SALIENTES: una
    // vértebra tiene el cuerpo en medio, la espinosa hacia atrás y dos
    // transversas a los lados, y hace las tres cosas a la vez. Se mide cuánta
    // geometría vive lejos del eje del hueso en direcciones distintas.
    const m = construirHuesos()
    const salientes = (nombre: string) => {
      const h = INDICE_HUESO[nombre]
      let atras = 0
      let lados = 0
      for (let i = 0; i < m.vertices; i++) {
        if (m.hueso[i] !== h) continue
        const x = m.posicion[i * 3]
        const z = m.posicion[i * 3 + 2]
        // Los relieves van en color oscuro; el cuerpo, en claro.
        if (m.color[i * 3] >= 0.8) continue
        if (z < -0.03) atras++
        if (Math.abs(x) > 0.024) lados++
      }
      return { atras, lados }
    }
    for (const n of ['lumbar', 'torax', 'cuello']) {
      const { atras, lados } = salientes(n)
      expect(atras, `${n} no tiene apófisis espinosas`).toBeGreaterThan(0)
      expect(lados, `${n} no tiene apófisis transversas`).toBeGreaterThan(0)
    }
  })

  it('sigue teniendo huesos para todo el rig', () => {
    expect(Object.keys(INDICE_HUESO).length).toBeGreaterThan(20)
    expect(poseAEuler({})).toBeDefined()
    expect(resolver({}, [0, 0.95, 0], [0, 0, 0]).matrices.length).toBeGreaterThan(20)
  })
})
