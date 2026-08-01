import { describe, expect, it } from 'vitest'
import { alimentosRecientes, itemsDelDia, kcalDeComida, resumenDelDia } from './resumen'
import type { AlimentoIndice } from './busqueda'
import type { RegistroComida, RegistroItem } from '../types'

const CATALOGO: Record<string, AlimentoIndice> = {
  arroz: {
    id: 'arroz',
    nombre: 'Arroz blanco, cocido',
    grupo: 'carbohidratos',
    estado: 'cocido',
    confianza: 'verificado',
    fuente: 'tcac',
    por100g: { kcal: 130, proteina_g: 2.4, carbos_g: 28, grasa_g: 0.3 },
  },
  pollo: {
    id: 'pollo',
    nombre: 'Pechuga de pollo, cocida',
    grupo: 'proteinas',
    estado: 'cocido',
    confianza: 'verificado',
    fuente: 'tcac',
    // Sin vitamina C medida: la TCAC no la publica para carnes. `null` no es 0.
    por100g: { kcal: 165, proteina_g: 31, carbos_g: 0, grasa_g: 3.6, vitamina_c_mg: null },
  },
}

const porId = (id: string) => CATALOGO[id]

const item = (alimentoId: string, gramos: number, fuePesado = true): RegistroItem => ({
  id: `it-${alimentoId}`,
  alimentoId,
  gramos,
  fuePesado,
  estadoAsumido: 'cocido',
})

const comida = (
  momentoIso: string,
  items: RegistroItem[],
  confianza: RegistroComida['confianza'] = 'pesado',
): RegistroComida => ({
  id: `c-${momentoIso}`,
  usuarioId: 'u-1',
  momentoIso,
  comida: 'almuerzo',
  cocinadoPorEl: true,
  aceiteG: null,
  salG: null,
  confianza,
  items,
})

describe('itemsDelDia', () => {
  it('convierte cada ítem con su composición', () => {
    const items = itemsDelDia([comida('2026-07-31T13:00', [item('arroz', 150)])], porId)
    expect(items).toEqual([{ por100g: CATALOGO.arroz.por100g, gramos: 150, confianza: 'pesado' }])
  })

  it('un ítem pesado dentro de una comida estimada conserva SU confianza', () => {
    // Dentro de un almuerzo estimado a ojo puede haber un alimento que sí se
    // pesó. Su margen es el suyo, no el de la comida.
    const [pesado, aOjo] = itemsDelDia(
      [comida('2026-07-31T13:00', [item('arroz', 150, true), item('pollo', 120, false)], 'estimado')],
      porId,
    )
    expect(pesado.confianza).toBe('pesado')
    expect(aOjo.confianza).toBe('estimado')
  })

  it('se salta un alimento que ya no está en el catálogo', () => {
    // El registro viejo sigue en la base; simplemente no hay con qué calcularlo.
    const items = itemsDelDia(
      [comida('2026-07-31T13:00', [item('borrado', 100), item('arroz', 100)])],
      porId,
    )
    expect(items).toHaveLength(1)
  })

  it('un día sin comidas no da ítems', () => {
    expect(itemsDelDia([], porId)).toEqual([])
  })
})

describe('resumenDelDia', () => {
  it('suma las calorías de todo el día', () => {
    const total = resumenDelDia(
      [
        comida('2026-07-31T08:00', [item('arroz', 100)]),
        comida('2026-07-31T13:00', [item('pollo', 100)]),
      ],
      porId,
    )
    expect(total.porDia.kcal).toBe(295)
  })

  it('un día entero pesado tiene el margen más estrecho', () => {
    const total = resumenDelDia([comida('2026-07-31T13:00', [item('arroz', 100)])], porId)
    expect(total.margenPct).toBe(5)
  })

  it('marca como parcial el nutriente que a algún alimento le falta', () => {
    // El pollo no trae vitamina C medida. Sumarla como si fuera 0 diría que el
    // día tuvo menos de la que tuvo.
    const total = resumenDelDia(
      [comida('2026-07-31T13:00', [item('arroz', 100), item('pollo', 100)])],
      porId,
    )
    expect(total.parciales.has('vitamina_c_mg')).toBe(true)
  })
})

describe('kcalDeComida', () => {
  it('suma solo esa comida', () => {
    expect(kcalDeComida(comida('2026-07-31T13:00', [item('arroz', 200)]), porId)).toBe(260)
  })

  it('una comida vacía son 0 kcal', () => {
    expect(kcalDeComida(comida('2026-07-31T13:00', []), porId)).toBe(0)
  })

  it('ignora lo que no está en el catálogo en vez de reventar', () => {
    expect(kcalDeComida(comida('2026-07-31T13:00', [item('borrado', 500)]), porId)).toBe(0)
  })
})

describe('alimentosRecientes', () => {
  it('devuelve lo último registrado primero', () => {
    const recientes = alimentosRecientes([
      comida('2026-07-30T13:00', [item('arroz', 100)]),
      comida('2026-07-31T13:00', [item('pollo', 100)]),
    ])
    expect(recientes).toEqual(['pollo', 'arroz'])
  })

  it('no repite el mismo alimento', () => {
    const recientes = alimentosRecientes([
      comida('2026-07-30T13:00', [item('arroz', 100)]),
      comida('2026-07-31T13:00', [item('arroz', 200)]),
    ])
    expect(recientes).toEqual(['arroz'])
  })

  it('respeta el tope', () => {
    const comidas = [comida('2026-07-31T13:00', [item('arroz', 100), item('pollo', 100)])]
    expect(alimentosRecientes(comidas, 1)).toEqual(['arroz'])
  })

  it('sin nada registrado, no hay recientes', () => {
    expect(alimentosRecientes([])).toEqual([])
  })
})
