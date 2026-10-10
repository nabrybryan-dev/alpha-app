import { describe, expect, it } from 'vitest'
import type { CheckinDiario } from '../types'
import { checkinsConDatoAnotado, procedenciaDelDato } from './datoAnotado'

const ck = (fecha: string, extra: Partial<CheckinDiario>): CheckinDiario => ({
  id: `ck-u-${fecha}`,
  usuarioId: 'u',
  fecha,
  ...extra,
})

describe('procedenciaDelDato · con la marca del formulario', () => {
  it('lo que la persona movió ese día es anotado; lo que no, arrastrado', () => {
    const serie = [
      ck('2026-10-01', { pesoKg: 70, pasos: 8000, anotadoHoy: ['pesoKg'] }),
      ck('2026-10-02', { pesoKg: 70, pasos: 9000, anotadoHoy: ['pasos'] }),
    ]
    expect(procedenciaDelDato(serie, 'pesoKg')).toEqual(['anotado', 'arrastrado'])
    expect(procedenciaDelDato(serie, 'pasos')).toEqual(['arrastrado', 'anotado'])
  })

  it('con la marca, un peso idéntico al anterior SÍ cuenta si la persona lo tocó', () => {
    const serie = [
      ck('2026-10-01', { pesoKg: 70, anotadoHoy: ['pesoKg'] }),
      ck('2026-10-02', { pesoKg: 70, anotadoHoy: ['pesoKg'] }),
    ]
    expect(procedenciaDelDato(serie, 'pesoKg')).toEqual(['anotado', 'anotado'])
  })
})

describe('procedenciaDelDato · reportes viejos, sin marca', () => {
  it('el primero de una racha vale; los repetidos seguidos quedan dudosos', () => {
    const serie = [
      ck('2026-09-01', { pesoKg: 72.8 }),
      ck('2026-09-02', { pesoKg: 72.8 }),
      ck('2026-09-03', { pesoKg: 72.8 }),
      ck('2026-09-04', { pesoKg: 71.8 }),
    ]
    expect(procedenciaDelDato(serie, 'pesoKg')).toEqual(['anotado', 'dudoso', 'dudoso', 'anotado'])
  })

  it('compara contra el último reporte QUE TRAE el dato, no contra el de ayer', () => {
    const serie = [ck('2026-09-01', { pesoKg: 70 }), ck('2026-09-02', {}), ck('2026-09-03', { pesoKg: 70 })]
    expect(procedenciaDelDato(serie, 'pesoKg')).toEqual(['anotado', 'ausente', 'dudoso'])
  })

  it('ordena por fecha antes de comparar', () => {
    const serie = [ck('2026-09-02', { pesoKg: 70 }), ck('2026-09-01', { pesoKg: 70 })]
    expect(procedenciaDelDato(serie, 'pesoKg')).toEqual(['dudoso', 'anotado'])
  })
})

describe('checkinsConDatoAnotado', () => {
  it('deja solo los reportes cuyo dato se anotó de verdad, y dice cuántos apartó', () => {
    const serie = [
      ck('2026-09-01', { pesoKg: 72.8 }),
      ck('2026-09-02', { pesoKg: 72.8 }),
      ck('2026-09-03', { pesoKg: 72.8, anotadoHoy: [] }),
      ck('2026-09-04', { pesoKg: 71.8, anotadoHoy: ['pesoKg'] }),
    ]
    const r = checkinsConDatoAnotado(serie, 'pesoKg')
    expect(r.anotados.map((c) => c.fecha)).toEqual(['2026-09-01', '2026-09-04'])
    expect(r.apartados).toBe(2)
  })
})
