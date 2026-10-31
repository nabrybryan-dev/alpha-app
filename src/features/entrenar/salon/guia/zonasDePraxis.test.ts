import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { EjercicioPrescrito, Sesion } from '../../../../domain/types'
import { REGIONES } from '../../sujeto/regiones'
import {
  ENFOQUE_DE_REGION,
  FICHA_DE_REGION,
  lineaDePraxis,
  ordenDeZonas,
  tinteEnfocado,
  trabajoDeRegion,
} from './zonasDePraxis'
import { tinteDelCuerpo } from '../../sujeto/tinte'

function ejercicio(sobre: Partial<EjercicioPrescrito>): EjercicioPrescrito {
  return {
    id: 'e',
    nombre: 'Remo con barra',
    categoria: 'Espalda',
    sets: 3,
    repsDiana: 10,
    descansoMin: 2,
    rirObjetivo: 2,
    series: [],
    ...sobre,
  } as EjercicioPrescrito
}

const sesion = (ejercicios: EjercicioPrescrito[]) => ({ ejercicios }) as unknown as Sesion

describe('las fichas de las zonas', () => {
  it('las 15 regiones traen partes, qué hace y cómo se enfoca: ninguna queda muda', () => {
    for (const { id } of REGIONES) {
      expect(FICHA_DE_REGION[id].partes.length, id).toBeGreaterThan(5)
      expect(FICHA_DE_REGION[id].queHace.length, id).toBeGreaterThan(10)
      expect(ENFOQUE_DE_REGION[id].distancia, id).toBeLessThan(5.1)
    }
  })

  it('no dan cifras: ni porcentajes ni números de activación', () => {
    for (const { id } of REGIONES) {
      expect(`${FICHA_DE_REGION[id].partes} ${FICHA_DE_REGION[id].queHace}`, id).not.toMatch(/\d|%/)
    }
  })

  it('cada zona se mira por la cara en que se entrena: el glúteo de espalda, el pectoral de frente', () => {
    expect(ENFOQUE_DE_REGION.glu.azimut).toBe(180)
    expect(ENFOQUE_DE_REGION.pecho.azimut).toBe(0)
  })
})

describe('qué ejercicios trabajan una zona', () => {
  it('distingue principal y apoyo, y cuenta lo mismo que el mapa de series', () => {
    const remo = ejercicio({ series: [{}, {}] as EjercicioPrescrito['series'] })
    const [enDorsal] = trabajoDeRegion('dors', sesion([remo]))
    expect(enDorsal).toMatchObject({ indice: 0, papel: 'principal', cuentaPorSerie: 1, anotadas: 2, pautadas: 3 })
    const [enTrapecio] = trabajoDeRegion('trap', sesion([remo]))
    expect(enTrapecio.papel).toBe('apoyo')
    expect(enTrapecio.cuentaPorSerie).toBe(0.5)
  })

  it('una zona que hoy no se trabaja da una lista vacía, sin inventar', () => {
    expect(trabajoDeRegion('gem', sesion([ejercicio({})]))).toEqual([])
    expect(trabajoDeRegion('gem', undefined)).toEqual([])
  })
})

describe('el orden al deslizar', () => {
  it('primero las zonas de hoy, después el resto, y están las 15 sin repetirse', () => {
    const orden = ordenDeZonas(sesion([ejercicio({})]))
    expect(orden.slice(0, 1)).toEqual(['dors'])
    expect(new Set(orden).size).toBe(15)
  })
})

describe('la línea de Praxis', () => {
  it('nombra lo que falta por trabajar', () => {
    expect(lineaDePraxis(['dors'], {})).toBe('Hoy te falta: Dorsal')
    expect(lineaDePraxis(['dors', 'bic'], {})).toBe('Hoy te falta: Dorsal y Bíceps')
    expect(lineaDePraxis(['dors', 'bic', 'cua', 'glu'], {})).toBe('Hoy te falta: Dorsal, Bíceps y 2 más')
  })

  it('con todo hecho dice lo trabajado, y sin nada invita a tocar', () => {
    expect(lineaDePraxis([], { dors: 3 })).toBe('Hoy trabajaste: Dorsal 3')
    expect(lineaDePraxis([], {})).toBe('Toca un músculo para saber qué hace')
  })
})

describe('la zona enfocada se enciende sola', () => {
  it('apaga las demás, conserva el dolor y no toca el tinte original', () => {
    const tinte = tinteDelCuerpo({ dors: 3, bic: 1 }, ['delt'], ['cua'])
    const enfocado = tinteEnfocado(tinte, 'glu')
    expect(enfocado.glu).toEqual({ k: 1, dolor: false })
    expect(enfocado.dors).toEqual({ k: 0, dolor: false })
    expect(enfocado.cua).toEqual({ k: 0, dolor: false })
    expect(enfocado.delt.dolor).toBe(true)
    expect(tinte.dors.k).toBe(1)
  })
})

describe('la guía no gasta la clave', () => {
  it('sus archivos no llaman a la red, ni a un modelo, ni a la charla de Praxis', () => {
    for (const archivo of ['zonasDePraxis.ts', 'GuiaDePraxis.tsx', 'useZonaDePraxis.ts']) {
      const fuente = readFileSync(resolve(__dirname, archivo), 'utf8')
      expect(fuente, archivo).not.toMatch(/\bfetch\(|anthropic|XMLHttpRequest|supabase|data\/praxis|features\/praxis|<textarea|<input/i)
    }
  })
})
