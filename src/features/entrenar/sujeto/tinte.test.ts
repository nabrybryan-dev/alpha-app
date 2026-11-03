import { describe, expect, it } from 'vitest'
import { ORDEN_GRUPOS } from '../../../domain/taxonomia'
import type { EjercicioPrescrito, Sesion } from '../../../domain/types'
import {
  GRUPO_A_REGIONES,
  DOLOR_MINIMO,
  intensidadDeRegion,
  lecturaCorta,
  regionesConDolor,
  regionesDirectas,
  regionesPorTrabajar,
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
  it('«biceps femoral» es de la pierna (isquios) y no pinta el biceps del brazo', () => {
    expect(regionesConDolor({ dolor: 6, dolorDonde: 'me duele el bíceps femoral' })).toEqual(['isq'])
    expect(regionesConDolor({ dolor: 6, dolorDonde: 'bíceps' })).toEqual(['bic'])
    expect(regionesConDolor({ dolor: 6, dolorDonde: 'codo' })).toEqual(['bic'])
  })
  it('«la espalda» sin decir donde pinta la espalda alta y la baja; si lo dice, solo la que dice', () => {
    expect(regionesConDolor({ dolor: 6, dolorDonde: 'me duele la espalda' })).toEqual(['dors', 'lumb'])
    expect(regionesConDolor({ dolor: 6, dolorDonde: 'espalda alta' })).toEqual(['dors'])
    expect(regionesConDolor({ dolor: 6, dolorDonde: 'Espalda baja' })).toEqual(['lumb'])
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

/**
 * LO QUE LA SESIÓN DEJA POR TRABAJAR (Bryan, 25-oct): en rojo liso las regiones directas de
 * los ejercicios sin terminar; al terminarlos, pasan a «trabajado».
 */
describe('regiones por trabajar', () => {
  const conSets = (e: EjercicioPrescrito, sets: number) => ({ ...e, sets }) as EjercicioPrescrito

  it('un remo trabaja de forma directa el dorsal; el bíceps y el trapecio no se encienden', () => {
    expect(regionesDirectas({ categoria: 'TRACCIÓN HORIZONTAL', nombre: 'Remo con barra' })).toEqual(['dors'])
  })

  it('un ejercicio terminado ya no deja nada por trabajar', () => {
    const remo = conSets(ejercicio('TRACCIÓN HORIZONTAL', 'Remo con barra', 3), 3)
    expect(regionesPorTrabajar(sesion(remo))).toEqual([])
    const aMedias = conSets(ejercicio('TRACCIÓN HORIZONTAL', 'Remo con barra', 1), 3)
    expect(regionesPorTrabajar(sesion(aMedias))).toEqual(['dors'])
  })

  it('una región que trabajan dos ejercicios sigue pendiente hasta terminar los dos', () => {
    const remo = conSets(ejercicio('TRACCIÓN HORIZONTAL', 'Remo con barra', 3), 3)
    const otro = conSets(ejercicio('TRACCIÓN HORIZONTAL', 'Remo con mancuerna', 0), 3)
    expect(regionesPorTrabajar(sesion(remo, otro))).toEqual(['dors'])
  })

  it('sin sesión no hay nada por trabajar', () => {
    expect(regionesPorTrabajar(undefined)).toEqual([])
  })

  it('el tinte marca lo pendiente y, solo cuando deja de estarlo, cuándo se cerró', () => {
    const t = tinteDelCuerpo({}, [], ['dors'], { dors: 1000, pecho: 2000 })
    expect(t.dors.pendiente).toBe(true)
    expect(t.dors.trabajadaEn).toBeUndefined()
    expect(t.pecho.trabajadaEn).toBe(2000)
    expect(t.cua.pendiente).toBeUndefined()
  })
})
