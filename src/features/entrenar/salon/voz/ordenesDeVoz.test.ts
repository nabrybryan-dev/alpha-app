import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Sesion } from '../../../../domain/types'
import { interpretarOrden, respuestaDeLaOrden } from './ordenesDeVoz'

const sesion = {
  ejercicios: [{ nombre: 'Sentadilla búlgara' }, { nombre: 'Press de pecho en máquina' }, { nombre: 'Curl femoral' }, { nombre: 'Hip thrust' }],
} as unknown as Pick<Sesion, 'ejercicios'>

describe('las zonas se piden como se dicen', () => {
  it.each([
    ['muéstrame cuádriceps', 'cua'],
    ['abre el pecho', 'pecho'],
    ['quiero ver los hombros', 'delt'],
    ['la cola', 'glu'],
    ['los femorales', 'isq'],
    ['pantorrillas', 'gem'],
    ['enséñame la espalda', 'dors'],
    ['la espalda baja', 'lumb'],
  ])('«%s» abre %s', (dicho, id) => {
    expect(interpretarOrden(dicho)).toEqual({ tipo: 'zona', id })
  })

  it('«pierna» son varias zonas: pregunta cuál en vez de adivinar', () => {
    expect(interpretarOrden('muéstrame la pierna')).toEqual({ tipo: 'cual', opciones: ['Cuádriceps', 'Isquiotibiales', 'Gemelos'] })
  })

  it('dos zonas a la vez: pregunta cuál', () => {
    expect(interpretarOrden('pecho y bíceps')).toEqual({ tipo: 'cual', opciones: ['Pectoral', 'Bíceps'] })
  })
})

describe('los ejercicios de hoy y su movimiento', () => {
  it('por su nombre, y una palabra propia basta', () => {
    expect(interpretarOrden('muéstrame hip thrust', sesion)).toMatchObject({ tipo: 'ejercicio', indice: 3 })
    expect(interpretarOrden('la búlgara', sesion)).toMatchObject({ tipo: 'ejercicio', indice: 0 })
  })

  it('«cómo se hace» con un ejercicio de hoy lleva a ese ejercicio', () => {
    expect(interpretarOrden('cómo se hace la sentadilla', sesion)).toMatchObject({ tipo: 'ejercicio', indice: 0 })
  })

  it('una palabra de zona sola abre la zona, no el ejercicio que la lleva en el nombre', () => {
    expect(interpretarOrden('femoral', sesion)).toEqual({ tipo: 'zona', id: 'isq' })
    expect(interpretarOrden('el pecho', sesion)).toEqual({ tipo: 'zona', id: 'pecho' })
  })

  it('con la palabra propia sí es el ejercicio', () => {
    expect(interpretarOrden('curl femoral', sesion)).toMatchObject({ tipo: 'ejercicio', indice: 2 })
    expect(interpretarOrden('press de pecho', sesion)).toMatchObject({ tipo: 'ejercicio', indice: 1 })
  })

  it('un aparato solo no elige ejercicio', () => {
    expect(interpretarOrden('la máquina', sesion)).toEqual({ tipo: 'no_entendi' })
  })

  it('dos ejercicios empatados: pregunta cuál', () => {
    const dos = { ejercicios: [{ nombre: 'Sentadilla búlgara' }, { nombre: 'Sentadilla hack' }] } as unknown as Pick<Sesion, 'ejercicios'>
    expect(interpretarOrden('sentadilla', dos)).toEqual({ tipo: 'cual', opciones: ['Sentadilla búlgara', 'Sentadilla hack'] })
  })
})

describe('moverse por la guía y por el cuerpo', () => {
  it.each([
    ['ver el movimiento', 'movimiento'],
    ['dame la vuelta', 'vuelta'],
    ['gira', 'vuelta'],
    ['siguiente ejercicio', 'siguiente'],
    ['el anterior', 'anterior'],
    ['qué me toca hoy', 'hoy'],
    ['todas las zonas', 'indice'],
    ['volver al cuerpo', 'cuerpo'],
    ['cierra', 'cerrar'],
  ])('«%s» es %s', (dicho, tipo) => {
    expect(interpretarOrden(dicho, sesion).tipo).toBe(tipo)
  })

  it('de espaldas y de frente, sin confundirse con la zona de la espalda', () => {
    expect(interpretarOrden('ponte de espaldas')).toEqual({ tipo: 'cara', cara: 'espalda' })
    expect(interpretarOrden('de frente')).toEqual({ tipo: 'cara', cara: 'frente' })
  })
})

