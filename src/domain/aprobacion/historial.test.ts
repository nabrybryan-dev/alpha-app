import { describe, expect, it } from 'vitest'
import { semanasDeFirma, type FilaDeRevision } from './historial'
import { veredictoDeLaPuerta } from './puerta'

const HOY = '2026-10-28' // miércoles; su lunes es 2026-10-26
const base = { aprobado_por: 'bryan', correccion_solicitada: null, version: 1 }
const fila = (semana: string, extra: Partial<FilaDeRevision> = {}): FilaDeRevision => ({
  semana, aprobado_en: semana + 'T10:00:00Z', ...base, ...extra,
})
const varias = (semana: string, n: number) => Array.from({ length: n }, () => fila(semana))
const pendiente = (semana: string): FilaDeRevision =>
  ({ semana, aprobado_en: null, aprobado_por: null, correccion_solicitada: null, version: 1 })

describe('semanasDeFirma: de las filas de revisión al historial de UN firmante', () => {
  it('sin filas, sin historial ni semana en curso', () => {
    expect(semanasDeFirma([], 'bryan', HOY)).toEqual({ semanas: [], enCurso: null })
  })

  it('agrupa por semana, de la más antigua a la más reciente', () => {
    const { semanas } = semanasDeFirma([fila('2026-10-12'), fila('2026-10-05'), fila('2026-10-05')], 'bryan', HOY)
    expect(semanas.slice(0, 2)).toEqual([
      { fecha: '2026-10-05', borradores: 2, aprobadosSinTocar: 2, corregidos: 0 },
      { fecha: '2026-10-12', borradores: 1, aprobadosSinTocar: 1, corregidos: 0 },
    ])
  })

  it('una versión mayor que 1 o una corrección pedida cuentan como corregidos, no como sin tocar', () => {
    const { semanas } = semanasDeFirma([
      fila('2026-10-05', { version: 2 }),
      fila('2026-10-05', { aprobado_en: null, aprobado_por: null, correccion_solicitada: 'Cambiar la cifra' }),
      fila('2026-10-05'),
    ], 'bryan', HOY)
    expect(semanas[0]).toEqual({ fecha: '2026-10-05', borradores: 3, aprobadosSinTocar: 1, corregidos: 2 })
  })

  it('lo que nadie firmó en una semana ya cerrada cuenta como borrador sin aprobar (silencio no es firma)', () => {
    const { semanas } = semanasDeFirma([fila('2026-10-05'), pendiente('2026-10-05')], 'bryan', HOY)
    expect(semanas[0]).toMatchObject({ borradores: 2, aprobadosSinTocar: 1, corregidos: 0 })
  })

  it('lo que firmó otra persona no entra en la puerta de este firmante', () => {
    const { semanas } = semanasDeFirma([fila('2026-10-05'), fila('2026-10-05', { aprobado_por: 'manuela' })], 'bryan', HOY)
    expect(semanas[0]).toMatchObject({ borradores: 1, aprobadosSinTocar: 1 })
  })

  it('H5: la semana en curso no entra en la racha: va aparte como «en curso»', () => {
    const filas = [...varias('2026-10-05', 6), ...varias('2026-10-12', 6), ...varias('2026-10-19', 6),
      ...varias('2026-09-28', 6), fila('2026-10-26'), pendiente('2026-10-26'), pendiente('2026-10-26')]
    const r = semanasDeFirma(filas, 'bryan', HOY)
    expect(r.semanas.map(s => s.fecha)).not.toContain('2026-10-26')
    expect(r.enCurso).toEqual({ fecha: '2026-10-26', borradores: 3, aprobadosSinTocar: 1, corregidos: 0 })
    // y la puerta, con cuatro semanas cerradas limpias, se abre aunque haya pendientes hoy
    expect(veredictoDeLaPuerta(r.semanas)).toEqual({ abierta: true, desde: '2026-10-19' })
  })

  it('H6: una semana del calendario sin filas corta la racha (no se cuentan posiciones)', () => {
    // limpias: 5-oct, 12-oct, 26-oct (hueco el 19) y la de 28-sep: cuatro limpias, pero no seguidas
    const filas = [...varias('2026-09-28', 6), ...varias('2026-10-05', 6), ...varias('2026-10-12', 6)]
    const { semanas } = semanasDeFirma(filas, 'bryan', '2026-11-02') // cerradas: hasta el 26-oct
    expect(semanas.at(-1)).toEqual({ fecha: '2026-10-26', borradores: 0, aprobadosSinTocar: 0, corregidos: 0 })
    expect(veredictoDeLaPuerta(semanas)).toMatchObject({ abierta: false, semanasLimpias: 0 })
  })

  it('H6: un hueco en medio también corta, y solo cuenta lo posterior', () => {
    const filas = [...varias('2026-09-07', 6), ...varias('2026-09-14', 6), ...varias('2026-10-05', 6), ...varias('2026-10-12', 6), ...varias('2026-10-19', 6)]
    const { semanas } = semanasDeFirma(filas, 'bryan', HOY)
    expect(veredictoDeLaPuerta(semanas)).toMatchObject({ abierta: false, semanasLimpias: 3 })
  })
})
