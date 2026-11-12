import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { armarSemana } from '../../../domain/rutaEntrenamiento'
import type { Microciclo, Sesion } from '../../../domain/types'
import { resumenDeLaHoja } from './panel/resumenDeLaHoja'
import { BarraDeSesion } from './rumbo/BarraDeSesion'
import { diaEnPantalla } from './rumbo/diaEnPantalla'

/** Día doble en el salón (asesorada ficticia). 2026-07-20 es lunes. */
function sesion(id: string, nombre: string, orden: number, hechas = false): Sesion {
  return {
    id,
    nombre,
    orden,
    ejercicios: [
      {
        id: `e-${id}`, categoria: 'DOMINANTE DE RODILLA', nombre: 'Sentadilla', cues: '', prescripcion: '',
        descansoMin: 2, sets: 1, rango: '(8-12)', repsDiana: 10, rirObjetivo: 2,
        series: hechas ? [{ orden: 1, cargaKg: 40, reps: 10, rir: 2 }] : [],
      },
    ],
  }
}
const micro = (sesiones: Sesion[]): Microciclo => ({
  id: 'm-x', usuarioId: 'u-ficticia', numero: 1, cadenciaDias: 7, estado: 'activo', fechaInicio: '2026-07-20', sesiones,
})

const am = sesion('am', 'FUERZA AM (LUNES)', 1)
const pm = sesion('pm', 'REPASO PM (LUNES)', 2)
const doble = armarSemana(micro([am, pm]), '2026-07-20')
const simple = armarSemana(micro([sesion('uno', 'UNICA (LUNES)', 1)]), '2026-07-20')

describe('salón con día doble', () => {
  it('diaEnPantalla encuentra el día también por la sesión de la noche', () => {
    expect(diaEnPantalla(doble, 'pm', null)).toBe(0)
    expect(diaEnPantalla(doble, 'am', null)).toBe(0)
  })

  it('la banda ofrece las dos sesiones, mañana primero, y avisa de la elegida', () => {
    const elegir = vi.fn()
    render(<BarraDeSesion sesion={pm} semana={doble} sesionesDelDia={doble[0].sesiones} onElegirSesion={elegir} />)
    const botones = screen.getAllByRole('button', { pressed: undefined }).filter((b) => /Mañana|Noche/.test(b.textContent ?? ''))
    expect(botones.map((b) => b.textContent)).toEqual(['Mañana', 'Noche'])
    expect(botones[1]).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(botones[0])
    expect(elegir).toHaveBeenCalledWith('am')
  })

  it('el botón de la hoja abre la sesión que se ve, no siempre la de sesionCta', () => {
    const cta = { id: 'am', nombre: am.nombre, empezada: false, esDeHoy: true }
    const deNoche = resumenDeLaHoja({ sesion: pm, semana: doble, diaElegido: null, sesionCta: cta })
    expect(deNoche.boton).toEqual({ texto: 'Empezar sesión', a: '/entrenar/sesion/pm' })
    const deManana = resumenDeLaHoja({ sesion: am, semana: doble, diaElegido: null, sesionCta: cta })
    expect(deManana.boton?.a).toBe('/entrenar/sesion/am')
  })
})

describe('salón con un día de una sola sesión: igual que antes', () => {
  it('la banda no pinta pastillas y la hoja usa sesionCta', () => {
    const una = simple[0].sesiones
    const { container } = render(<BarraDeSesion sesion={sesion('uno', 'UNICA (LUNES)', 1)} semana={simple} sesionesDelDia={una} />)
    expect(screen.queryByRole('group')).toBeNull()
    expect(container.textContent).not.toMatch(/Mañana|Noche/)
    const cta = { id: 'uno', nombre: 'UNICA (LUNES)', empezada: false, esDeHoy: true }
    expect(resumenDeLaHoja({ sesion: sesion('uno', 'UNICA (LUNES)', 1), semana: simple, diaElegido: null, sesionCta: cta }).boton)
      .toEqual({ texto: 'Empezar sesión', a: '/entrenar/sesion/uno' })
  })
})
