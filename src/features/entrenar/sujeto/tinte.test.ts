import { describe, expect, it } from 'vitest'
import { ORDEN_GRUPOS } from '../../../domain/taxonomia'
import type { EjercicioPrescrito, Sesion } from '../../../domain/types'
import {
  GRUPO_A_REGIONES,
  DOLOR_MINIMO,
  intensidadDeRegion,
  lecturaCorta,
  regionesConDolor,
  seriesPorRegion,
  tinteDelCuerpo,
} from './tinte'

function ejercicio(categoria: string, nombre: string, hechas: number): EjercicioPrescrito {
  return {
    id: `${nombre}-${hechas}`,
    categoria,
    nombre,
    series: Array.from({ length: hechas }, (_, i) => ({ orden: i + 1, cargaKg: 20 })),
  } as unknown as EjercicioPrescrito
}
const sesion = (...e: EjercicioPrescrito[]) => ({ id: 's', ejercicios: e }) as unknown as Sesion

describe('de las series anotadas a las regiones (principal 1, secundaria 1/2)', () => {
  it('cada grupo de la taxonomia llega a alguna region', () => {
    for (const g of ORDEN_GRUPOS) expect(GRUPO_A_REGIONES[g].length, g).toBeGreaterThan(0)
  })

  it('un remo: la espalda cuenta entera y el biceps la mitad', () => {
    const s = seriesPorRegion([sesion(ejercicio('TRACCIÓN HORIZONTAL', 'Remo con barra', 4))])
    expect(s.dors).toBe(4)
    expect(s.bic).toBe(2)
  })

  it('solo cuentan las series anotadas: un ejercicio sin series no tine nada', () => {
    expect(seriesPorRegion([sesion(ejercicio('TRACCIÓN HORIZONTAL', 'Remo', 0))])).toEqual({})
  })

  it('suma entre ejercicios y sesiones', () => {
    const a = sesion(ejercicio('TRACCIÓN HORIZONTAL', 'Remo', 3))
    const b = sesion(ejercicio('TRACCIÓN VERTICAL', 'Dominada', 2))
    expect(seriesPorRegion([a, b]).dors).toBe(5)
  })
})

describe('intensidad k = 0,3 + 0,7 · series / max', () => {
  it('sin series no hay tinte', () => expect(intensidadDeRegion(0, 5)).toBe(0))
  it('la mayor vale 1', () => expect(intensidadDeRegion(5, 5)).toBeCloseTo(1))
  it('una serie de cinco vale 0,44', () => expect(intensidadDeRegion(1, 5)).toBeCloseTo(0.3 + 0.7 / 5))
  it('sin maximo no divide por cero', () => expect(intensidadDeRegion(2, 0)).toBe(0))
})

describe('el dolor del check-in', () => {
  it('umbral 4 de 10 y la region sale de lo que la persona escribio', () => {
    expect(DOLOR_MINIMO).toBe(4)
    expect(regionesConDolor({ dolor: 6, dolorDonde: 'me duele el hombro derecho' })).toEqual(['delt'])
    expect(regionesConDolor({ dolor: 3, dolorDonde: 'hombro' })).toEqual([])
    expect(regionesConDolor({ dolor: 7, dolorDonde: 'espalda baja' })).toEqual(['lumb'])
  })
  it('lo que no se entiende no se inventa', () => {
    expect(regionesConDolor({ dolor: 8, dolorDonde: 'todo raro' })).toEqual([])
    expect(regionesConDolor({ dolor: 8 })).toEqual([])
    expect(regionesConDolor(undefined)).toEqual([])
  })
  it('el dolor pinta su region en rojo aparte del tinte', () => {
    const t = tinteDelCuerpo({ dors: 4, delt: 1 }, ['delt'])
    expect(t.delt).toEqual({ k: expect.any(Number), dolor: true })
    expect(t.dors.dolor).toBe(false)
    expect(t.dors.k).toBeCloseTo(1)
    expect(t.pecho).toEqual({ k: 0, dolor: false })
  })
})

describe('la lectura corta', () => {
  it('nombra las tres mayores, de mayor a menor', () => {
    expect(lecturaCorta({ dors: 2, bic: 1, trap: 1, delt: 0.5 })).toBe('Dorsal 2 · Bíceps 1 · Trapecio 1')
  })
  it('con medias series usa coma', () => {
    expect(lecturaCorta({ bic: 1.5 })).toBe('Bíceps 1,5')
  })
  it('vacia si no hay series', () => expect(lecturaCorta({})).toBe(''))
})
