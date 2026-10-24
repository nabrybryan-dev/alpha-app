import { describe, expect, it } from 'vitest'
import { Malla, type Color } from '../../../domain/patrones/malla'
import { INDICE_RAIZ } from '../../../domain/patrones/esqueleto'
import { CuerpoPintado, colorDeRegion, type Paleta } from './pintura'
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

  it('las copias cuelgan de la raiz del sujeto y no llevan textura (una sola tanda de dibujo)', () => {
    const { cuerpo } = armar()
    for (const m of cuerpo.musculos) {
      expect(m.textura).toBeNull()
      expect([...m.hueso].every((h) => h === INDICE_RAIZ)).toBe(true)
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
