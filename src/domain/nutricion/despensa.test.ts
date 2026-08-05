import { describe, expect, it } from 'vitest'
import {
  DIAS_CICLO_MAXIMO,
  agregar,
  claveDe,
  estaVieja,
  paraElMotor,
  pedidos,
  quitar,
  tieneDatos,
  type ItemDespensa,
} from './despensa'

const item = (alimentoId: string, agregadoEn = '2026-08-01'): ItemDespensa => ({
  alimentoId,
  cantidadG: null,
  agregadoEn,
  origen: 'compra',
})

const pedido = (texto: string, agregadoEn = '2026-08-01'): ItemDespensa => ({
  alimentoId: null,
  textoPedido: texto,
  cantidadG: null,
  agregadoEn,
  origen: 'ya_tenia',
})

describe('claveDe', () => {
  it('un alimento del catálogo se identifica por su id', () => {
    expect(claveDe(item('arroz-blanco'))).toBe('arroz-blanco')
  })

  it('un pedido se identifica por lo que escribió la persona', () => {
    expect(claveDe(pedido('Kefir de cabra'))).toBe('pedido:kefir de cabra')
  })

  // «Kefir» y «kefir » son lo mismo escrito dos veces, no dos peticiones.
  it('el texto del pedido no distingue mayúsculas ni espacios de sobra', () => {
    expect(claveDe(pedido('  KEFIR de Cabra '))).toBe(claveDe(pedido('kefir de cabra')))
  })
})

describe('agregar', () => {
  it('mete el alimento en la despensa', () => {
    expect(agregar([], item('avena'))).toHaveLength(1)
  })

  it('no muta la despensa que recibe', () => {
    const antes: ItemDespensa[] = [item('avena')]
    agregar(antes, item('huevo'))
    expect(antes).toHaveLength(1)
  })

  /**
   * Volver a comprar algo no es tenerlo dos veces: es tenerlo, otra vez. La
   * segunda entrada REEMPLAZA a la primera y refresca su fecha, que es lo que
   * hace que la despensa siga estando al día tras cada compra.
   */
  it('volver a añadir lo mismo lo refresca, no lo duplica', () => {
    const despensa = agregar([item('avena', '2026-07-20')], item('avena', '2026-08-01'))
    expect(despensa).toHaveLength(1)
    expect(despensa[0].agregadoEn).toBe('2026-08-01')
  })

  it('la cantidad nueva pisa a la vieja', () => {
    const despensa = agregar(
      [{ ...item('avena'), cantidadG: 500 }],
      { ...item('avena'), cantidadG: 1000 },
    )
    expect(despensa[0].cantidadG).toBe(1000)
  })
})

describe('quitar', () => {
  it('saca lo que se acabó', () => {
    expect(quitar([item('avena'), item('huevo')], 'avena')).toHaveLength(1)
  })

  it('quitar algo que no está no rompe nada', () => {
    expect(quitar([item('avena')], 'pollo')).toHaveLength(1)
  })

  it('no muta la despensa que recibe', () => {
    const antes = [item('avena')]
    quitar(antes, 'avena')
    expect(antes).toHaveLength(1)
  })
})

describe('lo que el motor puede usar', () => {
  /**
   * LA REGLA QUE PROTEGE LA RECOMENDACIÓN. Un alimento pedido entra en la
   * despensa y se ve -la persona lo tiene de verdad, y Manuela necesita
   * saberlo-, pero NO tiene tabla nutricional. Meterlo en un cálculo de
   * cantidades daría un número inventado con pinta de medido.
   */
  it('el alimento sin datos no entra en el cálculo', () => {
    const despensa = [item('avena'), pedido('Kefir de cabra')]
    expect(paraElMotor(despensa).map(claveDe)).toEqual(['avena'])
  })

  it('pero sí se ve, para que la persona y Manuela lo tengan delante', () => {
    const despensa = [item('avena'), pedido('Kefir de cabra')]
    expect(pedidos(despensa)).toHaveLength(1)
    expect(despensa).toHaveLength(2)
  })

  it('tieneDatos distingue los dos', () => {
    expect(tieneDatos(item('avena'))).toBe(true)
    expect(tieneDatos(pedido('Kefir'))).toBe(false)
  })

  it('una despensa vacía no rompe al motor', () => {
    expect(paraElMotor([])).toEqual([])
  })
})

describe('estaVieja', () => {
  // Se refresca cada ciclo de compra, de 8 a 15 días. Pasado el más largo, lo
  // que dice la despensa ya no habla de lo que hay en la cocina.
  it('pasado el ciclo más largo, hay que volver a preguntar', () => {
    expect(estaVieja([item('avena', '2026-07-01')], '2026-08-01')).toBe(true)
  })

  it('recién hecha la compra, no', () => {
    expect(estaVieja([item('avena', '2026-07-30')], '2026-08-01')).toBe(false)
  })

  // Manda el más reciente: si ayer añadió algo, la despensa está viva aunque el
  // resto lleve un mes ahí.
  it('cuenta desde lo último que se tocó, no desde lo más viejo', () => {
    const despensa = [item('avena', '2026-06-01'), item('huevo', '2026-07-31')]
    expect(estaVieja(despensa, '2026-08-01')).toBe(false)
  })

  /**
   * Una despensa vacía NO está vieja: está sin estrenar. Devolver `true` haría
   * que la app le reclamara una actualización a quien todavía no ha hecho la
   * primera compra.
   */
  it('una despensa vacía no está vieja: está sin estrenar', () => {
    expect(estaVieja([], '2026-08-01')).toBe(false)
  })

  it('el ciclo más largo es el de 15 días', () => {
    expect(DIAS_CICLO_MAXIMO).toBe(15)
  })
})
