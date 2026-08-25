import { describe, expect, it } from 'vitest'
import type { Microciclo, PlanNutricional, Sesion } from '../../domain/types'
import { sanearMicrociclo, sanearPlan, sanearSesion } from './saneado'

/**
 * Documenta el fallo del 2026-08-25: en la app de dos asesorados no se veía
 * NINGUNA sección. La causa no era el contenido: era que `hidratar` casteaba el
 * blob de `datos` sin comprobarlo, y una fila a la que le faltaba un array hacía
 * que la pantalla leyera `.length` de `undefined` y se cayera entera al
 * ErrorBoundary.
 *
 * Los objetos de aquí llegan a propósito con campos que el tipo promete y la
 * fila real no traía — por eso los `as`.
 */
describe('sanearSesion', () => {
  it('una sesión sin ejercicios se puede pintar: es cardio, no es un error', () => {
    const cruda = { id: 's5', nombre: 'ZONA 2', orden: 5 } as unknown as Sesion
    expect(sanearSesion(cruda).ejercicios).toEqual([])
  })

  it('`ejercicios: null` deja de tumbar la pantalla — es lo que devuelve jsonb_agg de cero filas', () => {
    const cruda = { id: 's5', nombre: 'ZONA 2', orden: 5, ejercicios: null } as unknown as Sesion
    expect(sanearSesion(cruda).ejercicios).toEqual([])
  })

  it('no toca lo que sí vino', () => {
    const ej = { id: 'e1', nombre: 'Prensa' }
    const cruda = { id: 's1', nombre: 'PIERNA', orden: 1, ejercicios: [ej] } as unknown as Sesion
    expect(sanearSesion(cruda).ejercicios).toEqual([ej])
  })

  it('normaliza preparación y bloques SOLO si vinieron mal, y no los inventa', () => {
    const sinNada = { id: 's1', nombre: 'X', orden: 1, ejercicios: [] } as unknown as Sesion
    const limpia = sanearSesion(sinNada)
    expect(limpia.preparacion).toBeUndefined()
    expect(limpia.bloquesCardio).toBeUndefined()

    const conNulos = {
      id: 's2', nombre: 'X', orden: 2, ejercicios: [], preparacion: null, bloquesCardio: null,
    } as unknown as Sesion
    const otra = sanearSesion(conNulos)
    expect(otra.preparacion).toEqual([])
    expect(otra.bloquesCardio).toEqual([])
  })
})

describe('sanearMicrociclo', () => {
  it('un microciclo sin sesiones no tumba la pantalla de entrenar', () => {
    const crudo = { id: 'm1', usuarioId: 'u1', numero: 1 } as unknown as Microciclo
    expect(sanearMicrociclo(crudo).sesiones).toEqual([])
  })

  it('sanea cada sesión de dentro', () => {
    const crudo = {
      id: 'm1', usuarioId: 'u1', numero: 1,
      sesiones: [{ id: 's5', nombre: 'ZONA 2', orden: 5 }],
    } as unknown as Microciclo
    expect(sanearMicrociclo(crudo).sesiones[0].ejercicios).toEqual([])
  })
})

describe('sanearPlan', () => {
  it('un plan al que le falta un array ya no borra TODAS las secciones', () => {
    // `MiPlan` calcula la lista de secciones con `plan.suplementacion.length`.
    // Sin este saneado, ese acceso lanza antes de pintar nada.
    const crudo = { id: 'p1', usuarioId: 'u1' } as unknown as PlanNutricional
    const limpio = sanearPlan(crudo)
    expect(limpio.suplementacion).toEqual([])
    expect(limpio.seccionesEspeciales).toEqual([])
    expect(limpio.menus).toEqual([])
    expect(limpio.equivalencias).toEqual([])
    expect(limpio.listaCompras).toEqual([])
  })

  it('no pisa lo que sí trae', () => {
    const crudo = {
      id: 'p1', usuarioId: 'u1', suplementacion: ['Creatina 5 g'],
    } as unknown as PlanNutricional
    expect(sanearPlan(crudo).suplementacion).toEqual(['Creatina 5 g'])
  })
})
