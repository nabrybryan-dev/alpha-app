import { describe, expect, it } from 'vitest'
import { coeficienteCarga } from '../cargas'
import { proponerBajadaDeCarga, SUBE_RIR_POR_CANSANCIO, type PedidoDeBajada } from './cargaPropuesta'

const serie = (orden: number, cargaKg: number, reps?: number, rir?: number) => ({ orden, cargaKg, reps, rir })
const pedido = (extra: Partial<PedidoDeBajada> = {}): PedidoDeBajada => ({
  series: [serie(1, 100, 8, 1)],
  cansancio: 'algo',
  motivo: 'cansancio',
  ...extra,
})

describe('proponerBajadaDeCarga', () => {
  it('con cansancio «algo» sube el RIR en 1: 100 kg x 8 a RIR 1 -> 95 kg (redondeo a 2,5)', () => {
    // 8 reps: RIR 1 = 0,715, RIR 2 = 0,685. 1RM = 100 / 0,715 = 139,9; x 0,685 = 95,8 -> 95 (a 2,5 kg)
    const r = proponerBajadaDeCarga(pedido())
    expect(r).toMatchObject({ tipo: 'propuesta', cargaActualKg: 100, cargaPropuestaKg: 95, rirDeLaSerie: 1, rirObjetivo: 2 })
  })

  it('con cansancio «mucho» sube el RIR en 2: 100 kg x 8 a RIR 1 -> 90 kg', () => {
    // RIR 3 en 8 reps = 0,65 -> 139,9 * 0,65 = 90,9 -> 90 (a 2,5 kg)
    const r = proponerBajadaDeCarga(pedido({ cansancio: 'mucho' }))
    expect(r).toMatchObject({ tipo: 'propuesta', cargaPropuestaKg: 90, rirObjetivo: 3 })
  })

  it('usa la ultima serie por orden, no la ultima del arreglo', () => {
    const r = proponerBajadaDeCarga(pedido({ series: [serie(3, 100, 8, 1), serie(1, 60, 8, 3)] }))
    expect(r).toMatchObject({ tipo: 'propuesta', cargaActualKg: 100 })
  })

  it('nunca propone una carga mayor o igual a la actual', () => {
    // 2,5 kg x 1 rep a RIR 0 no tiene hueco al redondear
    const r = proponerBajadaDeCarga(pedido({ series: [serie(1, 2.5, 1, 0)] }))
    expect(r.tipo).toBe('no_calcula')
    if (r.tipo === 'no_calcula') expect(r.razon).toBe('no_baja')
  })

  it('un motivo de dolor NO calcula nada y deriva a salud', () => {
    expect(proponerBajadaDeCarga(pedido({ motivo: 'dolor' }))).toEqual({ tipo: 'derivar_a_salud' })
  })

  it('sin series no calcula', () => {
    expect(proponerBajadaDeCarga(pedido({ series: [] }))).toEqual({ tipo: 'no_calcula', razon: 'sin_serie' })
  })

  it('sin reps o sin RIR en la ultima serie no calcula (no se inventa)', () => {
    expect(proponerBajadaDeCarga(pedido({ series: [serie(1, 100, undefined, 1)] }))).toEqual({ tipo: 'no_calcula', razon: 'sin_reps' })
    expect(proponerBajadaDeCarga(pedido({ series: [serie(1, 100, 8, undefined)] }))).toEqual({ tipo: 'no_calcula', razon: 'sin_rir' })
  })

  it('fuera de la tabla (mas de 15 reps o RIR objetivo > 6) no extrapola', () => {
    expect(proponerBajadaDeCarga(pedido({ series: [serie(1, 40, 20, 1)] }))).toEqual({ tipo: 'no_calcula', razon: 'fuera_de_tabla' })
    expect(proponerBajadaDeCarga(pedido({ series: [serie(1, 40, 8, 5)], cansancio: 'mucho' }))).toEqual({ tipo: 'no_calcula', razon: 'fuera_de_tabla' })
  })

  it('carga de la serie 0 o negativa no calcula', () => {
    expect(proponerBajadaDeCarga(pedido({ series: [serie(1, 0, 8, 1)] }))).toEqual({ tipo: 'no_calcula', razon: 'sin_serie' })
  })

  it('el salto de redondeo es un parametro', () => {
    const r = proponerBajadaDeCarga(pedido({ saltoKg: 5 }))
    expect(r).toMatchObject({ tipo: 'propuesta', cargaPropuestaKg: 95 })
    const r2 = proponerBajadaDeCarga(pedido({ saltoKg: 1 }))
    expect(r2).toMatchObject({ tipo: 'propuesta', cargaPropuestaKg: 96 })
  })

  it('devuelve lo necesario para auditar: 1RM estimado y la tabla de reglas sin firmar', () => {
    const r = proponerBajadaDeCarga(pedido())
    expect(r).toMatchObject({ tipo: 'propuesta', unRmEstimadoKg: 139.9, reglaFirmada: false })
  })

  it('la regla provisional sale de lo escrito: 04 (PRS 0-2: RIR +1/+2) y es coherente con 05 (caida de 3-5 %)', () => {
    expect(SUBE_RIR_POR_CANSANCIO).toEqual({ algo: 1, mucho: 2 })
    // con +1 RIR la bajada de 100 kg x 8 cae entre 3 y 5 %
    const r = proponerBajadaDeCarga(pedido({ saltoKg: 0.1 }))
    if (r.tipo !== 'propuesta') throw new Error('debia proponer')
    const caida = (r.cargaActualKg - r.cargaPropuestaKg) / r.cargaActualKg
    expect(caida).toBeGreaterThanOrEqual(0.03)
    expect(caida).toBeLessThanOrEqual(0.05)
    expect(coeficienteCarga(8, 2)).toBe(0.685)
  })

  it('no muta lo que recibe', () => {
    const entrada = pedido({ series: [serie(2, 100, 8, 1), serie(1, 90, 8, 2)] })
    const copia = JSON.parse(JSON.stringify(entrada))
    proponerBajadaDeCarga(entrada)
    expect(entrada).toEqual(copia)
  })
})

