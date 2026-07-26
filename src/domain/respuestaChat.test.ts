import { describe, expect, it } from 'vitest'
import {
  armarRespuesta,
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

const CUERPO = {
  respuesta_directa: 'Baja hasta pasar la paralela.',
  por_que: 'El estimulo esta donde el musculo se estira bajo carga.',
  tu_caso_hoy: 'Hoy tienes {{ejercicio_hoy}} a RIR {{rir_pautado}}.',
  que_hago_ahora: 'Graba una serie de lado.',
  senal_alarma: 'Si duele dentro de la rodilla, para.',
}

describe('armarRespuesta', () => {
  it('rellena las ranuras con los datos reales', () => {
    const r = armarRespuesta(CUERPO, { ejercicio_hoy: 'SENTADILLA HACK', rir_pautado: '2' })
    expect(r).toContain('Hoy tienes SENTADILLA HACK a RIR 2.')
    expect(r).not.toContain('{{')
  })

  it('omite tu_caso_hoy entero si falta un dato', () => {
    const r = armarRespuesta(CUERPO, { ejercicio_hoy: 'SENTADILLA HACK' })
    expect(r).not.toContain('SENTADILLA HACK')
    expect(r).not.toContain('{{')
    expect(r).toContain('Baja hasta pasar la paralela.')
    expect(r).toContain('Si duele dentro de la rodilla, para.')
  })

  it('omite tu_caso_hoy si no hay ningun dato', () => {
    const r = armarRespuesta(CUERPO, {})
    expect(r).not.toContain('{{')
    expect(r).toContain('El estimulo esta donde')
  })

  it('mantiene el orden de las cinco partes', () => {
    const r = armarRespuesta(CUERPO, { ejercicio_hoy: 'X', rir_pautado: '2' })
    expect(r.indexOf('Baja hasta')).toBeLessThan(r.indexOf('El estimulo'))
    expect(r.indexOf('El estimulo')).toBeLessThan(r.indexOf('Hoy tienes'))
    expect(r.indexOf('Hoy tienes')).toBeLessThan(r.indexOf('Graba una serie'))
    expect(r.indexOf('Graba una serie')).toBeLessThan(r.indexOf('Si duele'))
  })
})
