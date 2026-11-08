// @vitest-environment node
/**
 * Cómo dice las cosas cada persona (paso 5).
 *
 * ESCRITOS POR IA: SOLO PRUEBA, NO SIRVEN PARA ENTRENAR EL MODELO PROPIO. Frases inventadas, sin nadie real.
 */
import { describe, expect, it } from 'vitest'
import { conectarMensaje, formaVaga } from './conectores.ts'
import { aplicarLexico, aprender, aprendizajeDeEleccion, type FormaAprendida } from './lexicoPersona.ts'
import { armarTarjeta, type TarjetaCheckin } from './tarjetaCheckin.ts'
import type { CampoCheckin } from './mensajeLargo.ts'

const tarjeta = (texto: string, p?: CampoCheckin) => armarTarjeta(conectarMensaje(texto, { preguntaAnterior: p })) as TarjetaCheckin
const tresVeces = (campo: CampoCheckin, forma: string, valor: string): FormaAprendida[] =>
  [1, 2, 3].reduce<FormaAprendida[]>((l) => aprender(l, { campo, forma, valor }), [])

describe('qué se guarda', () => {
  it('L01 solo la expresión vaga, nunca la frase entera', () => {
    expect(formaVaga('Hoy en el trabajo estuve ahí, como medio')?.forma).toBe('como medio')
    const fila = tarjeta('ahí, como medio', 'estres').filas[0]
    expect(aprendizajeDeEleccion(fila, 'MUCHO')).toEqual({ campo: 'estres', forma: expect.not.stringContaining(','), valor: 'MUCHO' })
  })

  it('L02 lo que dijo la tabla, el hambre, el dolor y los números no aprenden', () => {
    const t = tarjeta('Dormí fatal')
    expect(aprendizajeDeEleccion(t.filas[0], 'MALA')).toBeNull()
    expect(aprendizajeDeEleccion({ campo: 'hambreEscala', cita: 'como medio', origen: 'vago' }, 5)).toBeNull()
    expect(aprendizajeDeEleccion({ campo: 'dolor', cita: 'como medio', origen: 'vago' }, 0)).toBeNull()
    // Aunque llegue como texto, el hambre no aprende.
    expect(aprendizajeDeEleccion({ campo: 'hambreEscala', cita: 'como medio', origen: 'vago' }, '5')).toBeNull()
  })
})

describe('aprender', () => {
  it('L03 tres elecciones iguales seguidas suman 3; una distinta vuelve a 1 con el valor nuevo', () => {
    const l = tresVeces('estres', 'como medio', 'MUCHO')
    expect(l).toEqual([{ campo: 'estres', forma: 'como medio', valor: 'MUCHO', confirmaciones: 3 }])
    expect(aprender(l, { campo: 'estres', forma: 'como medio', valor: 'REGULAR' })).toEqual([
      { campo: 'estres', forma: 'como medio', valor: 'REGULAR', confirmaciones: 1 },
    ])
  })

  it('L04 no muta el lexicón que recibe', () => {
    const l = tresVeces('estres', 'como medio', 'MUCHO')
    const copia = JSON.parse(JSON.stringify(l))
    aprender(l, { campo: 'estres', forma: 'como medio', valor: 'POCO' })
    expect(l).toEqual(copia)
  })
})

describe('aplicar a la tarjeta', () => {
  it('L05 con 3 iguales, la fila vaga llega marcada «como lo dices tú»; con 2, no', () => {
    const t = tarjeta('ahí, como medio', 'estres')
    const con3 = aplicarLexico(t, tresVeces('estres', formaVaga(t.filas[0].cita)!.forma, 'MUCHO'))
    expect(con3.filas[0]).toMatchObject({ marcado: 'MUCHO', comoLoDicesTu: true })
    const dos = [1, 2].reduce<FormaAprendida[]>((l) => aprender(l, { campo: 'estres', forma: formaVaga(t.filas[0].cita)!.forma, valor: 'MUCHO' }), [])
    expect(aplicarLexico(t, dos).filas[0]).toMatchObject({ marcado: 'REGULAR' })
  })

  it('L06 en una fila entre dos niveles, solo marca si lo aprendido es uno de esos dos', () => {
    const t = tarjeta('no tan bien', 'cansancio')
    expect(aplicarLexico(t, tresVeces('cansancio', 'no tan bien', 'MUCHO')).filas[0]).toMatchObject({ marcado: 'MUCHO', comoLoDicesTu: true })
    expect(aplicarLexico(t, tresVeces('cansancio', 'no tan bien', 'POCO')).filas[0].marcado).toBeNull()
  })

  it('L07 lo aprendido en un campo no se usa en otro, y la tabla manda sobre lo aprendido', () => {
    const t = tarjeta('ahí, como medio', 'estres')
    expect(aplicarLexico(t, tresVeces('cansancio', 'como medio', 'MUCHO')).filas[0].marcado).toBe('REGULAR')
    // «normal» es vaga, pero en el sueño la tabla ya la lee REGULAR: lo aprendido no la pisa.
    const tabla = tarjeta('Dormí normal')
    expect(tabla.filas[0]).toMatchObject({ campo: 'calidadSueno', origen: 'tabla', marcado: 'REGULAR' })
    expect(aplicarLexico(tabla, tresVeces('calidadSueno', 'normal', 'BUENA')).filas[0].marcado).toBe('REGULAR')
  })

  it('L08 el lexicón de una persona no aparece en la tarjeta de otra (cada llamada solo ve el que recibe)', () => {
    const t = tarjeta('ahí, como medio', 'estres')
    aplicarLexico(t, tresVeces('estres', 'como medio', 'MUCHO'))
    expect(aplicarLexico(t, []).filas[0]).not.toHaveProperty('comoLoDicesTu')
  })
})
