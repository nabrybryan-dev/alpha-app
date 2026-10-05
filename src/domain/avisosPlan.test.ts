import { describe, expect, it } from 'vitest'
import {
  decidirAvisos,
  minutosDeHora,
  relojLocal,
  type TareaAviso,
} from '../../supabase/functions/avisos-plan/decidir.ts'

// 2026-09-30 13:30 UTC = 08:30 en Bogotá (UTC-5, sin horario de verano).
const OCHO_Y_MEDIA = new Date('2026-09-30T13:30:00Z')
const SIETE = new Date('2026-09-30T12:00:00Z')
const HOY = '2026-09-30'

function tarea(o: Partial<TareaAviso> = {}): TareaAviso {
  return {
    id: 't1',
    dueno: 'bryan',
    titulo: 'Enviar 30 propuestas',
    primer_paso: 'Abrir el tablero y filtrar etapa2',
    fecha: HOY,
    estado: 'pendiente',
    prioridad: 'principal',
    veces_movida: 0,
    actualizado_en: '2026-09-30T05:00:00Z',
    ...o,
  }
}

const base = { duenosConSuscripcion: ['bryan', 'manuela'] as const, enviadosHoy: new Set<string>() }

describe('avisos del organizador', () => {
  it('usa la hora de Bogotá, no la del servidor', () => {
    expect(relojLocal(new Date('2026-10-01T03:00:00Z'))).toEqual({ dia: '2026-09-30', minutos: 22 * 60 })
    expect(minutosDeHora('07:15')).toBe(435)
    expect(minutosDeHora('basura')).toBe(480)
  })

  it('inicio de bloque: la principal de hoy sin empezar, a partir de las 08:00', () => {
    const [a] = decidirAvisos({ ...base, tareas: [tarea()], ahora: OCHO_Y_MEDIA })
    expect(a).toMatchObject({ tipo: 'inicio_bloque', dueno: 'bryan', item_id: 't1', url: '/coach/mi-plan' })
    expect(a.titulo).toContain('Enviar 30 propuestas')
    expect(a.cuerpo).toBe('Primer paso: Abrir el tablero y filtrar etapa2')
    expect(decidirAvisos({ ...base, tareas: [tarea()], ahora: SIETE })).toEqual([])
  })

  it('respeta la hora que fija cada dueño y manda a Manuela a /mi-plan', () => {
    const t = tarea({ dueno: 'manuela' })
    expect(decidirAvisos({ ...base, tareas: [t], ahora: OCHO_Y_MEDIA, horas: { manuela: '09:00' } })).toEqual([])
    const [a] = decidirAvisos({ ...base, tareas: [t], ahora: OCHO_Y_MEDIA, horas: { manuela: '08:30' } })
    expect(a.url).toBe('/mi-plan')
  })

  it('no avisa si ya empezó, no es la principal, no es de hoy o el dueño no tiene suscripción', () => {
    const ahora = OCHO_Y_MEDIA
    expect(decidirAvisos({ ...base, tareas: [tarea({ estado: 'en_curso' })], ahora })).toEqual([])
    expect(decidirAvisos({ ...base, tareas: [tarea({ prioridad: 'pequena' })], ahora })).toEqual([])
    expect(decidirAvisos({ ...base, tareas: [tarea({ fecha: '2026-10-01' })], ahora })).toEqual([])
    expect(decidirAvisos({ ...base, duenosConSuscripcion: ['manuela'], tareas: [tarea()], ahora })).toEqual([])
  })

  it('atascada: 2 días sin moverse, o movida 2 veces', () => {
    const ahora = OCHO_Y_MEDIA
    const quieta = tarea({ id: 'q', prioridad: 'pequena', fecha: '2026-09-28', actualizado_en: '2026-09-28T15:00:00Z' })
    const movida = tarea({ id: 'm', prioridad: 'pequena', veces_movida: 2 })
    const fresca = tarea({ id: 'f', prioridad: 'pequena', fecha: '2026-09-29', actualizado_en: '2026-09-29T15:00:00Z' })
    const r = decidirAvisos({ ...base, tareas: [quieta, movida, fresca], ahora })
    expect(r.map((a) => [a.item_id, a.tipo])).toEqual([
      ['q', 'atascada'],
      ['m', 'atascada'],
    ])
    expect(r[0].titulo).toContain('Sigue sin moverse')
  })

  it('máximo un aviso por tarea y día, aunque cumpla los dos casos', () => {
    const doble = tarea({ veces_movida: 3 })
    const r = decidirAvisos({ ...base, tareas: [doble], ahora: OCHO_Y_MEDIA })
    expect(r).toHaveLength(1)
    expect(r[0].tipo).toBe('inicio_bloque')
    expect(decidirAvisos({ ...base, tareas: [doble], ahora: OCHO_Y_MEDIA, enviadosHoy: new Set(['t1']) })).toEqual([])
  })

  it('una tarea hecha, descartada o futura nunca se avisa como atascada', () => {
    const viejo = { prioridad: 'pequena', veces_movida: 5, actualizado_en: '2026-09-20T00:00:00Z' }
    const ts = [
      tarea({ id: 'h', estado: 'hecha', ...viejo }),
      tarea({ id: 'd', estado: 'descartada', ...viejo }),
      tarea({ id: 'x', fecha: '2026-10-02', ...viejo }),
      tarea({ id: 's', fecha: null, ...viejo }),
    ]
    expect(decidirAvisos({ ...base, tareas: ts, ahora: OCHO_Y_MEDIA })).toEqual([])
  })

  it('sin primer paso da un texto de respaldo y recorta los títulos largos', () => {
    const [a] = decidirAvisos({
      ...base,
      tareas: [tarea({ primer_paso: null, titulo: 'x'.repeat(200) })],
      ahora: OCHO_Y_MEDIA,
    })
    expect(a.cuerpo).toContain('Abre Mi plan')
    expect(a.titulo.length).toBeLessThan(100)
  })
})
