import { describe, expect, it } from 'vitest'
import { esCrisis, normalizar } from '../../supabase/functions/responder-chat/index.ts'

describe('normalizar', () => {
  it('quita tildes y baja a minusculas', () => {
    expect(normalizar('QUIERO MORIRME')).toBe('quiero morirme')
    expect(normalizar('Me duele la rodilla')).toBe('me duele la rodilla')
    expect(normalizar('  hola   mundo  ')).toBe('hola mundo')
  })
})

describe('esCrisis', () => {
  it('detecta frases inequivocas', () => {
    expect(esCrisis('ya no quiero vivir')).toBe(true)
    expect(esCrisis('estoy pensando en hacerme dano')).toBe(true)
    expect(esCrisis('quiero quitarme la vida')).toBe(true)
    expect(esCrisis('a veces pienso en matarme')).toBe(true)
  })

  it('funciona con tildes y mayusculas', () => {
    expect(esCrisis('quiero hacerme DAÑO')).toBe(true)
  })

  it('NO dispara con cansancio o frustracion', () => {
    expect(esCrisis('ya no puedo mas con estas series')).toBe(false)
    expect(esCrisis('no aguanto el dolor de piernas')).toBe(false)
    expect(esCrisis('estoy muerto despues de esa sesion')).toBe(false)
    expect(esCrisis('me quiero morir de agujetas')).toBe(false)
    expect(esCrisis('no tengo ganas de nada')).toBe(false)
  })
})
