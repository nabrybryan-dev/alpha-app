import { describe, expect, it } from 'vitest'
import { verificarCifras } from './contrato'
import type { EntradaDeSentadilla } from './dinamica'
import { MUSCULOS_DE_LA_SENTADILLA, repartoDeSentadilla, type TablaMuscular } from './repartoDeSentadilla'

const e: EntradaDeSentadilla = {
  sexo: 'h',
  talla: 1.78,
  masa: 82,
  cargaKg: 100,
  pose: { tibia: 0.45, muslo: -1.45, tronco: 0.75, cabeza: 0.2, barraT: 0.1, pieZ: 0.05 },
}
// Parámetros de JUEGO: no son anatomía de nadie.
const juego: TablaMuscular = {
  r: 2,
  rodilla: [{ nombre: 'cuadriceps', area: 5, brazo: 0.04 }],
  cadera: [
    { nombre: 'gluteoMayor', area: 3, brazo: 0.06 },
    { nombre: 'isquios', area: 2, brazo: 0.05 },
    { nombre: 'aductorMayor', area: 2, brazo: 0.03 },
  ],
}

describe('sin tabla muscular: nada que afirmar', () => {
  it('seis cifras no_afirmable, ninguna con valor, válidas para el contrato', () => {
    const r = repartoDeSentadilla(e)
    expect(r.musculos.map((c) => c.id)).toEqual(MUSCULOS_DE_LA_SENTADILLA.map((m) => `sentadilla.reparto.${m}`))
    const todas = [...r.musculos, ...r.pasivo]
    expect(todas).toHaveLength(6)
    for (const c of todas) {
      expect(c.valor).toBeNull()
      expect(c.estado).toBe('no_afirmable')
    }
    expect(verificarCifras(todas)).toEqual([])
  })
  it('tabla null: lo mismo', () => {
    expect(repartoDeSentadilla(e, null).musculos.every((c) => c.valor === null)).toBe(true)
  })
})

describe('con una tabla de juego: simulado, nunca estimado', () => {
  it('cuatro fracciones simuladas; cada articulación suma 1; el pasivo sigue sin afirmar', () => {
    const r = repartoDeSentadilla(e, juego)
    expect(r.musculos).toHaveLength(4)
    for (const c of r.musculos) {
      expect(c.estado).toBe('simulado')
      expect(c.supuestos.join(' ')).toContain('hipotéticos')
    }
    const f = (n: string) => r.musculos.find((c) => c.id.endsWith(n))!.valor as number
    expect(f('cuadriceps')).toBeCloseTo(1, 12)
    expect(f('gluteoMayor') + f('isquios') + f('aductorMayor')).toBeCloseTo(1, 12)
    expect(r.pasivo.every((c) => c.valor === null)).toBe(true)
    expect(verificarCifras([...r.musculos, ...r.pasivo])).toEqual([])
  })
  it('sin dato del sujeto, vuelve a no_afirmable aunque haya tabla', () => {
    const r = repartoDeSentadilla({ ...e, cargaKg: undefined }, juego)
    expect(r.musculos.every((c) => c.valor === null)).toBe(true)
  })
  it('una tabla que no admite el reparto (nadie con brazo positivo en la rodilla) se abstiene', () => {
    const mala = { ...juego, rodilla: [{ nombre: 'cuadriceps', area: 5, brazo: -0.04 }] }
    expect(repartoDeSentadilla(e, mala).musculos.every((c) => c.valor === null)).toBe(true)
  })
})
