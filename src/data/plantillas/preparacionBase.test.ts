import { describe, expect, it } from 'vitest'
import { patronDeSesion, plantillaPreparacion, preparacionDe } from './preparacionBase'
import type { Sesion } from '../../domain/types'

const sesion = (nombre: string, extra: Partial<Sesion> = {}): Sesion => ({
  id: 's1',
  nombre,
  orden: 1,
  ejercicios: [],
  ...extra,
})

describe('patronDeSesion', () => {
  it('detecta el patrón por el nombre', () => {
    expect(patronDeSesion('UPPER A')).toBe('torso')
    expect(patronDeSesion('LEG B')).toBe('pierna')
    expect(patronDeSesion('FULL C')).toBe('fullbody')
    expect(patronDeSesion('METABÓLICO A')).toBe('general')
  })
})

describe('plantillaPreparacion', () => {
  it('siempre trae cardio + movilidad específica del patrón', () => {
    for (const patron of ['torso', 'pierna', 'fullbody', 'general'] as const) {
      const partes = plantillaPreparacion(patron)
      expect(partes.some((p) => p.tipo === 'calentamiento')).toBe(true)
      expect(partes.some((p) => p.tipo === 'movilidad')).toBe(true)
    }
  })

  it('devuelve copias (no referencias compartidas)', () => {
    const a = plantillaPreparacion('torso')
    const b = plantillaPreparacion('torso')
    expect(a[0]).not.toBe(b[0])
  })
})

describe('preparacionDe', () => {
  it('usa la preparación propia si la sesión la trae', () => {
    const propia = [{ id: 'x', tipo: 'movilidad' as const, titulo: 'Cadera', indicaciones: '90/90' }]
    expect(preparacionDe(sesion('LEG A', { preparacion: propia }))).toBe(propia)
  })

  it('cae a la plantilla del patrón si no', () => {
    const partes = preparacionDe(sesion('LEG A'))
    expect(partes.length).toBeGreaterThan(1)
    expect(partes.every((p) => p.id.startsWith('prep-base-'))).toBe(true)
  })
})
