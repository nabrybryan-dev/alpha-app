import { describe, expect, it } from 'vitest'
import { saludEnFrase, saludAntesDeDeepseek } from './saludEnFrase.ts'

describe('saludEnFrase: léxico propio de la charla (positivos sembrados, uno por término)', () => {
  const positivas: [string, string][] = [
    ['tengo un pinchazo en el codo cuando hago dominadas', 'pinchazo'],
    ['siento una punzada en la rodilla al bajar', 'punzada'],
    ['tengo una molestia en el hombro', 'molestia'],
    ['me molesta la espalda al remar', 'molesta'],
    ['tengo dolor de espalda baja', 'dolor'],
    ['me duele el codo al empujar', 'duele'],
    ['senti un tiron en el isquio', 'tiron'],
    ['creo que tengo una lesion vieja', 'lesion'],
    ['tengo inflamacion en el tendon', 'inflamacion'],
    ['me sale hinchazon en la muñeca', 'hinchazon'],
    ['siento hormigueo en la mano', 'hormigueo'],
    ['tengo adormecimiento en el brazo', 'adormecimiento'],
    ['me da mareo despues de entrenar', 'mareo'],
    ['casi me da un desmayo en la ultima serie', 'desmayo'],
    ['agujetas fuertes en el cuello y hombro, es grave?', 'agujetas fuertes'],
    ['si esto es grave o no', 'es grave'],
    ['estoy en embarazo con complicaciones, puedo entrenar piernas?', 'embarazo con complicacion'],
    ['tomo medicacion para la tension y entreno', 'medicacion'],
    ['con las pastillas que tomo puedo entrenar en ayunas', 'pastillas'],
    ['mi medico me dio una receta y quiero saber si puedo entrenar', 'receta'],
    ['me dieron un diagnostico en la clinica', 'diagnostico'],
  ]
  for (const [frase, termino] of positivas) {
    it(`${termino}: «${frase}»`, () => {
      expect(saludEnFrase(frase), frase).not.toBeNull()
    })
  }
  it('mayúsculas y tildes no la esquivan', () => {
    expect(saludEnFrase('Tengo un PINCHAZO en el CODO')).not.toBeNull()
    expect(saludEnFrase('me duele la rodilla, ¿es grave?')).not.toBeNull()
    expect(saludEnFrase('tengo una lesión')).not.toBeNull()
  })
})

describe('saludEnFrase: negativos (la pregunta de entrenamiento sin síntoma sigue)', () => {
  const negativas = [
    '¿cuántas series por músculo a la semana?',
    '¿la creatina hay que tomarla todos los días?',
    '¿hace falta calentar antes de levantar pesado?',
    '¿qué es el tempo de una repetición?',
    '¿cuánto descanso entre series?',
    'las agujetas sirven como señal de progreso?',
    'me gusta entrenar con ritmo',
  ]
  for (const f of negativas) it(f, () => expect(saludEnFrase(f), f).toBeNull())
})

describe('saludAntesDeDeepseek: filtro local de la app + léxico propio', () => {
  it('el filtro local de la app (clínico/riesgo) también corta', () => {
    expect(saludAntesDeDeepseek('no quiero vivir mas')).toBe('filtro_local')
  })
  it('el léxico propio corta lo que el filtro local no ve', () => {
    expect(saludAntesDeDeepseek('agujetas fuertes en el cuello y hombro, es grave?')).toBe('salud_en_frase')
    expect(saludAntesDeDeepseek('tomo medicacion para la tension y entreno')).toBe('salud_en_frase')
  })
  it('el pinchazo en el codo lo corta algún filtro de los dos (en producción el local lo ve primero)', () => {
    expect(saludAntesDeDeepseek('tengo un pinchazo en el codo cuando hago dominadas')).not.toBeNull()
  })
  it('una pregunta de entrenamiento pasa', () => {
    expect(saludAntesDeDeepseek('¿cuántas series por semana para el pecho?')).toBeNull()
  })
})
