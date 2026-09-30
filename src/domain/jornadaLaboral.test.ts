import { describe, expect, it } from 'vitest'
import { jornadaDe, puedeTachar } from './jornadaLaboral'
import type { ItemPlan } from './planOrganizador'

let n = 0
function it_(o: Partial<ItemPlan>): ItemPlan {
  n += 1
  return {
    id: `i${n}`, nivel: 'tarea', padreId: null, titulo: `Item ${n}`, primerPaso: null, dueno: 'manuela', palanca: null,
    fecha: null, estimadoMin: null, prioridad: 'pequena', estado: 'pendiente', iniciadaEn: null, hechaEn: null,
    vecesMovida: 0, origen: null, actualizadoEn: '2026-09-30T00:00:00Z', ...o,
  }
}

// 2026-09-30 es miércoles; su lunes es 2026-09-28 y el domingo 2026-10-04.
const HOY = '2026-09-30'

describe('puedeTachar (OR-03)', () => {
  it('solo el dueño tacha; Bryan no tacha lo de Manuela ni al revés', () => {
    const deManuela = it_({ dueno: 'manuela' })
    expect(puedeTachar(deManuela, 'manuela')).toBe(true)
    expect(puedeTachar(deManuela, 'bryan')).toBe(false)
    expect(puedeTachar(it_({ dueno: 'bryan' }), 'manuela')).toBe(false)
  })
  it('una tarea descartada o movida no se tacha', () => {
    expect(puedeTachar(it_({ estado: 'descartada' }), 'manuela')).toBe(false)
    expect(puedeTachar(it_({ estado: 'movida' }), 'manuela')).toBe(false)
  })
})

describe('jornadaDe', () => {
  const obj = it_({ id: 'o1', nivel: 'objetivo', titulo: 'Objetivo A', fecha: '2026-12-15' })
  const objSinFecha = it_({ id: 'o2', nivel: 'objetivo', titulo: 'Objetivo B', fecha: null })
  const hito = it_({ id: 'h1', nivel: 'hito', padreId: 'o1', titulo: 'Hito A', fecha: '2026-09-28' })
  const hitoB = it_({ id: 'h2', nivel: 'hito', padreId: 'o2', titulo: 'Hito B', fecha: '2026-09-28' })

  it('separa hoy de lo que resta de la semana y deja fuera otras semanas y otros dueños', () => {
    const items = [
      obj, hito,
      it_({ id: 't1', padreId: 'h1', fecha: HOY, titulo: 'De hoy' }),
      it_({ id: 't2', padreId: 'h1', fecha: '2026-10-02', titulo: 'Del viernes' }),
      it_({ id: 't3', padreId: 'h1', fecha: '2026-10-05', titulo: 'Semana siguiente' }),
      it_({ id: 't4', padreId: 'h1', fecha: HOY, dueno: 'bryan', titulo: 'De Bryan' }),
      it_({ id: 't5', padreId: 'h1', fecha: HOY, estado: 'descartada', titulo: 'Borrada' }),
    ]
    const j = jornadaDe(items, 'manuela', HOY)
    expect(j.hoy.map((f) => f.tarea.titulo)).toEqual(['De hoy'])
    expect(j.semana.map((f) => f.tarea.titulo)).toEqual(['Del viernes'])
  })

  it('cada tarea dice a qué hito y objetivo aporta, con el plazo corto y el mediano', () => {
    const j = jornadaDe([obj, hito, it_({ padreId: 'h1', fecha: HOY })], 'manuela', HOY)
    const f = j.hoy[0]
    expect(f.hito?.titulo).toBe('Hito A')
    expect(f.objetivo?.titulo).toBe('Objetivo A')
    expect(f.plazoCorto).toBe('2026-09-28')
    expect(f.plazoMediano).toBe('2026-12-15')
  })

  it('sin objetivo con fecha, sin hito o sin fecha de tarea: null (la pantalla dirá FALTA), nunca inventado', () => {
    const j = jornadaDe([objSinFecha, hitoB, it_({ padreId: 'h2', fecha: HOY }), it_({ padreId: null, fecha: HOY })], 'manuela', HOY)
    expect(j.hoy[0].objetivo?.titulo).toBe('Objetivo B')
    expect(j.hoy[0].plazoMediano).toBeNull()
    expect(j.hoy[1].hito).toBeNull()
    expect(j.hoy[1].objetivo).toBeNull()
    expect(j.hoy[1].plazoCorto).toBeNull()
  })

  it('las abiertas sin día no se inventan un día: van aparte', () => {
    const j = jornadaDe([it_({ fecha: null, titulo: 'Sin día' })], 'manuela', HOY)
    expect(j.sinDia.map((f) => f.tarea.titulo)).toEqual(['Sin día'])
    expect(j.hoy).toEqual([])
  })
})
