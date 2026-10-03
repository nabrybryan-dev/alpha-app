import { describe, expect, it } from 'vitest'
import { calcularPalancas } from './palancas'
import type { PerfilAntropometrico } from './personalizacion'

const corto: PerfilAntropometrico = {
  estaturaCm: 158, masaKg: 55, torsoCm: 48, brazoCm: 27,
  antebrazoCm: 23, femurCm: 38, tibiaCm: 35, pieCm: 22,
}
const largo: PerfilAntropometrico = {
  estaturaCm: 194, masaKg: 96, torsoCm: 62, brazoCm: 37,
  antebrazoCm: 31, femurCm: 52, tibiaCm: 47, pieCm: 30,
}

describe('cálculo de palancas', () => {
  it('conserva el patrón y diferencia dos antropometrías sin valores no finitos', () => {
    const a = calcularPalancas(corto, 'peso_muerto_convencional')
    const b = calcularPalancas(largo, 'peso_muerto_convencional')

    expect(a.patronId).toBe(b.patronId)
    expect(a.segmentos).not.toEqual(b.segmentos)
    expect(a.brazoMomentoExternoCm).not.toBe(b.brazoMomentoExternoCm)
    expect(a.vectorCarga).not.toEqual(b.vectorCarga)
    expect(a.distribucionCarga).not.toEqual(b.distribucionCarga)
    expect(a.centroDeMasas).not.toEqual(b.centroDeMasas)

    const numeros = JSON.stringify([a, b]).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
    expect(numeros.length).toBeGreaterThan(0)
    expect(numeros.every(Number.isFinite)).toBe(true)
  })
})
