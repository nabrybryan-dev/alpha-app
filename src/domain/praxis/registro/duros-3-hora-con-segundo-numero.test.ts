/** Grupo 3 de «duros» (8-nov-2026): una hora con un segundo número no se mezcla (05:06); «12 y pico» es vago. */
import { describe, expect, it } from 'vitest'
import { correr, opciones, parche, visible } from './duros-ayuda.ts'

describe('hora con segundo número', () => {
  it('«a las 5 pero me levanté a las 6» pregunta', () => {
    const r = correr({ hora_levantarse: 'sonó la alarma a las 5 pero me levanté a las 6' })
    expect(parche(r).horaLevantarse).toBeUndefined()
    expect(opciones(r)).toEqual(['05:00', '06:00'])
  })
  it('«a las 5 y me levanté a las 6» pregunta', () => {
    const r = correr({ hora_levantarse: 'a las 5 y me levanté a las 6' })
    expect(parche(r).horaLevantarse).toBeUndefined()
    expect(visible(r)).toBe(true)
  })
  it('«a las 11 me metí a la cama pero me dormí como a las 12» pregunta', () => {
    const r = correr({ hora_acostarse: 'a las 11 me metí a la cama pero me dormí como a las 12' })
    expect(parche(r).horaAcostarse).toBeUndefined()
    expect(opciones(r)).toEqual(['23:00', '00:00'])
  })
  it.each(['como a las 12 y pico de la noche', 'como a las 11 y pico'])('«%s» es vago', (cita) => {
    const r = correr({ hora_acostarse: cita })
    expect(parche(r).horaAcostarse).toBeUndefined()
    expect(r.descartado.length).toBe(1)
    expect(r.seguimiento?.campo_bloqueante).toBe('horaAcostarse')
  })
  it('lo que ya valía', () => {
    expect(parche(correr({ hora_acostarse: 'a las 10 y media' })).horaAcostarse).toBe('22:30')
    expect(parche(correr({ hora_acostarse: 'a las 12 y media' })).horaAcostarse).toBe('00:30')
    expect(parche(correr({ hora_acostarse: 'a las 11 de la noche' })).horaAcostarse).toBe('23:00')
    expect(parche(correr({ hora_acostarse: 'entre las 11 y las 12' })).horaAcostarse).toBeUndefined()
  })
})
