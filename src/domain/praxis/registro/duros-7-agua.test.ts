/** Grupo 7 de «duros» (8-nov-2026): «ni un vaso» es cero; la hora no se cuela como cantidad de agua. */
import { describe, expect, it } from 'vitest'
import { aguaMl, correr } from './duros-ayuda.ts'

const agua = (cantidad: string) => correr({ agua: { cantidad, medida: null } })

describe('agua', () => {
  it.each(['ni un vaso', 'ningún vaso'])('«%s» no anota nada ni pregunta', (cita) => {
    const r = agua(cita)
    expect(aguaMl(r)).toBe(0)
    expect(r.seguimiento).toBeUndefined()
  })
  it('«a las 8 me tomé 2 vasos» son 400 mL, no 1.600', () => {
    expect(aguaMl(agua('a las 8 tomé 2 vasos'))).toBe(400)
  })
  it('lo que ya valía', () => {
    expect(aguaMl(agua('3 vasos desde las 8 hasta el mediodía'))).toBe(600)
    expect(aguaMl(agua('tres vasos'))).toBe(600)
    expect(aguaMl(agua('1,5 litros'))).toBe(1500)
  })
})
