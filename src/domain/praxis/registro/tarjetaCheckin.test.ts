// @vitest-environment node
/**
 * Tarjeta del check-in armada por Praxis (diseño 2026-11-07, paso 2).
 *
 * ESCRITOS POR IA: SOLO PRUEBA, NO SIRVEN PARA ENTRENAR EL MODELO PROPIO (regla del 5-nov-2026).
 * Frases inventadas, sin nombres ni datos de nadie.
 */
import { describe, expect, it } from 'vitest'
import { conectarMensaje } from './conectores.ts'
import { CONECTORES_EN_TARJETA, OBLIGATORIOS, armarTarjeta, confirmarTarjeta, siguientePregunta, type TarjetaCheckin } from './tarjetaCheckin.ts'
import type { CampoCheckin } from './mensajeLargo.ts'

function tarjeta(texto: string, preguntaAnterior?: CampoCheckin, yaHoy: CampoCheckin[] = []): TarjetaCheckin {
  const t = armarTarjeta(conectarMensaje(texto, { preguntaAnterior }), yaHoy)
  if (!t) throw new Error('se esperaba tarjeta, salió riesgo')
  return t
}

describe('armar la tarjeta', () => {
  it('T01 cada fila trae el rótulo y las opciones del formulario, lo marcado y la cita', () => {
    const t = tarjeta('Dormí fatal y el entreno no tan bien')
    const sueno = t.filas.find((f) => f.campo === 'calidadSueno')
    expect(sueno).toMatchObject({ rotulo: 'Calidad del sueño', opciones: ['MALA', 'REGULAR', 'BUENA'], marcado: 'MALA', origen: 'tabla' })
    const rend = t.filas.find((f) => f.campo === 'rendimiento')
    expect(rend).toMatchObject({ marcado: null, candidatos: ['REGULAR', 'MALA'], origen: 'dudosa' })
  })

  it('T02 faltantes = los 8 obligatorios menos lo que ya trae la tarjeta y lo ya lleno hoy, en el orden del formulario', () => {
    const t = tarjeta('Dormí fatal', undefined, ['alimentacion'])
    expect(t.faltantes).toEqual(['rendimiento', 'motivacion', 'hambreEscala', 'cansancio', 'estres', 'dolor'])
  })

  it('T03 un mensaje con riesgo no da tarjeta', () => {
    expect(armarTarjeta(conectarMensaje('estoy ahí, me duele mucho el pecho'))).toBeNull()
  })

  it('T04 el hambre vaga llega como fila de 1 a 10 SIN nada marcado (nunca un número sacado de palabras)', () => {
    const t = tarjeta('ahí, como medio', 'hambreEscala')
    expect(t.filas).toEqual([expect.objectContaining({ campo: 'hambreEscala', rotulo: 'Hambre de hoy', marcado: null, candidatos: [] })])
    expect(t.filas[0].opciones).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(t.tramos).toHaveLength(1)
    expect(t.faltantes).not.toContain('hambreEscala')
  })
})

describe('confirmar', () => {
  it('T05 lo marcado por Praxis NO se guarda sin el toque de la persona', () => {
    const t = tarjeta('Dormí fatal y comí bien')
    const c = confirmarTarjeta(t, [{ campo: 'calidadSueno', valor: 'MALA' }])
    expect(c.parche).toEqual({ calidadSueno: 'MALA' })
    expect(c.pendientes).toEqual(['alimentacion'])
  })

  it('T06 la persona puede cambiar el valor o no anotarlo', () => {
    const t = tarjeta('Dormí fatal y comí bien')
    const c = confirmarTarjeta(t, [{ campo: 'calidadSueno', valor: 'REGULAR' }, { campo: 'alimentacion', noAnotar: true }])
    expect(c.parche).toEqual({ calidadSueno: 'REGULAR' })
    expect(c.pendientes).toEqual([])
  })

  it('T07 un valor fuera de la escala no entra', () => {
    const t = tarjeta('ahí, como medio', 'estres')
    const c = confirmarTarjeta(t, [{ campo: 'estres', valor: 'ALTO' }, { campo: 'hambreEscala', valor: 11 }, { campo: 'horasSueno', valor: 6.3 }])
    expect(c.parche).toEqual({})
    expect(c.errores.map((e) => e.campo)).toEqual(['estres', 'hambreEscala', 'horasSueno'])
  })

  it('T08 el dolor solo admite «sin dolor» por aquí', () => {
    const t = tarjeta('Dormí fatal')
    expect(confirmarTarjeta(t, [{ campo: 'dolor', valor: 0 }]).parche).toEqual({ dolor: 0 })
    expect(confirmarTarjeta(t, [{ campo: 'dolor', valor: 4 }]).errores).toEqual([{ campo: 'dolor', motivo: expect.stringContaining('formulario') }])
  })

  it('T09 un check-in con alguno de los 8 vacío queda parcial; con los 8, no', () => {
    const t = tarjeta('Dormí fatal')
    expect(confirmarTarjeta(t, [{ campo: 'calidadSueno', valor: 'MALA' }]).parcial).toBe(true)
    const yaHoy = OBLIGATORIOS.filter((c) => c !== 'calidadSueno')
    expect(confirmarTarjeta(t, [{ campo: 'calidadSueno', valor: 'MALA' }], yaHoy).parcial).toBe(false)
  })

  it('T10 las horas confirmadas se marcan como anotadas hoy', () => {
    const t = tarjeta('Anoche dormí seis horas')
    const c = confirmarTarjeta(t, [{ campo: 'horasSueno', valor: 6 }])
    expect(c.parche).toEqual({ horasSueno: 6 })
    expect(c.anotadoHoy).toEqual(['horasSueno'])
  })
})

describe('preguntar lo que falta, de a uno', () => {
  it('T11 una sola pregunta, la primera que falta, y cambia de forma según el turno', () => {
    const p0 = siguientePregunta(['estres', 'dolor'], 0)
    const p1 = siguientePregunta(['estres', 'dolor'], 1)
    expect(p0?.campo).toBe('estres')
    expect(p0?.texto).not.toBe(p1?.texto)
    expect(siguientePregunta([], 0)).toBeNull()
  })

  it('T12 ciclo completo: Praxis pregunta, la persona dice «ahí, como medio», la tarjeta lo propone y se confirma', () => {
    const t1 = tarjeta('Dormí fatal y comí bien')
    const p = siguientePregunta(t1.faltantes, 0)
    expect(p?.campo).toBe('rendimiento')
    const t2 = tarjeta('ahí, como medio', p?.campo)
    expect(t2.filas[0]).toMatchObject({ campo: 'rendimiento', marcado: 'REGULAR', origen: 'vago' })
    const c = confirmarTarjeta(t2, [{ campo: 'rendimiento', valor: 'REGULAR' }], ['calidadSueno', 'alimentacion'])
    expect(c.parche).toEqual({ rendimiento: 'REGULAR' })
    expect(c.parcial).toBe(true)
  })
})

it('T13 la bandera está encendida (sí de Bryan, 7-nov, con la 0170 y la 0171 aplicadas): cambiarla es a propósito', () => {
  expect(CONECTORES_EN_TARJETA).toBe(true)
})
