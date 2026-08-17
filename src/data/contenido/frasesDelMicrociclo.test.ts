import { describe, expect, it } from 'vitest'
import { FRASES_MICROCICLO, fraseDelMicrociclo } from './frasesDelMicrociclo'

describe('FRASES_MICROCICLO', () => {
  it('el banco tiene entre 20 y 30 frases', () => {
    expect(FRASES_MICROCICLO.length).toBeGreaterThanOrEqual(20)
    expect(FRASES_MICROCICLO.length).toBeLessThanOrEqual(30)
  })

  it('no hay repetidas', () => {
    expect(new Set(FRASES_MICROCICLO).size).toBe(FRASES_MICROCICLO.length)
  })

  it('respeta el tono del design system: sin emoji y sin gritar', () => {
    for (const f of FRASES_MICROCICLO) {
      expect(f, f).not.toMatch(/\p{Extended_Pictographic}/u)
      expect(f, f).not.toMatch(/[!¡]/)
      expect(f.length, f).toBeLessThanOrEqual(90)
      expect(f.trim(), f).toBe(f)
    }
  })
})

describe('fraseDelMicrociclo', () => {
  it('la misma persona ve la misma frase toda la semana', () => {
    const a = fraseDelMicrociclo('m-camilo-20')
    expect(fraseDelMicrociclo('m-camilo-20')).toBe(a)
    expect(fraseDelMicrociclo('m-camilo-20')).toBe(a)
  })

  it('cambia al cambiar de microciclo', () => {
    const vistas = new Set(
      ['m-camilo-19', 'm-camilo-20', 'm-camilo-21', 'm-camilo-22'].map((id) =>
        fraseDelMicrociclo(id),
      ),
    )
    expect(vistas.size).toBeGreaterThan(1)
  })

  it('reparte por todo el banco y no se queda en las primeras', () => {
    const ids = Array.from({ length: 400 }, (_, i) => `m-prueba-${i}`)
    const usadas = new Set(ids.map((id) => fraseDelMicrociclo(id)))
    expect(usadas.size).toBeGreaterThanOrEqual(FRASES_MICROCICLO.length - 2)
  })

  it('con el banco vacío no inventa nada', () => {
    expect(fraseDelMicrociclo('m-1', [])).toBeUndefined()
  })
})
