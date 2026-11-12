import { describe, expect, it } from 'vitest'
import {
  BARRA_POR_ETAPA_ACTIVA,
  PESTANAS_POR_ETAPA,
  etapaDe,
  pestanasDeLaBarra,
  proponeFocoEnComida,
  type DiaDeComida,
} from './etapaDeLaBarra'

const base = { cribadoPendiente: false, tieneMicrociclo: true }
const semana = (sinCumplir: number, aOjo = 0): DiaDeComida[] =>
  Array.from({ length: 7 }, (_, i) => ({
    fecha: `2026-11-0${i + 1}`,
    cumplio: i >= sinCumplir,
    aOjo: i < aOjo ? true : undefined,
  }))

describe('etapaDe y las tres listas', () => {
  it('empezando: cribado pendiente', () => {
    const e = etapaDe({ ...base, cribadoPendiente: true })
    expect(e).toBe('empezando')
    expect(PESTANAS_POR_ETAPA[e]).toEqual(['Hoy', 'Empezar', 'Praxis', 'Salón', 'Nutrición'])
  })
  it('empezando: sin microciclo (primer plan)', () => {
    expect(etapaDe({ ...base, tieneMicrociclo: false })).toBe('empezando')
  })
  it('entrenando', () => {
    const e = etapaDe(base)
    expect(e).toBe('entrenando')
    expect(PESTANAS_POR_ETAPA[e]).toEqual(['Hoy', 'Salón', 'Praxis', 'Nutrición', 'Semana'])
  })
  it('foco en comida solo con confirmación del coach', () => {
    const e = etapaDe({ ...base, focoEnComidaConfirmado: true })
    expect(e).toBe('comida')
    expect(PESTANAS_POR_ETAPA[e]).toEqual(['Hoy', 'Nutrición', 'Praxis', 'Salón', 'Semana'])
  })
  it('empezar manda sobre foco en comida', () => {
    expect(etapaDe({ cribadoPendiente: true, tieneMicrociclo: true, focoEnComidaConfirmado: true })).toBe('empezando')
  })
  it('Hoy a la izquierda y Praxis al centro en las tres', () => {
    for (const l of Object.values(PESTANAS_POR_ETAPA)) {
      expect(l[0]).toBe('Hoy')
      expect(l[2]).toBe('Praxis')
    }
  })
})

describe('regla 3 de 7', () => {
  it('3 de 7 sin cumplir propone', () => expect(proponeFocoEnComida(semana(3))).toBe(true))
  it('2 de 7 no propone', () => expect(proponeFocoEnComida(semana(2))).toBe(false))
  it('el día a ojo no cuenta en contra (3 sin cumplir con 1 a ojo = 2)', () => {
    expect(proponeFocoEnComida(semana(3, 1))).toBe(false)
  })
  it('el día a ojo no cuenta a favor (2 sin cumplir + 1 a ojo sin cumplir no suma)', () => {
    const dias = semana(2)
    dias[2] = { ...dias[2], cumplio: false, aOjo: true }
    expect(proponeFocoEnComida(dias)).toBe(false)
  })
  it('solo mira los 7 días más recientes', () => {
    const viejos: DiaDeComida[] = [1, 2, 3].map((d) => ({ fecha: `2026-10-0${d}`, cumplio: false }))
    expect(proponeFocoEnComida([...viejos, ...semana(2)])).toBe(false)
  })
})

describe('bandera', () => {
  it('viene apagada', () => expect(BARRA_POR_ETAPA_ACTIVA).toBe(false))
  it('apagada no devuelve lista (la barra de siempre)', () => {
    expect(pestanasDeLaBarra(base)).toBeNull()
  })
  it('encendida devuelve la lista de la etapa', () => {
    expect(pestanasDeLaBarra(base, true)).toEqual(PESTANAS_POR_ETAPA.entrenando)
  })
})
