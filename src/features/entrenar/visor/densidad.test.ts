import { describe, expect, it } from 'vitest'
import { AjusteDeDensidad, TOPE_DE_PIXELES, esCelular } from './densidad'

/** Alimenta `n` cuadros a `fps` desde `t0` y devuelve el ultimo cambio que se pidio. */
function correr(a: AjusteDeDensidad, t0: number, segundos: number, fps: number): { t: number; cambio?: number } {
  let t = t0
  let cambio: number | undefined
  const paso = 1000 / fps
  for (let i = 0; i < Math.round(segundos * fps); i++) {
    t += paso
    const r = a.alPintar(t)
    if (r !== undefined) cambio = r
  }
  return { t, cambio }
}

describe('la densidad adaptativa de pixeles (frenan los pixeles, no los triangulos)', () => {
  it('nunca pasa de 2, aunque la pantalla diga 3', () => {
    expect(TOPE_DE_PIXELES).toBe(2)
    expect(new AjusteDeDensidad(3).densidad).toBe(2)
    expect(new AjusteDeDensidad(1.5).densidad).toBe(1.5)
  })

  it('si va por debajo de 50 fps baja un 15 % por segundo medido, sin pasar de 0,6', () => {
    const a = new AjusteDeDensidad(2)
    const { cambio } = correr(a, 0, 1.2, 30)
    expect(cambio).toBeCloseTo(1.7)
    correr(a, 2000, 60, 30)
    expect(a.densidad).toBeCloseTo(0.6)
  })

  it('si va sobrado recupera, pero solo tras tres medidas buenas seguidas y sin pasar del maximo', () => {
    const a = new AjusteDeDensidad(2)
    correr(a, 0, 3, 30)
    const bajada = a.densidad
    expect(bajada).toBeLessThan(2)
    let t = 10_000
    for (let i = 0; i < 2; i++) t = correr(a, t, 1.1, 60).t
    expect(a.densidad).toBe(bajada)
    for (let i = 0; i < 40; i++) t = correr(a, t, 1.1, 60).t
    expect(a.densidad).toBeLessThanOrEqual(2)
    expect(a.densidad).toBeGreaterThan(bajada)
  })

  it('un cuadro suelto tras un rato quieto no cuenta como lentitud', () => {
    const a = new AjusteDeDensidad(2)
    a.alPintar(0)
    a.alPintar(5000)
    expect(a.alPintar(5016)).toBeUndefined()
    expect(a.densidad).toBe(2)
  })
})

describe('celular o escritorio', () => {
  it('menos de 760 px de ancho es celular (el mismo corte de la landing)', () => {
    const f = (ancho: number) => (q: string) => ({ matches: q.includes('759') && ancho < 760 }) as MediaQueryList
    expect(esCelular(f(430))).toBe(true)
    expect(esCelular(f(1280))).toBe(false)
  })
  it('sin matchMedia es escritorio', () => expect(esCelular(undefined)).toBe(false))
})
