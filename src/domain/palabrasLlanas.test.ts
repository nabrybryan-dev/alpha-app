import { describe, expect, it } from 'vitest'
import {
  etiquetaRir,
  etiquetaSets,
  fraseRir,
  nombreDelMicrociclo,
  palabraMicrociclo,
  siglaDelMicrociclo,
} from './palabrasLlanas'

describe('palabrasLlanas', () => {
  it('sin vista simple, cada texto es el de siempre', () => {
    expect(nombreDelMicrociclo(11, false)).toBe('Microciclo M11')
    expect(siglaDelMicrociclo(11, false)).toBe('M11')
    expect(palabraMicrociclo(false)).toBe('microciclo')
    expect(etiquetaSets(false)).toBe('Sets')
    expect(etiquetaRir(false)).toBe('RIR')
    expect(fraseRir(2, false)).toBe('RIR 2')
  })

  it('con vista simple, ninguna lleva la palabra técnica', () => {
    const textos = [
      nombreDelMicrociclo(11, true),
      siglaDelMicrociclo(11, true),
      palabraMicrociclo(true),
      etiquetaSets(true),
      etiquetaRir(true),
      fraseRir(2, true),
    ]
    expect(textos).toEqual(['Semana 11', 'semana 11', 'semana', 'Series', 'Te sobran', 'que te sobren 2'])
    for (const t of textos) expect(t).not.toMatch(/microciclo|RIR|sets|M11/i)
  })
})