describe('lo que no es una orden no se adivina', () => {
  it.each(['qué rico el almuerzo', 'no me muestres el pecho', 'la verdad no sé', '...', ''])('«%s» no mueve nada', (dicho) => {
    expect(interpretarOrden(dicho, sesion).tipo).toBe('no_entendi')
  })

  it('siempre contesta con algo, y lo no entendido enseña cómo pedir', () => {
    expect(respuestaDeLaOrden({ tipo: 'no_entendi' })).toContain('muéstrame')
    expect(respuestaDeLaOrden({ tipo: 'cual', opciones: ['A', 'B'] })).toBe('¿Cuál? A, B.')
  })
})

describe('lo de salud nunca se vuelve navegación', () => {
  it.each(['me duele el pecho', 'me duele la rodilla en la sentadilla', 'tengo una lesión en el hombro', 'me quiero morir', 'tengo diarrea'])('«%s»', (dicho) => {
    const orden = interpretarOrden(dicho, sesion)
    expect(orden.tipo).toBe('salud')
    expect(respuestaDeLaOrden(orden).length).toBeGreaterThan(10)
  })
})

describe('una pregunta hablada va a las dudas de Praxis, tal como se dijo', () => {
  it.each([
    '¿por qué descanso tanto entre series?',
    'por qué descanso tanto entre series',
    'cuántas series de pecho hago a la semana',
    'qué es el RIR',
    'oye praxis debo llegar al fallo',
    'puedo entrenar pierna dos días seguidos',
    'cómo subo de peso en la sentadilla',
    'tengo una duda para qué sirve el cardio',
    // Las cinco de la primera prueba de Bryan (31-oct), como las entrega el reconocedor: sin signos ni comas.
    'tengo que llegar al fallo para que crezca el músculo',
    'llevo dos años entrenando cuántas series me sirven',
    'dormí mal anoche entreno igual hoy',
    'por qué tengo que anotar todos los días cómo me siento',
    'cuántas calorías tiene una arepa con queso',
    // Sin palabra de pregunta, pero nadie da una orden tan larga.
    'anoche casi no dormí y hoy entreno pecho',
    'quiero saber si la sentadilla sirve para la cola',
  ])('«%s»', (dicho) => {
    expect(interpretarOrden(dicho, sesion)).toEqual({ tipo: 'duda', frase: dicho })
  })

  it('una orden larga con su verbo sigue siendo una orden', () => {
    expect(interpretarOrden('por favor muéstrame los cuádriceps de una vez', sesion)).toEqual({ tipo: 'zona', id: 'cua' })
    expect(interpretarOrden('quiero ver el movimiento de la sentadilla ahora', sesion).tipo).not.toBe('duda')
  })

  it('pedir un movimiento o lo de hoy sigue siendo una orden, aunque suene a pregunta', () => {
    expect(interpretarOrden('¿cómo se hace la sentadilla?', sesion)).toMatchObject({ tipo: 'ejercicio', indice: 0 })
    expect(interpretarOrden('¿qué me toca hoy?', sesion).tipo).toBe('hoy')
    expect(interpretarOrden('qué rico el almuerzo', sesion).tipo).toBe('no_entendi')
  })

  it('una duda de salud no se vuelve pregunta: la filtra lo de salud', () => {
    expect(interpretarOrden('por qué me duele la rodilla', sesion).tipo).toBe('salud')
  })

  it('muestra lo que oyó, para que se note si el reconocedor se equivocó', () => {
    expect(respuestaDeLaOrden({ tipo: 'duda', frase: 'qué es el RIR' })).toContain('qué es el RIR')
  })
})

describe('una señal de riesgo por voz lleva la frase a la pantalla que da las líneas de ayuda', () => {
  it('«me quiero morir» conserva la frase; lo clínico no la necesita', () => {
    expect(interpretarOrden('me quiero morir', sesion)).toMatchObject({ tipo: 'salud', frase: 'me quiero morir' })
    expect(interpretarOrden('ya no puedo más con todo', sesion)).toMatchObject({ tipo: 'salud', frase: 'ya no puedo más con todo' })
    expect(interpretarOrden('me duele el pecho', sesion)).toMatchObject({ tipo: 'salud', frase: 'me duele el pecho' })
    expect(interpretarOrden('me duele la rodilla en la sentadilla', sesion)).not.toHaveProperty('frase')
  })
})

describe('no gasta la clave', () => {
  it('no llama a la red, ni a un modelo, ni guarda lo dicho', () => {
    const fuente = readFileSync(resolve(__dirname, 'ordenesDeVoz.ts'), 'utf8')
    expect(fuente).not.toMatch(/\bfetch\(|anthropic|XMLHttpRequest|supabase|localStorage/i)
  })
})
