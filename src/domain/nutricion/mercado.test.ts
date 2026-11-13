import { describe, expect, it } from 'vitest'
import { palabrasDeBusqueda, textoDePedido } from './mercado'

describe('palabrasDeBusqueda', () => {
  it('quita la cantidad entre paréntesis y las palabras de relleno', () => {
    expect(palabrasDeBusqueda('Pechuga de pollo (1.5 kg)')).toEqual(['pechuga', 'pollo'])
  })
  it('una línea con varios alimentos da hasta tres palabras', () => {
    expect(palabrasDeBusqueda('Espinaca, lechuga, brócoli, zanahoria')).toEqual(['espinaca', 'lechuga', 'brócoli'])
  })
  it('conserva las tildes: el buscador del catálogo ya las tolera', () => {
    expect(palabrasDeBusqueda('Plátano y banano')).toEqual(['plátano', 'banano'])
  })
  it('no repite palabras', () => {
    expect(palabrasDeBusqueda('Papa y papa criolla (2 kg)')).toEqual(['papa', 'criolla'])
  })
  it('una línea vacía no da nada', () => {
    expect(palabrasDeBusqueda('  ')).toEqual([])
  })
})

describe('textoDePedido', () => {
  it('normaliza espacios y mayúscula inicial', () => {
    expect(textoDePedido('  kefir   de  la tienda ')).toBe('Kefir de la tienda')
  })
  it('rechaza lo demasiado corto', () => {
    expect(textoDePedido(' k ')).toBeNull()
  })
})
