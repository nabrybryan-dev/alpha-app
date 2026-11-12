import { describe, expect, it } from 'vitest'
import { filtroDeRiesgo } from './riesgo'

describe('lista ampliada de autolesión e ideación (11-nov-2026; lista propuesta, PENDIENTE de firma de la profesional)', () => {
  it.each([
    'me quiero hacer daño',
    'tengo ganas de hacerme daño',
    'quiero hacerme daño',
    'me quiero haser daño',
    'a veces me quiero acer daño',
    'ella se quiere hacer daño',
    'hola, tengo ganas de acabar con todo',
    'quiero acabar con todo',
    'quisiera terminar con todo ya',
    'a veces quiero dejar de existir',
    'no quiero estar en este mundo',
  ])('«%s» se detiene en la Quieta de vida', (frase) => {
    expect(filtroDeRiesgo(frase)).toEqual({ tipo: 'quieta', linea: 'vida' })
  })

  it.each([['acabar con todo', 'cuidado'], ['siento que voy a acabar con todo', 'cuidado'], ['no quiero seguir', 'cuidado']])('«%s» se pregunta (cuidado)', (frase, tipo) => {
    expect(filtroDeRiesgo(frase)?.tipo).toBe(tipo)
  })

  it.each([
    'acabar con todo el agua que tenía',
    'hoy quiero acabar con todo lo de la lista',
    'voy a acabar con todo en el gym',
    'terminar con todo el plan de la semana',
    'me hice daño en la rodilla entrenando',
    'me voy a hacer daño si subo tanto peso',
    'esto me puede hacer daño',
  ])('«%s» NO es riesgo de vida', (frase) => {
    const m = filtroDeRiesgo(frase)
    expect(m === null || m.tipo === 'salud').toBe(true)
  })
})
