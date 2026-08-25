import { describe, expect, it } from 'vitest'
import { armarSemana, sesionDestacada } from './rutaEntrenamiento'
import type { Microciclo, Sesion } from './types'

/**
 * Qué días de la rejilla pueden llevar sesión.
 *
 * ROJO A PROPÓSITO contra el código anterior al 2026-08-25. `armarSemana` pinta
 * los 7 días naturales de hoy y repartía las sesiones por el nombre del día que
 * llevan dentro, **sin mirar si el microciclo cubre esa fecha**. Un microciclo
 * dura 8 o 15 días y puede empezar cualquier día: la semana natural y el
 * microciclo no son la misma cosa.
 *
 * El caso real: una asesorada con el microciclo del martes 25 al martes 1-sep.
 * Su sesión de CIERRE se llama «(LUNES)» y le toca el 31. Como el 24 era lunes,
 * la app se la ofrecía ese día — el último día de su bloque, antes de empezarlo.
 *
 * SOLO SE ACOTA POR ABAJO. El mismo descuadre tiene una segunda mitad —un
 * microciclo vencido sigue repartiendo sesiones de la semana pasada— pero esa
 * afecta a quien ya está entrenando y va en su propia tanda.
 */

const s = (id: string, nombre: string, orden: number): Sesion => ({
  id,
  nombre,
  orden,
  ejercicios: [],
})

/** El microciclo real que destapó esto: 5 sesiones, arranca en martes. */
function micro(fechaInicio: string, cadenciaDias: 8 | 15 = 8): Microciclo {
  return {
    id: 'm-1',
    usuarioId: 'u-1',
    numero: 1,
    cadenciaDias,
    estado: 'activo',
    fechaInicio,
    sesiones: [
      s('s1', 'PIERNA A · CADERA Y GLÚTEO (MARTES)', 1),
      s('s2', 'TORSO A · ESPALDA Y HOMBRO (MIÉRCOLES)', 2),
      s('s3', 'PIERNA B · CUÁDRICEPS Y GLÚTEO (VIERNES)', 3),
      s('s4', 'TORSO B · EMPUJE Y CORE (SÁBADO)', 4),
      s('s5', 'ZONA 2 + MOVILIDAD (LUNES)', 5),
    ],
  }
}

const dia = (dias: ReturnType<typeof armarSemana>, fechaIso: string) => {
  const d = dias.find((x) => x.fechaIso === fechaIso)
  if (!d) throw new Error(`la rejilla no cubre ${fechaIso}`)
  return d
}

describe('armarSemana — no reparte fuera del microciclo', () => {
  it('el día ANTERIOR al arranque no lleva sesión, aunque el nombre del día encaje', () => {
    // Lunes 24. El microciclo empieza el martes 25. La sesión «(LUNES)» es del 31.
    const dias = armarSemana(micro('2026-08-25'), '2026-08-24')
    const lunes24 = dia(dias, '2026-08-24')
    expect(lunes24.sesionId).toBeUndefined()
    expect(lunes24.estado).toBe('descanso')
  })

  it('y por tanto ese día no se propone ninguna sesión', () => {
    const destacada = sesionDestacada(armarSemana(micro('2026-08-25'), '2026-08-24'))
    expect(destacada?.sesionId).not.toBe('s5')
  })

  it('los días DENTRO del microciclo siguen llevando la suya', () => {
    const dias = armarSemana(micro('2026-08-25'), '2026-08-25')
    expect(dia(dias, '2026-08-25').sesionId).toBe('s1')
    expect(dia(dias, '2026-08-26').sesionId).toBe('s2')
    expect(dia(dias, '2026-08-28').sesionId).toBe('s3')
    expect(dia(dias, '2026-08-29').sesionId).toBe('s4')
  })

  it('un microciclo VENCIDO sigue repartiendo — esa mitad NO se toca aquí', () => {
    // Empezó el 17 y duraba 8 días: su último día fue el 24. Hoy es el 25.
    // Se deja a propósito: taparlo dejaría sin semana a quien ya está entrenando,
    // y es una decisión con otro riesgo. Este test fija la conducta que se conserva.
    const dias = armarSemana(micro('2026-08-17'), '2026-08-25')
    expect(dias.some((d) => d.sesionId !== undefined)).toBe(true)
  })

  it('una sesión SIN día en el nombre tampoco se cuela fuera del rango', () => {
    const sinDia: Microciclo = {
      ...micro('2026-08-25'),
      sesiones: [s('x1', 'LEG A', 1), s('x2', 'PUSH', 2)],
    }
    const dias = armarSemana(sinDia, '2026-08-24')
    expect(dia(dias, '2026-08-24').sesionId).toBeUndefined()
    // Y no se gastan en el día de fuera: siguen disponibles dentro del rango.
    expect(dia(dias, '2026-08-25').sesionId).toBe('x1')
    expect(dia(dias, '2026-08-26').sesionId).toBe('x2')
  })

  it('sin `fechaInicio` NO se acota: mejor la conducta de antes que una semana en blanco', () => {
    const roto = { ...micro('2026-08-25'), fechaInicio: '' } as Microciclo
    const dias = armarSemana(roto, '2026-08-24')
    expect(dias.some((d) => d.sesionId !== undefined)).toBe(true)
  })
})
