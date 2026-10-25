import { describe, expect, it } from 'vitest'
import type { Capacidad } from '../data/consola/capacidadesStaff'
import {
  puedeVerAdministracion,
  puedeVerConsola,
  puedeVerCreadores,
  puedeVerEstrategias,
  type PuestoDePanel,
} from './accesoPanel'

/**
 * La tabla de puertas que comparten `CoachLayout` y `EmpresaPage` (revisión ciega del 25-oct).
 * Si una cambia aquí, cambia en las dos: así no se puede ofrecer un enlace que la pantalla
 * devuelve. Los casos son los mismos que ya se probaban en `CoachLayout.acceso.test.tsx`.
 */

function puesto(
  esCoach: boolean,
  capacidades: Capacidad[] = [],
  cargando = false,
): PuestoDePanel {
  const set = new Set(capacidades)
  return { esCoach, cargando, tiene: (c) => set.has(c) }
}

describe('las puertas del panel', () => {
  it('la consola: el coach o el staff con leer_entrenamiento', () => {
    expect(puedeVerConsola(puesto(true))).toBe(true)
    expect(puedeVerConsola(puesto(false, ['leer_entrenamiento']))).toBe(true)
    expect(puedeVerConsola(puesto(false, ['aprobar_primer_plan']))).toBe(false)
    expect(puedeVerConsola(puesto(false, ['leer_entrenamiento'], true))).toBe(false)
  })

  it('Estrategias: el coach siempre; el resto, mercadeo o creadores (NO decisiones_compartidas)', () => {
    expect(puedeVerEstrategias(puesto(true))).toBe(true)
    expect(puedeVerEstrategias(puesto(false, ['responder_mercadeo']))).toBe(true)
    expect(puedeVerEstrategias(puesto(false, ['revisar_creadores']))).toBe(true)
    expect(puedeVerEstrategias(puesto(false, ['decisiones_compartidas', 'ver_administracion']))).toBe(false)
  })

  it('Administración: al coach se le pide ver_administracion; al resto, plan, decisiones o admin', () => {
    expect(puedeVerAdministracion(puesto(true))).toBe(false)
    expect(puedeVerAdministracion(puesto(true, ['ver_administracion']))).toBe(true)
    expect(puedeVerAdministracion(puesto(false, ['organizar_plan']))).toBe(true)
    expect(puedeVerAdministracion(puesto(false, ['decisiones_compartidas']))).toBe(true)
    expect(puedeVerAdministracion(puesto(false, ['ver_administracion']))).toBe(true)
    expect(puedeVerAdministracion(puesto(false, ['responder_mercadeo']))).toBe(false)
    expect(puedeVerAdministracion(puesto(false, ['ver_administracion'], true))).toBe(false)
  })

  it('Creadores: el coach o revisar_creadores', () => {
    expect(puedeVerCreadores(puesto(true))).toBe(true)
    expect(puedeVerCreadores(puesto(false, ['revisar_creadores']))).toBe(true)
    expect(puedeVerCreadores(puesto(false, ['leer_entrenamiento']))).toBe(false)
    expect(puedeVerCreadores(puesto(false, ['revisar_creadores'], true))).toBe(false)
  })
})
