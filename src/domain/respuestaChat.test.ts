import { describe, expect, it } from 'vitest'
import {
  decidirVia,
  esCrisis,
  esTemaDeSalud,
  normalizar,
} from '../../supabase/functions/responder-chat/index.ts'

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

describe('esTemaDeSalud', () => {
  it('detecta dolor y lesion', () => {
    expect(esTemaDeSalud('me duele la rodilla al bajar')).toBe(true)
    expect(esTemaDeSalud('vengo de una lesion de hombro')).toBe(true)
    expect(esTemaDeSalud('me punza el tendon')).toBe(true)
  })

  it('detecta urgencias', () => {
    expect(esTemaDeSalud('me maree en la serie')).toBe(true)
    expect(esTemaDeSalud('senti opresion en el pecho')).toBe(true)
    expect(esTemaDeSalud('casi me desmayo')).toBe(true)
  })

  it('detecta salud femenina', () => {
    expect(esTemaDeSalud('se me retraso la regla')).toBe(true)
    expect(esTemaDeSalud('estoy embarazada')).toBe(true)
    expect(esTemaDeSalud('se me escapa la orina al saltar')).toBe(true)
  })

  it('detecta angustia ambigua sin ser crisis', () => {
    expect(esTemaDeSalud('ya no puedo mas')).toBe(true)
    expect(esCrisis('ya no puedo mas')).toBe(false)
  })

  it('NO marca preguntas normales de entrenamiento', () => {
    expect(esTemaDeSalud('hasta donde bajo en la sentadilla')).toBe(false)
    expect(esTemaDeSalud('cuanta proteina necesito')).toBe(false)
    expect(esTemaDeSalud('puedo cambiar el orden de los ejercicios')).toBe(false)
    expect(esTemaDeSalud('que es un rest pause')).toBe(false)
  })
})

describe('decidirVia', () => {
  it('ficha directa por encima de 0,50', () => {
    expect(decidirVia(0.78)).toBe('ficha')
    expect(decidirVia(0.50)).toBe('ficha')
  })

  it('tentativa en la banda intermedia', () => {
    expect(decidirVia(0.49)).toBe('ficha_tentativa')
    expect(decidirVia(0.42)).toBe('ficha_tentativa')
  })

  it('escala al coach por debajo de 0,42', () => {
    expect(decidirVia(0.41)).toBe('escalado')
    expect(decidirVia(0.26)).toBe('escalado')
    expect(decidirVia(null)).toBe('escalado')
  })
})
