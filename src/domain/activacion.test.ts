import { describe, expect, it } from 'vitest'
import { revisarActivacion, type SenalesPropuesta } from './activacion'

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

  it('un microciclo sin ejercicios no revienta al dividir', () => {
    const r = revisarActivacion(senales({ ejerciciosTotales: 0, ejerciciosSinSeries: 0 }))
    expect(r.auto).toBe(true)
  })
})
