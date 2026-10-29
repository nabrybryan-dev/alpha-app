import { describe, expect, it } from 'vitest'
import { semanasDeFirma, type FilaDeRevision } from './historial'

const base = { aprobado_por: 'bryan', correccion_solicitada: null, version: 1 }
const fila = (semana: string, extra: Partial<FilaDeRevision> = {}): FilaDeRevision => ({
  semana, aprobado_en: semana + 'T10:00:00Z', ...base, ...extra,
})

describe('semanasDeFirma: de las filas de revisión al historial de UN firmante', () => {
  it('sin filas, sin historial', () => {
    expect(semanasDeFirma([], 'bryan')).toEqual([])
  })

  it('agrupa por semana, de la más antigua a la más reciente', () => {
    const r = semanasDeFirma([fila('2026-09-21'), fila('2026-09-14'), fila('2026-09-14')], 'bryan')
    expect(r).toEqual([
      { fecha: '2026-09-14', borradores: 2, aprobadosSinTocar: 2, corregidos: 0 },
      { fecha: '2026-09-21', borradores: 1, aprobadosSinTocar: 1, corregidos: 0 },
    ])
  })

  it('una versión mayor que 1 o una corrección pedida cuentan como corregidos, no como sin tocar', () => {
    const r = semanasDeFirma([
      fila('2026-09-14', { version: 2 }),
      fila('2026-09-14', { aprobado_en: null, correccion_solicitada: 'Cambiar la cifra' }),
      fila('2026-09-14'),
    ], 'bryan')
    expect(r[0]).toEqual({ fecha: '2026-09-14', borradores: 3, aprobadosSinTocar: 1, corregidos: 2 })
  })

  it('lo que nadie ha firmado cuenta como borrador pero no como aprobado (silencio no es firma)', () => {
    const r = semanasDeFirma([fila('2026-09-14'), fila('2026-09-14', { aprobado_en: null, aprobado_por: null })], 'bryan')
    expect(r[0]).toMatchObject({ borradores: 2, aprobadosSinTocar: 1, corregidos: 0 })
  })

  it('lo que firmó otra persona no entra en la puerta de este firmante', () => {
    const r = semanasDeFirma([fila('2026-09-14'), fila('2026-09-14', { aprobado_por: 'manuela' })], 'bryan')
    expect(r[0]).toMatchObject({ borradores: 1, aprobadosSinTocar: 1 })
  })
})
