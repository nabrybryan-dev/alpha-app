import { describe, expect, it } from 'vitest'
import type { EjercicioPrescrito, Microciclo, Sesion } from '../types'
import { compararMicrociclos } from './diffMicrociclo'

function ejercicio(nombre: string, cargaKg: number | undefined): EjercicioPrescrito {
  return {
    id: `e-${nombre}`,
    categoria: 'fuerza',
    nombre,
    cues: '',
    prescripcion: `${nombre} 3x8`,
    cargaKg,
    descansoMin: 2,
    sets: 3,
    rango: '6-8',
    repsDiana: 8,
    rirObjetivo: 2,
    series: [],
  }
}

function sesion(id: string, nombre: string, dia: Sesion['dia'], ejercicios: EjercicioPrescrito[]): Sesion {
  return { id, nombre, orden: 1, dia, ejercicios }
}

function microciclo(numero: number, sesiones: Sesion[]): Microciclo {
  return {
    id: `m-${numero}`,
    usuarioId: 'u-1',
    numero,
    cadenciaDias: 8,
    estado: numero === 2 ? 'activo' : 'cerrado',
    fechaInicio: '2026-09-21',
    sesiones,
  }
}

describe('compararMicrociclos', () => {
  it('marca una sesión perdida, una añadida y una carga que baja', () => {
    const anterior = microciclo(1, [
      sesion('s1', 'Torso A', 'MARTES', [ejercicio('Press banca', 60)]),
      sesion('s2', 'Pierna A', 'JUEVES', [ejercicio('Sentadilla', 100)]),
    ])
    const actual = microciclo(2, [
      sesion('s3', 'Torso A', 'MARTES', [ejercicio('Press banca', 55)]),
      sesion('s4', 'Full body', 'VIERNES', [ejercicio('Peso muerto', 120)]),
    ])

    const diff = compararMicrociclos(anterior, actual)

    // Una sesión perdida: JUEVES tenía sesión y ya no.
    const jueves = diff.dias.find((d) => d.dia === 'JUEVES')
    expect(jueves?.estado).toBe('perdida')
    expect(jueves?.antes?.nombre).toBe('Pierna A')
    expect(jueves?.despues).toBeUndefined()

    // Una sesión añadida: VIERNES no existía antes.
    const viernes = diff.dias.find((d) => d.dia === 'VIERNES')
    expect(viernes?.estado).toBe('nueva')
    expect(viernes?.despues?.nombre).toBe('Full body')

    // MARTES sigue existiendo en los dos: "igual" en el día, aunque cambie la carga dentro.
    const martes = diff.dias.find((d) => d.dia === 'MARTES')
    expect(martes?.estado).toBe('igual')

    // Una carga que baja: Press banca 60 -> 55.
    expect(diff.cargas).toEqual([
      { nombre: 'Press banca', cargaAntesKg: 60, cargaDespuesKg: 55, direccion: 'baja' },
    ])

    // El ejercicio de la sesión añadida entra como añadido; el de la perdida, como retirado.
    expect(diff.ejerciciosAnadidos).toContain('Peso muerto')
    expect(diff.ejerciciosRetirados).toContain('Sentadilla')
  })

  it('detecta una carga que sube', () => {
    const anterior = microciclo(1, [sesion('s1', 'Torso A', 'LUNES', [ejercicio('Remo', 40)])])
    const actual = microciclo(2, [sesion('s2', 'Torso A', 'LUNES', [ejercicio('Remo', 45)])])

    const diff = compararMicrociclos(anterior, actual)
    expect(diff.cargas).toEqual([
      { nombre: 'Remo', cargaAntesKg: 40, cargaDespuesKg: 45, direccion: 'sube' },
    ])
  })

  it('sin microciclo anterior, todo sale como "nueva" y no revienta', () => {
    const actual = microciclo(1, [sesion('s1', 'Torso A', 'LUNES', [ejercicio('Remo', 40)])])
    const diff = compararMicrociclos(undefined, actual)
    expect(diff.dias.find((d) => d.dia === 'LUNES')?.estado).toBe('nueva')
    expect(diff.cargas).toEqual([])
    expect(diff.ejerciciosRetirados).toEqual([])
  })

  it('sin ninguno de los dos, los siete días quedan "vacio"', () => {
    const diff = compararMicrociclos(undefined, undefined)
    expect(diff.dias).toHaveLength(7)
    expect(diff.dias.every((d) => d.estado === 'vacio')).toBe(true)
  })

  it('no compara carga si a alguno de los dos le falta el dato (no inventa una dirección)', () => {
    const anterior = microciclo(1, [sesion('s1', 'Torso A', 'LUNES', [ejercicio('Curl', undefined)])])
    const actual = microciclo(2, [sesion('s2', 'Torso A', 'LUNES', [ejercicio('Curl', 20)])])
    const diff = compararMicrociclos(anterior, actual)
    expect(diff.cargas).toEqual([])
  })

  it('reconoce el día con tilde o escrito en el nombre, no solo `dia` sin tilde', () => {
    // Regresión del 26-sep: `dia: 'MIÉRCOLES'` (la forma del resto del dominio) no casaba
    // con 'MIERCOLES' y la revisión pintaba ese día vacío.
    const actual = microciclo(2, [
      sesion('s1', 'Pierna', 'MIÉRCOLES' as Sesion['dia'], []),
      sesion('s2', 'Torso (VIERNES)', undefined, []),
    ])
    const diff = compararMicrociclos(undefined, actual)
    expect(diff.dias.find((d) => d.dia === 'MIERCOLES')?.despues?.nombre).toBe('Pierna')
    expect(diff.dias.find((d) => d.dia === 'VIERNES')?.despues?.nombre).toBe('Torso (VIERNES)')
  })

  it('sin día (D1…Dn), compara las cargas por orden en vez de callarlas', () => {
    const anterior = microciclo(1, [{ ...sesion('a1', 'D1', undefined, [ejercicio('Sentadilla', 80)]), orden: 1 }])
    const actual = microciclo(2, [{ ...sesion('b1', 'D1', undefined, [ejercicio('Sentadilla', 85)]), orden: 1 }])
    const diff = compararMicrociclos(anterior, actual)
    expect(diff.cargas).toEqual([{ nombre: 'Sentadilla', cargaAntesKg: 80, cargaDespuesKg: 85, direccion: 'sube' }])
  })
})
