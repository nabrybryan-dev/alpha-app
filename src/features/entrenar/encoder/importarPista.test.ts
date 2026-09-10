import { describe, expect, it } from 'vitest'
import { pistaSintetica } from '../../../domain/patrones/pistaSintetica'
import { importarPista } from './importarPista'

describe('importarPista', () => {
  it('lo que no es JSON ni pista lo dice, y dice que NO es pista', () => {
    expect(importarPista('{')).toEqual({ ok: false, esPista: false, problema: 'Eso no es un archivo JSON.' })
    const r = importarPista(JSON.stringify({ ejeObjetivo: 'rodilla' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.esPista).toBe(false)
  })

  it('una pista sin nadie es pista, pero no da para repetición: se lo dice a la persona', () => {
    const p = pistaSintetica({ repeticiones: 1 })
    p.fotogramas = p.fotogramas.map((f) => ({ ...f, puntos: null }))
    const r = importarPista(JSON.stringify(p))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.esPista).toBe(true)
      expect(r.problema).toMatch(/repetir la toma/i)
    }
  })

  it('una pista buena sale con su huella articular y de dónde viene', () => {
    const r = importarPista(JSON.stringify(pistaSintetica({ repeticiones: 2 })))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.video).toBe('sintetico.mp4')
      expect(r.fotogramas).toBe(121)
      expect(r.huella.articular?.rodillaFlex).toHaveLength(24)
    }
  })
})
