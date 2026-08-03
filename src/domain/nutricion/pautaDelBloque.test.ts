import { describe, expect, it } from 'vitest'
import {
  faseDeEtiqueta,
  pasosObjetivoDe,
  pautaDelBloque,
  PISO_PASOS,
  TOPE_PASOS,
} from './pautaDelBloque'
import type { Perfil } from '../types'

const PERFIL_VACIO: Perfil = {
  usuarioId: 'u1',
  objetivos: '',
  edad: 30,
  diasEntrenamiento: 4,
  tiempoSesionMin: 60,
  somatotipo: '',
  volumenSemanal: {},
  medidas: [],
}

const RESPUESTAS = {
  pesoKg: 70,
  alturaCm: 170,
  cinturaCm: 80,
  cuelloCm: 35,
  caderaCm: 95,
  genero: 'M',
  fechaNacimiento: '1994-01-01',
  diasEntreno: 4,
  pasosDiarios: 6000,
}

describe('pasosObjetivoDe', () => {
  it('nunca baja del piso, porque por debajo el motor ya trata a la persona como sedentaria', () => {
    expect(pasosObjetivoDe(2000, 'mantenimiento') ?? 0).toBeGreaterThanOrEqual(PISO_PASOS - 4000)
    expect(pasosObjetivoDe(8000, 'mantenimiento')).toBe(PISO_PASOS)
  })

  it('pide más gasto en déficit que en superávit', () => {
    expect(pasosObjetivoDe(9000, 'deficit') ?? 0).toBeGreaterThan(pasosObjetivoDe(9000, 'superavit') ?? 0)
  })

  it('no manda a nadie por encima del tope', () => {
    expect(pasosObjetivoDe(20000, 'deficit-agresivo') ?? 0).toBeLessThanOrEqual(TOPE_PASOS)
  })

  it('rampa: a quien está lejos no se le triplica el objetivo de golpe', () => {
    // Alejandra declara 3.000 y su banda pide 8.000. El salto se reparte.
    const paso1 = pasosObjetivoDe(3000, 'mantenimiento') ?? 0
    expect(paso1).toBeGreaterThan(3000)
    expect(paso1).toBeLessThan(8000)
    // Y desde ahí sigue subiendo hasta alcanzar la banda.
    expect(pasosObjetivoDe(paso1, 'mantenimiento') ?? 0).toBeGreaterThan(paso1)
  })

  it('en reingreso o patología la banda es más baja', () => {
    expect(pasosObjetivoDe(9000, 'reingreso') ?? 0).toBeLessThan(pasosObjetivoDe(9000, 'deficit') ?? 0)
  })

  it('sin dato de pasos no inventa un objetivo', () => {
    expect(pasosObjetivoDe(null, 'deficit')).toBeUndefined()
  })
})

describe('pautaDelBloque', () => {
  it('lo que cargó el coach manda siempre sobre lo calculado', () => {
    const perfil = { ...PERFIL_VACIO, proteinaGkg: 2.4, pasosObjetivo: 11000, faseEnergetica: 'Déficit 10%' }
    const p = pautaDelBloque(perfil, RESPUESTAS, 'deficit', '2026-08-03')
    expect(p.proteinaGkg).toEqual({ valor: 2.4, origen: 'coach' })
    expect(p.pasosObjetivo).toEqual({ valor: 11000, origen: 'coach' })
    expect(p.faseEnergetica).toEqual({ valor: 'Déficit 10%', origen: 'coach' })
  })

  it('sin prescripción del coach, calcula desde la encuesta y lo marca como estimado', () => {
    const p = pautaDelBloque(PERFIL_VACIO, RESPUESTAS, 'deficit', '2026-08-03')
    expect(p.proteinaGkg?.origen).toBe('calculado')
    expect(p.proteinaGkg?.valor ?? 0).toBeGreaterThan(1.5)
    expect(p.proteinaGkg?.valor ?? 0).toBeLessThan(3)
    expect(p.pasosObjetivo?.origen).toBe('calculado')
  })

  it('la fase nunca se inventa: si el coach no la puso, no se muestra', () => {
    const p = pautaDelBloque(PERFIL_VACIO, RESPUESTAS, 'deficit', '2026-08-03')
    expect(p.faseEnergetica).toBeUndefined()
  })

  it('sin encuesta no hay nada que calcular: devuelve vacío en vez de un número inventado', () => {
    const p = pautaDelBloque(PERFIL_VACIO, undefined, 'deficit', '2026-08-03')
    expect(p.proteinaGkg).toBeUndefined()
    expect(p.pasosObjetivo).toBeUndefined()
  })

  it('la encuesta a medias solo rellena lo que puede', () => {
    const p = pautaDelBloque(PERFIL_VACIO, { pasosDiarios: 5000 }, 'mantenimiento', '2026-08-03')
    expect(p.pasosObjetivo?.origen).toBe('calculado')
    expect(p.proteinaGkg).toBeUndefined()
  })
})

describe('faseDeEtiqueta', () => {
  it('lee la fase de la etiqueta que escribió el coach', () => {
    expect(faseDeEtiqueta('Déficit agresivo')).toBe('deficit-agresivo')
    expect(faseDeEtiqueta('Déficit ondulado 10-20%')).toBe('deficit')
    expect(faseDeEtiqueta('Recomposición')).toBe('recomposicion')
    expect(faseDeEtiqueta('Ganancia')).toBe('superavit')
    expect(faseDeEtiqueta('Mantenimiento')).toBe('mantenimiento')
    expect(faseDeEtiqueta('Reingreso · mantenimiento')).toBe('reingreso')
  })

  it('quien está en mantenimiento buscando déficit por NEAT necesita la banda de déficit', () => {
    // Si se leyera solo "mantenimiento" se le pedirían 8.000 pasos, que es
    // justo lo contrario de lo que persigue.
    expect(faseDeEtiqueta('Mantenimiento → déficit por NEAT')).toBe('deficit')
  })

  it('sin etiqueta no adivina: cae en mantenimiento, la banda más conservadora', () => {
    expect(faseDeEtiqueta(undefined)).toBe('mantenimiento')
    expect(faseDeEtiqueta('cualquier cosa')).toBe('mantenimiento')
  })
})
