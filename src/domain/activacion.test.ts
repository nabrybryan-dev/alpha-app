import { describe, expect, it } from 'vitest'
import { evaluarCierre, revisarActivacion, sumarDias, type SenalesPropuesta } from './activacion'

/** Un microciclo bien registrado: nada que objetar. */
function senales(parcial: Partial<SenalesPropuesta> = {}): SenalesPropuesta {
  return {
    sesionesSinRegistrar: 0,
    ejerciciosSinSeries: 0,
    ejerciciosTotales: 12,
    prsUltimo: 6,
    saltoMaximo: 0.03,
    brechaMaxima: 1,
    ...parcial,
  }
}

describe('revisarActivacion', () => {
  it('con todo en orden, se activa sola y sin motivos', () => {
    const r = revisarActivacion(senales())
    expect(r.auto).toBe(true)
    expect(r.motivos).toEqual([])
  })

  it('una sesión sin registrar se tolera; dos no', () => {
    expect(revisarActivacion(senales({ sesionesSinRegistrar: 1 })).auto).toBe(true)
    const dos = revisarActivacion(senales({ sesionesSinRegistrar: 2 }))
    expect(dos.auto).toBe(false)
    expect(dos.motivos[0]).toMatch(/2 sesiones sin registrar/)
  })

  it('tolera hasta un 20 % de ejercicios sin series', () => {
    // 2 de 12 = 16,7 %: pasa. 3 de 12 = 25 %: no.
    expect(revisarActivacion(senales({ ejerciciosSinSeries: 2 })).auto).toBe(true)
    expect(revisarActivacion(senales({ ejerciciosSinSeries: 3 })).auto).toBe(false)
  })

  it('POCO y NADA frenan la activación; NORMAL y MUCHO no', () => {
    expect(revisarActivacion(senales({ prsUltimo: 1 })).auto).toBe(false) // NADA
    expect(revisarActivacion(senales({ prsUltimo: 3 })).auto).toBe(false) // POCO
    expect(revisarActivacion(senales({ prsUltimo: 6 })).auto).toBe(true) // NORMAL
    expect(revisarActivacion(senales({ prsUltimo: 9 })).auto).toBe(true) // MUCHO
  })

  it('un salto de carga mayor del 10 % la frena', () => {
    expect(revisarActivacion(senales({ saltoMaximo: 0.1 })).auto).toBe(true)
    const grande = revisarActivacion(senales({ saltoMaximo: 0.18 }))
    expect(grande.auto).toBe(false)
    expect(grande.motivos[0]).toMatch(/\+18 %/)
  })

  it('una brecha de reps mayor de 3 la frena', () => {
    expect(revisarActivacion(senales({ brechaMaxima: 3 })).auto).toBe(true)
    expect(revisarActivacion(senales({ brechaMaxima: 4 })).auto).toBe(false)
  })

  it('acumula todos los motivos, no solo el primero', () => {
    const r = revisarActivacion(
      senales({ sesionesSinRegistrar: 3, prsUltimo: 1, saltoMaximo: 0.4 }),
    )
    expect(r.auto).toBe(false)
    expect(r.motivos).toHaveLength(3)
  })

  /**
   * Que falte una señal no puede bloquear por sí solo: si no hay PRS es porque no
   * llenó el test, y eso ya lo caza «sesiones sin registrar». Bloquear también por
   * el hueco daría dos avisos del mismo problema.
   */
  it('las señales que faltan no bloquean por sí solas', () => {
    const r = revisarActivacion({
      sesionesSinRegistrar: 0,
      ejerciciosSinSeries: 0,
      ejerciciosTotales: 10,
    })
    expect(r.auto).toBe(true)
  })

  /**
   * Este test nació afirmando `auto === true`, y esa afirmación era el fallo: se
   * escribió para comprobar que no reventaba la división por cero y de paso dejó
   * fijado que un microciclo vacío es fiable. No lo es —y encima es el único caso
   * que ninguna otra regla frena, porque sin ejercicios no hay series que falten,
   * ni saltos, ni brechas—: se activaría un microciclo vacío detrás de otro.
   */
  it('un microciclo sin ejercicios no es fiable, y no revienta al dividir', () => {
    const r = revisarActivacion(senales({ ejerciciosTotales: 0, ejerciciosSinSeries: 0 }))
    expect(r.auto).toBe(false)
    expect(r.motivos).toContain('el microciclo no tiene ejercicios de fuerza')
  })
})

describe('sumarDias', () => {
  it('suma dentro del mismo mes', () => {
    expect(sumarDias('2026-07-20', 8)).toBe('2026-07-28')
  })

  it('cruza el fin de mes y el fin de año', () => {
    expect(sumarDias('2026-07-28', 8)).toBe('2026-08-05')
    expect(sumarDias('2026-12-28', 8)).toBe('2027-01-05')
  })

  it('respeta los años bisiestos', () => {
    expect(sumarDias('2028-02-26', 4)).toBe('2028-03-01')
    expect(sumarDias('2026-02-26', 4)).toBe('2026-03-02')
  })

  it('acepta la cadencia de 15 días', () => {
    expect(sumarDias('2026-07-20', 15)).toBe('2026-08-04')
  })
})

describe('evaluarCierre', () => {
  const micro = { fechaInicio: '2026-07-20', cadenciaDias: 8, sesiones: [1, 2, 3, 4, 5, 6] }

  it('no vence mientras queden sesiones y no llegue la fecha', () => {
    const r = evaluarCierre(micro, '2026-07-24', 3)
    expect(r.vencido).toBe(false)
    expect(r.motivo).toBeUndefined()
    expect(r.fechaFin).toBe('2026-07-28')
  })

  it('vence en cuanto registra todas las sesiones, aunque falten días', () => {
    const r = evaluarCierre(micro, '2026-07-24', 0)
    expect(r.vencido).toBe(true)
    expect(r.motivo).toBe('sesiones-completas')
  })

  it('vence por calendario aunque queden sesiones sin registrar', () => {
    const r = evaluarCierre(micro, '2026-07-28', 2)
    expect(r.vencido).toBe(true)
    expect(r.motivo).toBe('calendario')
    // Se cierra igual, pero el número viaja para que Bryan se entere.
    expect(r.sesionesPendientes).toBe(2)
  })

  it('el día exacto de fin ya cuenta como vencido', () => {
    expect(evaluarCierre(micro, '2026-07-27', 1).vencido).toBe(false)
    expect(evaluarCierre(micro, '2026-07-28', 1).vencido).toBe(true)
  })

  it('quien va muy retrasado sigue vencido, no se queda colgado', () => {
    const r = evaluarCierre(micro, '2026-09-15', 5)
    expect(r.vencido).toBe(true)
    expect(r.motivo).toBe('calendario')
  })

  /**
   * Un microciclo sin sesiones tendría 0 pendientes y se daría por «completado»
   * el primer día. Es un caso de datos rotos, pero cerrarlo solo sería peor.
   */
  it('un microciclo sin sesiones no se da por completado', () => {
    const vacio = { fechaInicio: '2026-07-20', cadenciaDias: 8, sesiones: [] }
    expect(evaluarCierre(vacio, '2026-07-21', 0).vencido).toBe(false)
  })

  it('la cadencia de 15 días alarga la ventana', () => {
    const quincenal = { ...micro, cadenciaDias: 15 }
    expect(evaluarCierre(quincenal, '2026-07-28', 3).vencido).toBe(false)
    expect(evaluarCierre(quincenal, '2026-08-04', 3).vencido).toBe(true)
  })
})
