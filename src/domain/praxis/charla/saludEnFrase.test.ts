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

describe('saludEnFrase: población sensible, condiciones, fármacos, TCA, edad (12-nov; hallazgo C17 posparto)', () => {
  const positivas: [string, string][] = [
    ['¿puedo entrenar piernas estando en embarazo?', 'embarazo'],
    ['estoy embarazada y quiero seguir con pesas', 'embarazo'],
    ['soy gestante de 20 semanas, que hago con las sentadillas?', 'embarazo'],
    ['estoy en el posparto, cuando vuelvo a saltar?', 'posparto'],
    ['en el postparto puedo hacer abdominales?', 'posparto'],
    ['estoy en el puerperio y quiero entrenar', 'puerperio'],
    ['tuve un parto hace 3 meses, puedo entrenar fuerte?', 'parto'],
    ['despues del parto cuando vuelvo al gym', 'parto'],
    ['me hicieron cesarea hace un mes', 'cesarea'],
    ['me hicieron una cesárea, cuando cargo peso?', 'cesarea'],
    ['tuve una cirugia de hombro', 'cirugia'],
    ['me operaron de la rodilla, que ejercicios hago?', 'operaron'],
    ['soy operada de la espalda, puedo hacer peso muerto?', 'operada'],
    ['estoy operado hace dos semanas, puedo entrenar?', 'operado'],
    ['en el postoperatorio puedo hacer pesas?', 'postoperatorio'],
    ['durante la lactancia cuanta proteina necesito?', 'lactancia'],
    ['estoy amamantando y quiero ganar musculo', 'amamantando'],
    ['estoy dando pecho, entreno igual?', 'dando pecho'],
    ['con la menopausia cambia mi rutina?', 'menopausia'],
    ['tengo problemas de tiroides, como entreno?', 'tiroides'],
    ['tengo hipotiroidismo y me cuesta bajar grasa', 'hipotiroidismo'],
    ['soy diabetico, entreno en ayunas?', 'diabetes'],
    ['tengo diabetes tipo 2', 'diabetes'],
    ['me inyecto insulina, puedo hacer pesas?', 'insulina'],
    ['tengo hipertension, puedo hacer series al fallo?', 'hipertension'],
    ['tengo la presión alta, levanto pesado?', 'presion alta'],
    ['me dijeron que tengo la tension alta', 'presion alta'],
    ['me salió anemia en el examen', 'anemia'],
    ['tengo asma y quiero hacer cardio', 'asma'],
    ['tomo anticonceptivos, afecta mi progreso?', 'anticonceptivo'],
    ['un amigo me paso ozempic para bajar rapido', 'ozempic'],
    ['quiero probar semaglutida mientras entreno', 'semaglutida'],
    ['quiero tomar clembuterol para definir', 'clembuterol'],
    ['las pastillas quemagrasas sirven?', 'quemagrasas'],
    ['un quemagrasa de internet funciona?', 'quemagrasas'],
    ['que tal los esteroides para ganar masa', 'esteroides'],
    ['los anabolicos funcionan mas rapido?', 'anabolicos'],
    ['tuve anorexia hace años y quiero un deficit fuerte', 'anorexia'],
    ['creo que tengo bulimia', 'bulimia'],
    ['a veces me doy atracones y luego entreno doble', 'atracon'],
    ['hago purgas despues de comer', 'purga'],
    ['soy menor de edad, puedo entrenar con pesas?', 'menor de edad'],
    ['tengo 14 años y quiero empezar con pesas', 'edad de menor'],
    ['tengo 17 años, cuanto peso cargo?', 'edad de menor'],
    ['soy mayor de 65, que rutina me sirve?', 'mayor de 65'],
    ['tengo 70 años y quiero empezar a entrenar', 'mayor de 65'],
    ['mi abuelo quiere empezar a entrenar, que le pongo?', 'abuelo'],
    ['mi abuela tiene 80 y quiere hacer pesas', 'abuela'],
  ]
  for (const [frase, termino] of positivas) {
    it(`${termino}: «${frase}»`, () => {
      expect(saludEnFrase(frase), frase).not.toBeNull()
      // y por la ruta completa: va al coach sin llamar a DeepSeek
      expect(saludAntesDeDeepseek(frase), frase).not.toBeNull()
    })
  }
  it('el caso C17 medido: posparto a los 3 meses', () => {
    expect(saludAntesDeDeepseek('tuve a mi hijo hace 3 meses, en el posparto puedo volver a entrenar duro?')).not.toBeNull()
  })
})

describe('saludEnFrase: controles negativos del léxico nuevo (preguntas de entrenamiento sin tema de salud)', () => {
  const negativas = [
    '¿cuántas series por semana para el pecho?',
    '¿cuántas series por grupo muscular a la semana si entreno 4 días?',
    '¿cuántos gramos de creatina al día y antes o después del entreno?',
    '¿es mejor press inclinado con mancuernas o con barra?',
    'llevo 4 años entrenando y quiero subir el press',
    'tengo 28 años y entreno 4 días, que split me sirve?',
    'tengo 2 años de experiencia en el gym',
    'la parte superior del pecho se trabaja con press inclinado?',
    'mayor volumen o mayor intensidad para la fuerza?',
    'cuanta tension mecanica hace falta para crecer?',
    'quiero hacer series largas con poca presion en el tiempo de descanso',
    'mi amigo me recomendo un split de 5 dias',
    'cuanto descanso entre series de sentadilla?',
  ]
  for (const f of negativas) it(f, () => expect(saludAntesDeDeepseek(f), f).toBeNull())
})
