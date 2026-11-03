import { describe, expect, it } from 'vitest'
import { Malla, type Color } from '../../../domain/patrones/malla'
import {
  BANDA_DEL_DOLOR,
  CuerpoPintado,
  TRANSICION_MS,
  colorDeRegion,
  colorDeTinte,
  paletaDelTema,
  type Paleta,
} from './pintura'
import { tinteDelCuerpo } from './tinte'

const PALETA: Paleta = { base: [0.2, 0.2, 0.2], luz: [1, 1, 0.8], rojo: [0.9, 0.1, 0.1], tendon: [0.85, 0.85, 0.85] }

function musculo(color: Color): Malla {
  const m = new Malla()
  m.verticeSuelto(0, 0, 0, 0, 0, 1, color, 0)
  m.verticeSuelto(1, 0, 0, 0, 0, 1, [1, 1, 1], 0) // un vertice de tendon: blanco puro
  m.verticeSuelto(0, 1, 0, 0, 0, 1, color, 0)
  m.triangulo(0, 1, 2)
  return m
}

function armar() {
  const dorsal = musculo([0.6, 0.2, 0.2])
  const psoas = musculo([0.5, 0.2, 0.2])
  const cuerpo = new CuerpoPintado([
    { malla: dorsal, nombre: 'Latissimus dorsi muscle.l' },
    { malla: psoas, nombre: 'Psoas major.l' },
  ])
  return { dorsal, psoas, cuerpo }
}
const rgb = (m: Malla, v = 0): number[] => Array.from(m.color.subarray(v * 3, v * 3 + 3)).map((x) => Math.round(x * 1000) / 1000)

describe('el color de una region', () => {
  it('sin series es la base; con k es una mezcla entre la base y la luz; el dolor manda y es rojo', () => {
    expect(colorDeRegion(0, false, PALETA)).toEqual(PALETA.base)
    expect(colorDeRegion(1, false, PALETA)).toEqual(PALETA.luz)
    const medio = colorDeRegion(0.5, false, PALETA)
    expect(medio[0]).toBeCloseTo(0.6)
    expect(colorDeRegion(0.1, true, PALETA)).toEqual(PALETA.rojo)
  })
})

describe('el cuerpo pintado', () => {
  it('trabaja sobre COPIAS: el atlas compartido no se ensucia con el tinte de esta persona', () => {
    const { dorsal, cuerpo } = armar()
    const antes = rgb(dorsal)
    cuerpo.pintar(tinteDelCuerpo({ dors: 3 }, []), PALETA, 'musculo')
    expect(rgb(dorsal)).toEqual(antes)
    expect(cuerpo.musculos).not.toContain(dorsal)
  })

  it('en Musculo, la region trabajada se enciende y la que no tiene region queda en la base', () => {
    const { cuerpo } = armar()
    cuerpo.pintar(tinteDelCuerpo({ dors: 3 }, []), PALETA, 'musculo')
    const [dors, psoas] = cuerpo.musculos
    expect(rgb(dors)).toEqual(PALETA.luz.map((x) => Math.round(x * 1000) / 1000))
    expect(rgb(psoas)).toEqual(PALETA.base.map((x) => Math.round(x * 1000) / 1000))
  })

  it('el tendon (blanco puro) conserva su color aparte y no se tine', () => {
    const { cuerpo } = armar()
    cuerpo.pintar(tinteDelCuerpo({ dors: 3 }, []), PALETA, 'musculo')
    expect(rgb(cuerpo.musculos[0], 1)).toEqual(PALETA.tendon.map((x) => Math.round(x * 1000) / 1000))
  })

  it('el dolor pinta de rojo su region en las tres capas', () => {
    for (const capa of ['piel', 'musculo', 'hueso'] as const) {
      const { cuerpo } = armar()
      cuerpo.pintar(tinteDelCuerpo({ dors: 3 }, ['dors']), PALETA, capa)
      expect(rgb(cuerpo.musculos[0]), capa).toEqual(PALETA.rojo.map((x) => Math.round(x * 1000) / 1000))
    }
  })

  it('en Piel solo se ve el dolor: el tinte de series queda oculto', () => {
    const { cuerpo } = armar()
    cuerpo.pintar(tinteDelCuerpo({ dors: 3 }, []), PALETA, 'piel')
    expect(rgb(cuerpo.musculos[0])).toEqual(PALETA.base.map((x) => Math.round(x * 1000) / 1000))
  })

  it('en Hueso los musculos son translucidos y en las otras capas opacos; los profundos siguen estando', () => {
    const { cuerpo } = armar()
    cuerpo.pintar(tinteDelCuerpo({}, []), PALETA, 'hueso')
    expect(cuerpo.musculos.map((m) => m.alfa)).toEqual([0.3, 0.3])
    cuerpo.pintar(tinteDelCuerpo({}, []), PALETA, 'musculo')
    expect(cuerpo.musculos.map((m) => m.alfa)).toEqual([1, 1])
    expect(cuerpo.musculos).toHaveLength(2)
  })

  it('las copias van con el hueso 0 (de pie, no tumbadas por la raiz del patron) y no llevan textura (una sola tanda de dibujo)', () => {
    const { cuerpo } = armar()
    for (const m of cuerpo.musculos) {
      expect(m.textura).toBeNull()
      expect([...m.hueso].every((h) => h === 0)).toBe(true)
    }
  })

  it('la firma cambia solo si cambia algo que se ve', () => {
    const { cuerpo } = armar()
    const t = tinteDelCuerpo({ dors: 3 }, [])
    const a = cuerpo.firma(t, 'musculo')
    expect(cuerpo.firma(tinteDelCuerpo({ dors: 3 }, []), 'musculo')).toBe(a)
    expect(cuerpo.firma(t, 'hueso')).not.toBe(a)
    expect(cuerpo.firma(tinteDelCuerpo({ dors: 3 }, ['dors']), 'musculo')).not.toBe(a)
    expect(cuerpo.firma(tinteDelCuerpo({ dors: 1, bic: 2 }, []), 'musculo')).not.toBe(a)
  })
})

