import { describe, expect, it, vi } from 'vitest'
import type { Sesion } from '../../../../domain/types'
import { ejecutarOrden, type MandosDelSalon } from './ejecutarOrden'

const sesion = { ejercicios: [] } as unknown as Sesion

function mandos(sobre: Partial<MandosDelSalon> = {}): MandosDelSalon {
  return {
    vista: 'cuerpo',
    guia: null,
    sesion,
    ir: vi.fn(),
    cambiarVista: vi.fn(),
    irAlEjercicio: vi.fn(),
    girar: vi.fn(),
    darLaVuelta: vi.fn(),
    ...sobre,
  }
}

describe('lo que hace cada orden con el sujeto', () => {
  it('una zona abre la guía en esa zona', () => {
    const m = mandos()
    ejecutarOrden({ tipo: 'zona', id: 'cua' }, m)
    expect(m.ir).toHaveBeenCalledWith('cua')
    expect(m.cambiarVista).not.toHaveBeenCalled()
  })

  it('desde la vista de movimiento, primero vuelve al cuerpo: la guía solo se ve ahí', () => {
    const m = mandos({ vista: 'movimiento' })
    ejecutarOrden({ tipo: 'zona', id: 'cua' }, m)
    expect(m.cambiarVista).toHaveBeenCalledWith('cuerpo')
    expect(m.ir).toHaveBeenCalledWith('cua')
  })

  it('un ejercicio se elige y se muestra su movimiento', () => {
    const m = mandos()
    ejecutarOrden({ tipo: 'ejercicio', indice: 2, nombre: 'Curl' }, m)
    expect(m.irAlEjercicio).toHaveBeenCalledWith(2)
    expect(m.cambiarVista).toHaveBeenCalledWith('movimiento')
  })

  it('siguiente sin nada abierto empieza lo de hoy; anterior no hace nada', () => {
    const m = mandos()
    ejecutarOrden({ tipo: 'siguiente' }, m)
    expect(m.ir).toHaveBeenCalledWith({ paso: 0, zona: null })
    const n = mandos()
    ejecutarOrden({ tipo: 'anterior' }, n)
    expect(n.ir).not.toHaveBeenCalled()
  })

  it('siguiente en una zona pasa a la vecina, igual que deslizar', () => {
    const m = mandos({ guia: 'pecho' })
    ejecutarOrden({ tipo: 'siguiente' }, m)
    const destino = (m.ir as ReturnType<typeof vi.fn>).mock.calls[0]![0]
    expect(typeof destino).toBe('string')
    expect(destino).not.toBe('pecho')
  })

  it('de espaldas y de frente giran a su cara; la vuelta usa la misma tecla', () => {
    const m = mandos()
    ejecutarOrden({ tipo: 'cara', cara: 'espalda' }, m)
    expect(m.girar).toHaveBeenCalledWith(180)
    ejecutarOrden({ tipo: 'vuelta' }, m)
    expect(m.darLaVuelta).toHaveBeenCalled()
  })

  it.each([
    [{ tipo: 'no_entendi' } as const],
    [{ tipo: 'cual', opciones: ['A', 'B'] } as const],
    [{ tipo: 'salud', respuesta: 'x' } as const],
  ])('%j no mueve nada', (orden) => {
    const m = mandos()
    ejecutarOrden(orden, m)
    expect(m.ir).not.toHaveBeenCalled()
    expect(m.cambiarVista).not.toHaveBeenCalled()
    expect(m.irAlEjercicio).not.toHaveBeenCalled()
  })
})
