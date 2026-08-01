import { describe, expect, it } from 'vitest'
import { buscar, puntuar, sinTildes, type AlimentoIndice } from './busqueda'

const alimento = (
  id: string,
  nombre: string,
  extra: Partial<AlimentoIndice> = {},
): AlimentoIndice => ({
  id,
  nombre,
  grupo: 'otro',
  estado: 'cocido',
  confianza: 'verificado',
  fuente: 'tcac',
  por100g: { kcal: 100, proteina_g: 1, carbos_g: 20, grasa_g: 0 },
  ...extra,
})

describe('sinTildes', () => {
  it('quita las tildes', () => {
    expect(sinTildes('Plátano')).toBe('platano')
  })

  it('quita la virgulilla de la ñ, para que "name" encuentre "Ñame"', () => {
    expect(sinTildes('Ñame')).toBe('name')
  })

  it('deja en paz lo que no lleva tilde', () => {
    expect(sinTildes('Arroz blanco')).toBe('arroz blanco')
  })
})

describe('puntuar', () => {
  const platano = alimento('platano', 'Plátano verde')

  it('encuentra sin escribir la tilde', () => {
    expect(puntuar(platano, 'platano')).toBeGreaterThan(0)
  })

  it('encuentra escribiéndola', () => {
    expect(puntuar(platano, 'plátano')).toBeGreaterThan(0)
  })

  it('el nombre exacto puntúa más que el que solo empieza igual', () => {
    const exacto = alimento('a', 'Arroz')
    const empieza = alimento('b', 'Arroz blanco cocido')
    expect(puntuar(exacto, 'arroz')).toBeGreaterThan(puntuar(empieza, 'arroz'))
  })

  it('empezar por la consulta puntúa más que llevarla en medio', () => {
    const empieza = alimento('a', 'Arroz blanco')
    const enMedio = alimento('b', 'Bollo de arroz')
    expect(puntuar(empieza, 'arroz')).toBeGreaterThan(puntuar(enMedio, 'arroz'))
  })

  it('el nombre puntúa más que el sinónimo', () => {
    const porNombre = alimento('a', 'Banano')
    const porSinonimo = alimento('b', 'Musa paradisiaca', { sinonimos: 'banano guineo' })
    expect(puntuar(porNombre, 'banano')).toBeGreaterThan(puntuar(porSinonimo, 'banano'))
  })

  it('lo que no encaja puntúa cero', () => {
    expect(puntuar(alimento('a', 'Arroz'), 'salmon')).toBe(0)
  })

  it('una consulta en blanco no encaja con nada', () => {
    expect(puntuar(alimento('a', 'Arroz'), '   ')).toBe(0)
  })
})

describe('buscar', () => {
  const catalogo = [
    alimento('arroz', 'Arroz blanco', { grupo: 'carbohidratos' }),
    alimento('arroz-int', 'Arroz integral', { grupo: 'carbohidratos' }),
    alimento('bollo', 'Bollo de arroz', { grupo: 'carbohidratos', confianza: 'estimado' }),
    alimento('pollo', 'Pechuga de pollo', { grupo: 'proteinas' }),
  ]

  it('ordena por lo que mejor encaja', () => {
    const nombres = buscar(catalogo, 'arroz').map((a) => a.nombre)
    expect(nombres[0]).toMatch(/^Arroz/)
    expect(nombres.at(-1)).toBe('Bollo de arroz')
  })

  it('filtra por grupo', () => {
    expect(buscar(catalogo, 'a', { grupo: 'proteinas' })).toHaveLength(1)
  })

  it('puede dejar fuera lo estimado', () => {
    const ids = buscar(catalogo, 'arroz', { soloVerificados: true }).map((a) => a.id)
    expect(ids).not.toContain('bollo')
  })

  it('sin consulta devuelve el grupo entero, alfabético', () => {
    const nombres = buscar(catalogo, '', { grupo: 'carbohidratos' }).map((a) => a.nombre)
    expect(nombres).toEqual(['Arroz blanco', 'Arroz integral', 'Bollo de arroz'])
  })

  it('respeta el tope', () => {
    expect(buscar(catalogo, 'arroz', {}, 2)).toHaveLength(2)
  })

  it('a igualdad de encaje, lo verificado va antes que lo estimado', () => {
    const estimado = alimento('e', 'Quinua', { confianza: 'estimado' })
    const verificado = alimento('v', 'Quinua', { confianza: 'verificado' })
    expect(buscar([estimado, verificado], 'quinua')[0].id).toBe('v')
  })

  it('no encuentra nada cuando no hay nada', () => {
    expect(buscar(catalogo, 'chontaduro')).toEqual([])
  })
})
