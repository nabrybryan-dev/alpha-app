import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCapaDelSalon } from './useCapaDelSalon'

const entrada = (busqueda: string) => ({ busqueda, categoria: 'SENTADILLA', nombre: 'Sentadilla con barra' })

describe('la capa del salon depende de la direccion', () => {
  it('apagada sin la bandera y encendida con ella, sin remontar', () => {
    const { result, rerender } = renderHook(({ busqueda, categoria, nombre }) => useCapaDelSalon(busqueda, categoria, nombre), {
      initialProps: entrada(''),
    })
    expect(result.current.elementos).toEqual([])
    rerender(entrada('?momentos=ejemplo'))
    expect(result.current.elementos.length).toBe(3)
    rerender(entrada('?otra=1'))
    expect(result.current.elementos).toEqual([])
  })
  it('con las mismas entradas devuelve la MISMA capa (no la recalcula en cada renderizado)', () => {
    const { result, rerender } = renderHook(({ busqueda, categoria, nombre }) => useCapaDelSalon(busqueda, categoria, nombre), {
      initialProps: entrada('?momentos=ejemplo'),
    })
    const primera = result.current
    rerender(entrada('?momentos=ejemplo'))
    expect(result.current).toBe(primera)
  })
})
