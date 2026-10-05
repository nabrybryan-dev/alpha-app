import { describe, expect, it } from 'vitest'
import { esOrdenDeEscribir, limpiarDictado } from './dictado'

/**
 * La limpieza del dictado (estilo «Alpha Dictado»): quita lo que no es palabra y corrige el
 * vocabulario de Alpha que el reconocedor oye mal. Lo que NO debe tocar pesa tanto como lo
 * que quita: un marcador del español o la «e» de «padre e hijo» son de la persona.
 */
describe('limpiarDictado · quita lo que no es palabra', () => {
  it.each([
    ['Eh, dormí como seis horas', 'Dormí como seis horas'],
    ['dormí ehh como seis horas', 'dormí como seis horas'],
    ['mmm, hice pierna', 'hice pierna'], // la mayúscula solo se repone si la frase venía con ella
    ['Mmm, hice pierna', 'Hice pierna'],
    ['hice emm cuatro series', 'hice cuatro series'],
    ['me fue bien, eh.', 'me fue bien.'],
    ['Bueno, mmm, me dolió la rodilla', 'Bueno, me dolió la rodilla'],
  ])('«%s» → «%s»', (crudo, limpio) => {
    expect(limpiarDictado(crudo)).toBe(limpio)
  })

  it('la «E.» suelta que el reconocedor escribe por un «eh» alargado, cuando es una frase entera', () => {
    expect(limpiarDictado('E. Hice cuatro series de sentadilla.')).toBe('Hice cuatro series de sentadilla.')
    expect(limpiarDictado('Dormí mal. E. Comí bien.')).toBe('Dormí mal. Comí bien.')
  })

  it('espacios dobles fuera', () => {
    expect(limpiarDictado('hice   cuatro  series')).toBe('hice cuatro series')
  })

  it('si solo había pausas, no queda nada que mandar', () => {
    expect(limpiarDictado('eh mmm')).toBe('')
    expect(limpiarDictado('E.')).toBe('')
    expect(limpiarDictado('   ')).toBe('')
  })
})

describe('limpiarDictado · lo que NO toca', () => {
  it.each([
    'padre e hijo',
    'Este, pues, bueno, o sea, digamos que me fue bien',
    'entrené en el tanque de agua',
    'Ah, ya me acordé',
    'Elena dijo que sí',
    'hice la rutina E del plan',
  ])('«%s» queda igual', (frase) => {
    expect(limpiarDictado(frase)).toBe(frase)
  })
})

describe('limpiarDictado · el vocabulario de Alpha', () => {
  it.each([
    ['lo hice a R y R 2', 'lo hice a RIR 2'],
    ['quedé en r y r 1', 'quedé en RIR 1'],
    ['sentadilla gobled con 20', 'sentadilla goblet con 20'],
    ['sentadilla Goblet con 20', 'sentadilla goblet con 20'],
    ['hice bulgara con pausa', 'hice búlgara con pausa'],
    ['tres series de hip trust', 'tres series de hip thrust'],
    ['un RPE de 8, r p e 8', 'un RPE de 8, RPE 8'],
  ])('«%s» → «%s»', (crudo, limpio) => {
    expect(limpiarDictado(crudo)).toBe(limpio)
  })

  it('solo palabra entera: «rir» dentro de otra palabra no se toca', () => {
    expect(limpiarDictado('quiero sonreír más')).toBe('quiero sonreír más')
    expect(limpiarDictado('la bulgarada')).toBe('la bulgarada')
  })
})

describe('esOrdenDeEscribir · abrir la barra con la voz', () => {
  it.each(['escribir', 'Quiero escribir.', 'Despliega la barra', 'Praxis, quiero escribir', 'abre el teclado por favor'])('«%s» es la orden', (t) => {
    expect(esOrdenDeEscribir(t)).toBe(true)
  })
  it.each(['quiero escribir lo que comí hoy', 'hoy no quise escribir nada', 'dormí seis horas'])('«%s» NO es la orden: se manda como cualquier frase', (t) => {
    expect(esOrdenDeEscribir(t)).toBe(false)
  })
})
