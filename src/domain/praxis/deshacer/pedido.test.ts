import { describe, expect, it } from 'vitest'
import { interpretarPedidoDeshacer } from './pedido'

describe('interpretarPedidoDeshacer (gramática cerrada)', () => {
  it('lee las órdenes del diseño', () => {
    expect(interpretarPedidoDeshacer('quita lo último que anoté')).toEqual({ pideVarios: false, referencia: 'ultimo' })
    expect(interpretarPedidoDeshacer('deshaz lo del agua')).toEqual({ tipo: 'hidratacion', pideVarios: false, referencia: 'ultimo' })
    expect(interpretarPedidoDeshacer('Deshaz eso')).toEqual({ pideVarios: false, referencia: 'eso' })
    expect(interpretarPedidoDeshacer('deshaz lo de la comida de las 10')).toEqual({
      tipo: 'comida',
      minutoDicho: 600,
      pideVarios: false,
      referencia: 'eso',
    })
  })

  it('«de la tarde» suma 12 horas', () => {
    expect(interpretarPedidoDeshacer('quita lo de la comida de las 2:30 de la tarde')?.minutoDicho).toBe(14 * 60 + 30)
  })

  it('«los tres últimos» y «todo» marcan que pidió varios', () => {
    expect(interpretarPedidoDeshacer('borra los tres últimos')?.pideVarios).toBe(true)
    expect(interpretarPedidoDeshacer('borra todo')?.pideVarios).toBe(true)
  })

  it('no dispara con terceros ni con objetos fuera de la lista (casos 46 y 16 del examen)', () => {
    expect(interpretarPedidoDeshacer('mi hermano borró todo')).toBeNull()
    expect(interpretarPedidoDeshacer('toca borrar fotos')).toBeNull()
    expect(interpretarPedidoDeshacer('borra las fotos')).toBeNull()
    expect(interpretarPedidoDeshacer('quita lo de la comida de las 25')).toBeNull()
    expect(interpretarPedidoDeshacer('anota 250 ml de agua')).toBeNull()
  })
})
