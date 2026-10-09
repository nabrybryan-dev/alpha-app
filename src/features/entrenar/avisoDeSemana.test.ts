import { describe, expect, it } from 'vitest'
import type { Microciclo } from '../../domain/types'
import { avisoDeSemana } from './avisoDeSemana'

/**
 * El aviso de «esta semana no es la de hoy», sacado de `PanelInferior` para que lo
 * compartan el salón y la lista sencilla.
 *
 * Los textos son los que ya tenía el pie del recuadro «La semana» y NO cambian: quien
 * los vio en el salón tiene que leer lo mismo en la lista. Las fechas son concretas a
 * propósito: el microciclo de prueba arranca el lunes 2026-09-07 y dura 7 días, así que
 * su último día es el domingo 2026-09-13.
 */

function micro(extra: Partial<Microciclo> = {}): Microciclo {
  return {
    id: 'm-5',
    usuarioId: 'u-1',
    numero: 5,
    cadenciaDias: 7,
    estado: 'activo',
    fechaInicio: '2026-09-07',
    sesiones: [],
    ...extra,
  }
}

describe('avisoDeSemana', () => {
  it('adelantada: hoy es antes del arranque, y lo dice con el número del microciclo', () => {
    expect(avisoDeSemana(micro(), '2026-09-06')).toEqual({
      tipo: 'adelantada',
      texto: 'Próxima semana · Microciclo 5',
    })
  })

  it('vencida: hoy es después del último día, y dice cuándo terminó', () => {
    const aviso = avisoDeSemana(micro(), '2026-09-14')
    expect(aviso?.tipo).toBe('vencida')
    // El mes sale de `toLocaleDateString('es-CO')`, que según el ICU de Node es «13 de sept»
    // o «13 sep»: lo que se fija es el día —el 13, no el 14 ni el 7— y la frase alrededor.
    expect(aviso?.texto).toMatch(
      /^El microciclo 5 terminó el 13 (de )?\S+ · tu coach prepara el siguiente$/,
    )
  })

  it('vigente: ni el primer día ni el último llevan aviso', () => {
    expect(avisoDeSemana(micro(), '2026-09-07')).toBeUndefined()
    expect(avisoDeSemana(micro(), '2026-09-10')).toBeUndefined()
    // El último día DENTRO del microciclo es la víspera de `fechaInicio + cadencia`.
    expect(avisoDeSemana(micro(), '2026-09-13')).toBeUndefined()
  })

  it('un microciclo sin fecha de inicio no se marca como vencido ni adelantado', () => {
    // Un campo ausente degrada a la conducta de antes: no se acusa a nadie por un dato que falta.
    expect(avisoDeSemana(micro({ fechaInicio: '' }), '2026-09-14')).toBeUndefined()
  })
})