describe('proponerBajadaDeCarga · revisión ciega del 21-oct (hallazgos 9 a 12)', () => {
  it('el dolor deriva a salud aunque no haya series, ni carga válida, ni reps, ni RIR (se mira antes que todo)', () => {
    expect(proponerBajadaDeCarga(pedido({ motivo: 'dolor', series: [] }))).toEqual({ tipo: 'derivar_a_salud' })
    expect(proponerBajadaDeCarga(pedido({ motivo: 'dolor', series: [serie(1, 0, 8, 1)] }))).toEqual({ tipo: 'derivar_a_salud' })
    expect(proponerBajadaDeCarga(pedido({ motivo: 'dolor', series: [serie(1, 100, undefined, undefined)] }))).toEqual({ tipo: 'derivar_a_salud' })
  })
  it('reps o RIR en null (común en datos de la base) dan la razón correcta, no «fuera_de_tabla»', () => {
    const nulo = null as unknown as undefined
    expect(proponerBajadaDeCarga(pedido({ series: [serie(1, 100, nulo, 1)] }))).toEqual({ tipo: 'no_calcula', razon: 'sin_reps' })
    expect(proponerBajadaDeCarga(pedido({ series: [serie(1, 100, 8, nulo)] }))).toEqual({ tipo: 'no_calcula', razon: 'sin_rir' })
  })
  it('un salto no finito se ignora y se usa el de por defecto; un salto enorme no propone 0 kg ni NaN', () => {
    expect(proponerBajadaDeCarga(pedido({ saltoKg: Number.POSITIVE_INFINITY }))).toMatchObject({ tipo: 'propuesta', cargaPropuestaKg: 95 })
    expect(proponerBajadaDeCarga(pedido({ saltoKg: Number.NaN }))).toMatchObject({ tipo: 'propuesta', cargaPropuestaKg: 95 })
    const enorme = proponerBajadaDeCarga(pedido({ saltoKg: 1000 }))
    expect(enorme.tipo).toBe('no_calcula')
  })
  it('con el mismo orden repetido gana la que viene después en la lista (resultado determinista)', () => {
    const r = proponerBajadaDeCarga(pedido({ series: [serie(2, 60, 8, 3), serie(2, 100, 8, 1)] }))
    expect(r).toMatchObject({ tipo: 'propuesta', cargaActualKg: 100 })
  })
})
