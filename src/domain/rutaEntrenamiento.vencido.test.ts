import { describe, expect, it } from 'vitest'
import { armarSemana, semanaEsVencida, ultimoDiaDe } from './rutaEntrenamiento'
import type { Microciclo, Sesion } from './types'

/**
 * La semana que YA TERMINÓ se dice, no se repite en silencio.
 *
 * ROJO A PROPÓSITO contra el código anterior al 2026-09-07.
 *
 * EL CASO REAL. Un asesorado cerró su M5 el 25-ago y nadie le cargó el M6. El
 * lunes 7-sep, trece días después, su pantalla le enseñaba la semana del M5
 * repartida por nombre de día: «LEG A · programada», «UPPER · programada»…
 * Indistinguible de una semana nueva. Ni «Descanso», ni «venció», ni nada.
 *
 * Es la segunda mitad del descuadre del 24-ago. La primera —ofrecer sesiones
 * antes del arranque— se cerró con `yaEmpezo`. Esta se dejó abierta a propósito
 * («taparla le dejaría la semana en blanco»), y la decisión sigue siendo esa:
 * las sesiones se QUEDAN, porque entrenar el plan viejo es mejor que nada. Lo
 * que no puede pasar es que la pantalla no lo diga.
 *
 * Por eso aquí hay dos garantías, y las dos cuentan:
 *   1. `semanaEsVencida` es verdad en cuanto pasa el último día de la cadencia.
 *   2. `armarSemana` sigue repartiendo las sesiones ese día — no se tapa nada.
 */

const s = (id: string, nombre: string, orden: number): Sesion => ({
  id,
  nombre,
  orden,
  ejercicios: [],
})

function micro(fechaInicio: string, cadenciaDias: 8 | 15 = 8): Microciclo {
  return {
    id: 'm-parra',
    usuarioId: 'u-parra',
    numero: 5,
    cadenciaDias,
    estado: 'activo',
    fechaInicio,
    sesiones: [
      s('s1', 'LEG A (LUNES)', 1),
      s('s2', 'UPPER A (MIÉRCOLES)', 2),
      s('s3', 'LEG B (VIERNES)', 3),
    ],
  }
}

describe('ultimoDiaDe — el último día que el microciclo cubre', () => {
  it('con cadencia 8 desde el lunes 31-ago, el último día es el lunes 7-sep', () => {
    // Igual que `evaluarCierre`: vence cuando hoy alcanza inicio + cadencia, así
    // que el último día DENTRO es la víspera de esa fecha.
    expect(ultimoDiaDe(micro('2026-08-31', 8))).toBe('2026-09-07')
  })

  it('con cadencia 15 cubre dos semanas', () => {
    expect(ultimoDiaDe(micro('2026-09-07', 15))).toBe('2026-09-21')
  })

  it('sin fecha de inicio o sin cadencia no se inventa un fin', () => {
    // Misma regla que `yaEmpezo`: un campo ausente degrada a la conducta de
    // antes, no deja a nadie con la semana marcada como vencida por error.
    expect(ultimoDiaDe({ ...micro('2026-08-31'), fechaInicio: '' })).toBeUndefined()
    expect(
      ultimoDiaDe({ ...micro('2026-08-31'), cadenciaDias: undefined as unknown as 8 }),
    ).toBeUndefined()
  })
})

describe('semanaEsVencida — la rejilla enseña una semana que ya terminó', () => {
  it('es falso mientras el microciclo corre, incluido su último día', () => {
    expect(semanaEsVencida(micro('2026-08-31'), '2026-08-31')).toBe(false)
    expect(semanaEsVencida(micro('2026-08-31'), '2026-09-07')).toBe(false)
  })

  it('es verdad desde el día siguiente al último, y sigue siéndolo trece días después', () => {
    expect(semanaEsVencida(micro('2026-08-31'), '2026-09-08')).toBe(true)
    // El caso real: M5 arrancado el 17-ago, vencido el 25, visto el 7-sep.
    expect(semanaEsVencida(micro('2026-08-17'), '2026-09-07')).toBe(true)
  })

  it('es falso antes del arranque: eso es «adelantada», que es otra cosa', () => {
    expect(semanaEsVencida(micro('2026-09-07'), '2026-09-06')).toBe(false)
  })

  it('sin fecha de inicio o sin cadencia nunca es vencida', () => {
    expect(semanaEsVencida({ ...micro('2026-08-31'), fechaInicio: '' }, '2026-09-20')).toBe(false)
  })
})

describe('armarSemana — la semana vencida NO se tapa', () => {
  it('trece días después de vencer, las sesiones siguen en la rejilla', () => {
    // Es la decisión de siempre, ahora escrita en un test: repetir el plan
    // viejo es mejor que una semana en blanco. Lo que cambia es que la pantalla
    // lo dice (`semanaEsVencida`), no que se esconda.
    const dias = armarSemana(micro('2026-08-17'), '2026-09-07')
    const conSesion = dias.filter((d) => d.sesionId !== undefined)
    expect(conSesion.map((d) => d.titulo)).toEqual([
      'LEG A (LUNES)',
      'UPPER A (MIÉRCOLES)',
      'LEG B (VIERNES)',
    ])
    expect(dias.find((d) => d.esHoy)?.estado).toBe('hoy')
  })
})
