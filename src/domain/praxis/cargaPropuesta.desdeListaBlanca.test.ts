import { describe, expect, it } from 'vitest'
import type { Microciclo } from '../types'
import { proponerBajadaDeCarga } from './cargaPropuesta'
import { leerPorArea } from './fuentesPorArea'
import { loQuePraxisVe, type CrudoDePersona } from './plan/listaBlanca'

/**
 * Comprobación en ejecución del eslabón que antes solo se verificó leyendo código: las series que la
 * persona registró SALEN de la lista blanca (`loQuePraxisVe`), pasan por el mapa del área «entrenar»
 * (`leerPorArea`) y LLEGAN a `proponerBajadaDeCarga` con la última serie por orden. Datos ficticios.
 */
const HOY = '2026-10-21'

function microcicloConSeries(series: Record<string, unknown>[]): Microciclo {
  return {
    id: 'm-1', usuarioId: 'u1', numero: 1, cadenciaDias: 7, estado: 'activo', fechaInicio: '2026-10-19',
    sesiones: [{
      id: 's1', nombre: 'PIERNA A', orden: 1, tipo: 'fuerza', preparacion: [], bloquesCardio: [],
      ejercicios: [{
        id: 'e1', categoria: 'PIERNA', nombre: 'SENTADILLA TRASERA', cues: '', prescripcion: '100KG A 8 REPS; 2 SERIES',
        cargaKg: 100, unidadCarga: 'kg', descansoMin: 2, sets: 2, rango: '8', repsDiana: 8, rirObjetivo: 2, series,
      }],
    }],
  } as unknown as Microciclo
}

const crudo = (series: Record<string, unknown>[]): CrudoDePersona => ({
  usuarioId: 'u1', microciclos: [microcicloConSeries(series)], checkins: [], adherencias: [],
})

function seriesQueLlegan(series: Record<string, unknown>[]) {
  const ve = loQuePraxisVe(crudo(series), HOY)
  const lectura = leerPorArea('entrenar', ve)
  return lectura.activo?.sesiones[0].ejercicios[0].series ?? []
}

describe('la última serie llega a proponerBajadaDeCarga desde la lista blanca', () => {
  it('con dos series, usa la de mayor orden (100 kg x 8 a RIR 1 -> 95 kg con «algo»)', () => {
    const series = seriesQueLlegan([
      { orden: 2, cargaKg: 100, reps: 8, rir: 1, velocidad: { media: 0.4 } },
      { orden: 1, cargaKg: 90, reps: 8, rir: 3 },
    ])
    expect(series.map((s) => s.orden).sort()).toEqual([1, 2])
    expect(proponerBajadaDeCarga({ series, cansancio: 'algo', motivo: 'cansancio' })).toMatchObject({
      tipo: 'propuesta', cargaActualKg: 100, cargaPropuestaKg: 95, rirDeLaSerie: 1,
    })
  })

  it('el campo «velocidad» no sale de la lista blanca y no estorba', () => {
    const [s] = seriesQueLlegan([{ orden: 1, cargaKg: 100, reps: 8, rir: 1, velocidad: { media: 0.4 } }])
    expect(Object.keys(s).sort()).toEqual(['cargaKg', 'orden', 'reps', 'rir'])
  })

  it('una serie sin RIR llega sin RIR y la función no inventa: no_calcula', () => {
    const series = seriesQueLlegan([{ orden: 1, cargaKg: 100, reps: 8 }])
    expect(proponerBajadaDeCarga({ series, cansancio: 'algo', motivo: 'cansancio' })).toEqual({ tipo: 'no_calcula', razon: 'sin_rir' })
  })

  it('sin series registradas la lista blanca entrega una lista vacía y la función no calcula', () => {
    const series = seriesQueLlegan([])
    expect(series).toEqual([])
    expect(proponerBajadaDeCarga({ series, cansancio: 'algo', motivo: 'cansancio' })).toEqual({ tipo: 'no_calcula', razon: 'sin_serie' })
  })

  it('el dolor deriva a salud aunque no haya series (el motivo se mira antes que las series)', () => {
    expect(proponerBajadaDeCarga({ series: [], cansancio: 'algo', motivo: 'dolor' })).toEqual({ tipo: 'derivar_a_salud' })
  })
})
