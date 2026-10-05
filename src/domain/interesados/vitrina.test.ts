/**
 * La vitrina de `/interesados` es lo primero que lee alguien que llega por un creador.
 * Estas pruebas cuidan las dos reglas de su diseño
 * (`docs/specs/2026-10-05-vitrina-interesados-diseno.md`): cada frase de respaldo trae su
 * fuente, y nada promete un resultado.
 */
import { describe, expect, it } from 'vitest'
import { BAJADA, formatearPrecio, PRECIO_MENSUAL_COP, QUE_RECIBES, RESPALDO, TITULAR } from './vitrina'

const todoElTexto = [TITULAR, BAJADA, ...QUE_RECIBES, ...RESPALDO.flatMap((r) => [r.frase, r.detalle])]

describe('el respaldo', () => {
  it('trae al menos una frase, y cada una con su fuente', () => {
    expect(RESPALDO.length).toBeGreaterThan(0)
    for (const r of RESPALDO) {
      expect(r.frase.trim()).not.toBe('')
      expect(r.detalle.trim()).not.toBe('')
      expect(r.fuente.trim()).not.toBe('')
    }
  })

  it('la fuente nombra la revista o la institución, no solo un apellido', () => {
    for (const r of RESPALDO) expect(r.fuente).toMatch(/\(.+\)/)
  })
})

describe('sin promesas de resultado', () => {
  it.each([
    /garantiz/i,
    /\d+\s*(kg|kilos|libras)\s+en\s+\d+/i,
    /seguro\s+que\s+(bajas|subes|pierdes|ganas)/i,
    /resultados?\s+(asegurados?|garantizados?)/i,
  ])('ninguna frase dice %s', (patron) => {
    for (const t of todoElTexto) expect(t).not.toMatch(patron)
  })

  it('no nombra la nutrición como parte del servicio mientras Bryan no lo decida', () => {
    for (const t of [TITULAR, BAJADA, ...QUE_RECIBES]) expect(t).not.toMatch(/nutrici|dieta|alimentaci/i)
  })
})

describe('el precio', () => {
  it('se escribe en pesos colombianos, con punto de miles', () => {
    expect(formatearPrecio(225_000)).toBe('$225.000')
    expect(formatearPrecio(1_250_000)).toBe('$1.250.000')
  })

  it('es un número positivo y redondo', () => {
    expect(PRECIO_MENSUAL_COP).toBeGreaterThan(0)
    expect(Number.isInteger(PRECIO_MENSUAL_COP)).toBe(true)
  })
})
