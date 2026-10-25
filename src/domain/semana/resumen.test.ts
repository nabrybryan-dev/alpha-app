import { describe, expect, it } from 'vitest'
import type { Cuestionario, Respuesta } from '../types'
import { cuestionariosDeLaSemana, lunesDe, rangoDeLaSemana, resumirLaSemana } from './resumen'

/**
 * La semana natural (lunes a domingo) y la cuenta de lo hecho.
 *
 * La cuenta es deliberadamente corta: sesiones pautadas y cuestionarios asignados. Ni
 * check-ins ni notas, porque la app no guarda «hecho» para ellos y contarlos inventaría
 * un estado que nadie marcó. Ese límite se prueba aquí, no en la pantalla.
 */
describe('la semana natural', () => {
  it('un jueves cae en el lunes que abrió esa semana', () => {
    expect(lunesDe('2026-10-22')).toBe('2026-10-19')
  })

  it('un lunes se queda en su propio lunes', () => {
    expect(lunesDe('2026-10-19')).toBe('2026-10-19')
  })

  it('un domingo vuelve al lunes anterior, no al siguiente', () => {
    expect(lunesDe('2026-10-25')).toBe('2026-10-19')
  })

  it('cruza el cambio de mes sin perder el día', () => {
    expect(lunesDe('2026-11-01')).toBe('2026-10-26')
  })

  it('el rango dice los dos extremos y el mes una sola vez si no cambia', () => {
    expect(rangoDeLaSemana('2026-10-22')).toEqual({
      inicio: '2026-10-19',
      fin: '2026-10-25',
      etiqueta: 'Del 19 al 25 de octubre',
    })
  })

  it('si la semana cruza de mes, dice los dos meses', () => {
    expect(rangoDeLaSemana('2026-10-01').etiqueta).toBe('Del 28 de septiembre al 4 de octubre')
  })

  it('si cruza de año, dice los dos años', () => {
    expect(rangoDeLaSemana('2027-01-01').etiqueta).toBe('Del 28 de diciembre de 2026 al 3 de enero de 2027')
  })
})

const cuestionario = (id: string): Cuestionario => ({
  id,
  titulo: id,
  descripcion: '',
  preguntas: [],
  asignadoA: ['u-valentina'],
})

const respuesta = (cuestionarioId: string, fechaIso: string): Respuesta => ({
  id: `r-${cuestionarioId}-${fechaIso}`,
  cuestionarioId,
  usuarioId: 'u-valentina',
  fechaIso,
  valores: {},
})

describe('los cuestionarios que caben en la semana', () => {
  const rango = rangoDeLaSemana('2026-10-22')

  it('una respuesta de otra semana no cuenta, y lo pendiente sí es de esta', () => {
    const r = cuestionariosDeLaSemana(
      [cuestionario('q-viejo'), cuestionario('q-pendiente')],
      [respuesta('q-viejo', '2026-10-13T18:30:00')],
      rango,
    )
    expect(r).toEqual({ total: 1, respondidos: 0 })
  })

  it('cuenta las respuestas del lunes al domingo, en los dos extremos', () => {
    const r = cuestionariosDeLaSemana(
      [cuestionario('q-lunes'), cuestionario('q-domingo'), cuestionario('q-pendiente')],
      [
        respuesta('q-lunes', '2026-10-19T00:00:00'),
        respuesta('q-domingo', '2026-10-25T23:59:00'),
      ],
      rango,
    )
    expect(r).toEqual({ total: 3, respondidos: 2 })
  })

  it('la respuesta del día siguiente ya no es de esta semana', () => {
    const r = cuestionariosDeLaSemana(
      [cuestionario('q-lunes')],
      [respuesta('q-lunes', '2026-10-26T00:00:00')],
      rango,
    )
    expect(r).toEqual({ total: 0, respondidos: 0 })
  })

  it('una respuesta de un cuestionario que no se le asignó no inventa una hecha', () => {
    const r = cuestionariosDeLaSemana([cuestionario('q-propio')], [respuesta('q-ajeno', '2026-10-22T10:00:00')], rango)
    expect(r).toEqual({ total: 1, respondidos: 0 })
  })
})

describe('la cuenta de la semana', () => {
  it('suma sesiones y cuestionarios, y no cuenta lo que no tiene estado', () => {
    const r = resumirLaSemana({
      sesionesPautadas: 5,
      sesionesHechas: 3,
      cuestionariosTotal: 2,
      cuestionariosRespondidos: 1,
    })
    expect(r).toMatchObject({ hechas: 4, total: 7, pct: 57 })
    expect(r.segmentos).toHaveLength(7)
    expect(r.segmentos.filter(Boolean)).toHaveLength(4)
    expect(r.texto).toBe('4 de 7 hechas esta semana')
  })

  it('no deja que lo hecho pase de lo pautado', () => {
    const r = resumirLaSemana({
      sesionesPautadas: 2,
      sesionesHechas: 9,
      cuestionariosTotal: 1,
      cuestionariosRespondidos: 4,
    })
    expect(r.hechas).toBe(3)
    expect(r.total).toBe(3)
    expect(r.pct).toBe(100)
    expect(r.texto).toBe('Todo hecho esta semana')
  })

  it('sin nada pautado lo dice, en vez de enseñar un cero acusador', () => {
    const r = resumirLaSemana({
      sesionesPautadas: 0,
      sesionesHechas: 0,
      cuestionariosTotal: 0,
      cuestionariosRespondidos: 0,
    })
    expect(r.total).toBe(0)
    expect(r.pct).toBe(0)
    expect(r.texto).toBe('Sin nada pautado esta semana')
  })
})
