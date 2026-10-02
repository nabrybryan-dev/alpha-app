import { describe, expect, it } from 'vitest'
import { diaDeSesion } from './calendario'
import { armarSemana } from './rutaEntrenamiento'
import type { Microciclo, Sesion } from './types'

/**
 * `sesion.fecha` ES LA FECHA DE EJECUCIÓN, NUNCA LA DE PROGRAMACIÓN.
 *
 * `fecha` la escribe la app, una sola vez, con la primera acción de la persona
 * dentro de la sesión (ver el comentario del campo en `domain/types.ts`). El
 * DÍA que la sesión ocupa en el calendario lo decide `diaDeSesion` —el campo
 * `dia` o, si falta, el nombre— y eso no lee `fecha` en ningún punto del
 * código. Este test lo deja escrito: si alguien anota una serie el jueves de
 * una sesión de "LUNES", la sesión SIGUE cayendo en lunes.
 */

const s = (id: string, nombre: string, orden: number, fecha?: string): Sesion => ({
  id,
  nombre,
  orden,
  fecha,
  ejercicios: [],
})

function micro(sesiones: Sesion[]): Microciclo {
  return {
    id: 'm-1',
    usuarioId: 'u-1',
    numero: 1,
    cadenciaDias: 7,
    estado: 'activo',
    fechaInicio: '2026-09-07', // lunes
    sesiones,
  }
}

describe('diaDeSesion — no mira `fecha`', () => {
  it('el día programado sale del nombre/`dia`, con o sin `fecha` de ejecución', () => {
    const sinTocar = s('s1', 'FULL A (LUNES)', 1)
    const yaEjecutada = s('s2', 'FULL B (MIÉRCOLES)', 2, '2026-09-10') // ejecutada un jueves
    expect(diaDeSesion(sinTocar)).toBe('LUNES')
    expect(diaDeSesion(yaEjecutada)).toBe('MIÉRCOLES')
  })
})

describe('armarSemana — una `fecha` de ejecución en otro día no mueve la sesión de sitio', () => {
  it('la sesión de MIÉRCOLES sigue en miércoles aunque se ejecutara el jueves', () => {
    // "FULL B (MIÉRCOLES)" se marcó el jueves 2026-09-10 (un día después de su
    // día programado, el miércoles 2026-09-09). Si `armarSemana` leyera
    // `fecha` para programar, la sesión saltaría al jueves; no lo hace.
    const m = micro([
      s('s1', 'FULL A (LUNES)', 1),
      s('s2', 'FULL B (MIÉRCOLES)', 2, '2026-09-10'),
      s('s3', 'FULL C (VIERNES)', 3),
    ])
    const dias = armarSemana(m, '2026-09-08')
    const miercoles = dias.find((d) => d.fechaIso === '2026-09-09')
    const jueves = dias.find((d) => d.fechaIso === '2026-09-10')

    expect(miercoles?.sesionId).toBe('s2')
    expect(jueves?.sesionId).toBeUndefined()
    expect(jueves?.estado).toBe('descanso')
  })

  it('lo mismo si la sesión se ejecutó ANTES de su día programado', () => {
    const m = micro([
      s('s1', 'FULL A (LUNES)', 1),
      s('s2', 'FULL B (VIERNES)', 2, '2026-09-08'), // "ejecutada" el martes
    ])
    const dias = armarSemana(m, '2026-09-08')
    const martes = dias.find((d) => d.fechaIso === '2026-09-08')
    const viernes = dias.find((d) => d.fechaIso === '2026-09-11')

    expect(martes?.sesionId).toBeUndefined()
    expect(viernes?.sesionId).toBe('s2')
  })
})
