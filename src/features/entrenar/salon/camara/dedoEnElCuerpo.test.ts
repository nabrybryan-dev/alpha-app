import { describe, expect, it } from 'vitest'
import { dedoEnElCuerpo, HOLGURA_DEL_DEDO } from './dedoEnElCuerpo'

const cuerpo = { x0: 150, y0: 300, x1: 240, y1: 620 }

describe('de quién es el dedo', () => {
  it('sobre el cuerpo es del cuerpo; fuera, de la cámara', () => {
    expect(dedoEnElCuerpo(cuerpo, 195, 460)).toBe(true)
    expect(dedoEnElCuerpo(cuerpo, 40, 460)).toBe(false)
    expect(dedoEnElCuerpo(cuerpo, 195, 120)).toBe(false)
  })

  it('un pulgar no acierta al milímetro: hay holgura alrededor del cuerpo', () => {
    expect(dedoEnElCuerpo(cuerpo, cuerpo.x0 - HOLGURA_DEL_DEDO + 1, 460)).toBe(true)
    expect(dedoEnElCuerpo(cuerpo, cuerpo.x0 - HOLGURA_DEL_DEDO - 1, 460)).toBe(false)
    expect(dedoEnElCuerpo(cuerpo, 195, cuerpo.y1 + HOLGURA_DEL_DEDO - 1)).toBe(true)
    expect(dedoEnElCuerpo(cuerpo, 195, cuerpo.y1 + HOLGURA_DEL_DEDO + 1)).toBe(false)
  })

  it('sin cuadro todavía, el dedo es del cuerpo: lo que era hasta hoy, y no un giro que no arranca', () => {
    expect(dedoEnElCuerpo(undefined, 5, 5)).toBe(true)
  })
})
