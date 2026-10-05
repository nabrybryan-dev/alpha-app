import { describe, expect, it } from 'vitest'
import { CASOS_DEL_CERO, casoDelCero, esRirCero, variantesParaElTurno } from './frasesDelCero.ts'

const NORMAL = [
  { tu: 'Te quedaban {rir} más, ya lo anoté.', usted: 'Le quedaban {rir} más, ya lo anoté.' },
  { tu: 'Al final de la serie te quedaban {rir} más.', usted: 'Al final de la serie le quedaban {rir} más.' },
]
const PLT = { id: 'PLT-AMPB_REPORTAR-0076', registro: '*', variantes: NORMAL }

describe('esRirCero', () => {
  it('solo el número 0 (o su texto) es el cero', () => {
    expect(esRirCero(0)).toBe(true)
    expect(esRirCero('0')).toBe(true)
    expect(esRirCero(' 0 ')).toBe(true)
  })
  it('1 o más, ausente y basura no son el cero', () => {
    for (const v of [1, 2, 5, -1, NaN, undefined, null, '', '1', '10', 'cero', {}, [0]]) expect(esRirCero(v)).toBe(false)
  })
  it('FALLO no es RIR 0 (objetivoDeIntensidad.ts, registro/rir.ts)', () => {
    expect(esRirCero('FALLO')).toBe(false)
    expect(esRirCero('fallo')).toBe(false)
  })
})

describe('variantesParaElTurno', () => {
  it('rir 0 → las frases del cero, no las de la plantilla', () => {
    const r = variantesParaElTurno(PLT, { rir: 0 })
    expect(r.origen).toBe('cero')
    expect(r.variantes).toEqual(casoDelCero('PLT-AMPB_REPORTAR-0076')!.variantes)
    for (const v of r.variantes) {
      expect(v.tu).not.toContain('{rir}')
      expect(v.usted).not.toContain('{rir}')
    }
  })
  it('ninguna frase del cero dice «0», «cero» ni «{rir}» (la frase que se quiso evitar)', () => {
    for (const c of CASOS_DEL_CERO)
      for (const v of c.variantes)
        for (const t of [v.tu, v.usted]) expect(t).not.toMatch(/\b0\b|\bcero\b|\{rir\}/i)
  })
  it('rir 1 o más → la de siempre', () => {
    for (const rir of [1, 2, 3, 5]) {
      const r = variantesParaElTurno(PLT, { rir })
      expect(r.origen).toBe('plantilla')
      expect(r.variantes).toBe(NORMAL)
    }
  })
  it('sin RIR, o con FALLO → la de siempre; el enrutador no convierte FALLO en 0', () => {
    expect(variantesParaElTurno(PLT, {}).origen).toBe('plantilla')
    expect(variantesParaElTurno(PLT, { rir: undefined }).origen).toBe('plantilla')
    expect(variantesParaElTurno(PLT, { rir: 'FALLO' }).origen).toBe('plantilla')
  })
  it('rir 0 en una plantilla sin caso del cero → la de siempre (no inventa frases)', () => {
    const otra = { id: 'PLT-OTRA-0001', registro: '*', variantes: NORMAL }
    expect(variantesParaElTurno(otra, { rir: 0 })).toEqual({ origen: 'plantilla', variantes: NORMAL })
  })
  it('respeta el registro: el caso R0 no sirve a una plantilla con otro registro', () => {
    const r1 = { id: 'PLT-AMPI_REPORTAR-0003', registro: 'R1', variantes: NORMAL }
    expect(variantesParaElTurno(r1, { rir: 0 }).origen).toBe('plantilla')
    const r0 = { id: 'PLT-AMPI_REPORTAR-0003', registro: 'R0', variantes: NORMAL }
    expect(variantesParaElTurno(r0, { rir: 0 }).origen).toBe('cero')
  })
  it('cada caso trae tú y usted distintos y sin mezclar el trato', () => {
    for (const c of CASOS_DEL_CERO)
      for (const v of c.variantes) {
        expect(v.tu).not.toBe(v.usted)
        expect(v.usted).not.toMatch(/\b(te|tu|tus)\b/i)
      }
  })
})