describe('la paleta sale del contenedor del salon, no de :root', () => {
  it('el salon fuerza data-theme=dark: aunque :root este en claro, el tinte usa la luz del salon', () => {
    // :root en claro: luz oscura. El salon en oscuro: luz clara. Con la paleta de :root el
    // tinte salia INVERTIDO en tema claro (la region trabajada, mas apagada que la que no).
    document.documentElement.style.setProperty('--salon-3d-luz', '#262b33')
    document.documentElement.style.setProperty('--salon-3d-apagada', '#b6bac1')
    const salon = document.createElement('div')
    salon.setAttribute('data-theme', 'dark')
    salon.style.setProperty('--salon-3d-luz', '#e9eef4')
    salon.style.setProperty('--salon-3d-apagada', '#3b414b')
    document.body.appendChild(salon)
    const p = paletaDelTema(salon)
    expect(p.luz[0]).toBeCloseTo(0xe9 / 255)
    expect(p.base[0]).toBeCloseTo(0x3b / 255)
    // y la luz es mas clara que la base: la region trabajada destaca
    expect(p.luz[0]).toBeGreaterThan(p.base[0])
    salon.remove()
    document.documentElement.style.removeProperty('--salon-3d-luz')
    document.documentElement.style.removeProperty('--salon-3d-apagada')
  })
})

/**
 * LOS DOS ROJOS (Bryan, 25-oct): liso = por trabajar, que pasa a «trabajado» en una
 * transición al terminar; a rayas = dolor. No se pueden leer igual.
 */
describe('por trabajar, la transición y las rayas del dolor', () => {
  it('lo pendiente es rojo liso; en Piel no se pinta', () => {
    expect(colorDeTinte({ k: 0, dolor: false, pendiente: true }, PALETA, 'musculo', 0)).toEqual(PALETA.rojo)
    expect(colorDeTinte({ k: 0, dolor: false, pendiente: true }, PALETA, 'piel', 0)).toEqual(PALETA.base)
  })

  it('al terminar pasa del rojo a su color de trabajada en TRANSICION_MS, sin saltos', () => {
    const t = { k: 1, dolor: false, trabajadaEn: 1000 }
    expect(colorDeTinte(t, PALETA, 'musculo', 1000)).toEqual(PALETA.rojo)
    const medio = colorDeTinte(t, PALETA, 'musculo', 1000 + TRANSICION_MS / 2)
    expect(medio[1]).toBeCloseTo((PALETA.rojo[1] + PALETA.luz[1]) / 2)
    expect(colorDeTinte(t, PALETA, 'musculo', 1000 + TRANSICION_MS)).toEqual(PALETA.luz)
  })

  it('la firma cambia durante la transición y se queda quieta al acabar', () => {
    const { cuerpo } = armar()
    const tinte = { ...tinteDelCuerpo({ dors: 2 }, []), dors: { k: 1, dolor: false, trabajadaEn: 0 } }
    const a = cuerpo.firma(tinte, 'musculo', 100)
    const b = cuerpo.firma(tinte, 'musculo', 700)
    expect(a).not.toBe(b)
    expect(cuerpo.firma(tinte, 'musculo', TRANSICION_MS + 1)).toBe(cuerpo.firma(tinte, 'musculo', TRANSICION_MS + 5000))
  })

  it('el dolor va a rayas: dos alturas en bandas vecinas salen de dos rojos distintos', () => {
    const m = new Malla()
    m.verticeSuelto(0, BANDA_DEL_DOLOR * 0.5, 0, 0, 0, 1, [0.5, 0.2, 0.2], 0)
    m.verticeSuelto(0, BANDA_DEL_DOLOR * 1.5, 0, 0, 0, 1, [0.5, 0.2, 0.2], 0)
    m.verticeSuelto(1, BANDA_DEL_DOLOR * 0.5, 0, 0, 0, 1, [0.5, 0.2, 0.2], 0)
    m.triangulo(0, 1, 2)
    const cuerpo = new CuerpoPintado([{ malla: m, nombre: 'Latissimus dorsi muscle.l' }])
    cuerpo.pintar(tinteDelCuerpo({}, ['dors']), PALETA, 'musculo', 0)
    const copia = cuerpo.musculos[0]
    expect(rgb(copia, 0)).toEqual(PALETA.rojo.map((x) => Math.round(x * 1000) / 1000))
    expect(rgb(copia, 1)).not.toEqual(rgb(copia, 0))
    expect(rgb(copia, 1)[0]).toBeGreaterThan(0)
  })

  it('lo pendiente pinta en rojo también el tendón, que de otro modo queda blanco', () => {
    const { cuerpo } = armar()
    cuerpo.pintar(tinteDelCuerpo({}, [], ['dors']), PALETA, 'musculo', 0)
    expect(rgb(cuerpo.musculos[0], 1)).toEqual(PALETA.rojo.map((x) => Math.round(x * 1000) / 1000))
  })
})
