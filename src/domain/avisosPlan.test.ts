import { describe, expect, it } from 'vitest'
import {
  decidirAvisos,
  decidirRecordatoriosCheckin,
  destinatariosDelPlan,
  lotesDeIds,
  ROLES_DEL_RECORDATORIO_CHECKIN,
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

// 2026-09-30 23:30 UTC = 18:30 en Bogotá; 22:30 UTC = 17:30; 2026-10-01 03:30 UTC = 22:30 del día 30.
const SEIS_Y_MEDIA = new Date('2026-09-30T23:30:00Z')
const CINCO_Y_MEDIA = new Date('2026-09-30T22:30:00Z')
const DIEZ_Y_MEDIA = new Date('2026-10-01T03:30:00Z')

describe('recordatorio de las 6 pm del check-in (desde el servidor)', () => {
  const entrada = {
    ahora: SEIS_Y_MEDIA,
    suscritos: ['u-1', 'u-2'],
    conCheckinHoy: new Set<string>(),
    enviadosHoy: new Set<string>(),
  }

  it('avisa después de las 6 pm de Bogotá a quien está suscrito y no ha llenado el check-in', () => {
    const avisos = decidirRecordatoriosCheckin(entrada)
    expect(avisos.map((a) => a.usuario_id)).toEqual(['u-1', 'u-2'])
    expect(avisos[0]).toMatchObject({ fecha_aviso: HOY, url: '/bienestar' })
  })

  it('no avisa antes de las 6 pm de Bogotá', () => {
    expect(decidirRecordatoriosCheckin({ ...entrada, ahora: CINCO_Y_MEDIA })).toEqual([])
  })

  it('no avisa a quien ya llenó el check-in de hoy', () => {
    const avisos = decidirRecordatoriosCheckin({ ...entrada, conCheckinHoy: new Set(['u-1']) })
    expect(avisos.map((a) => a.usuario_id)).toEqual(['u-2'])
  })

  it('un solo aviso por persona y día: lo ya enviado no se repite', () => {
    const avisos = decidirRecordatoriosCheckin({ ...entrada, enviadosHoy: new Set(['u-2']) })
    expect(avisos.map((a) => a.usuario_id)).toEqual(['u-1'])
  })

  it('no avisa de madrugada ni muy entrada la noche', () => {
    expect(decidirRecordatoriosCheckin({ ...entrada, ahora: DIEZ_Y_MEDIA })).toEqual([])
  })

  it('el texto no lleva datos de salud', () => {
    const [a] = decidirRecordatoriosCheckin(entrada)
    expect(`${a.titulo} ${a.cuerpo}`).not.toMatch(/kg|kcal|peso|sueño|dolor|ánimo|estrés/i)
  })

  it('sin suscritos no hay nada que decidir', () => {
    expect(decidirRecordatoriosCheckin({ ...entrada, suscritos: [] })).toEqual([])
  })
})

describe('los avisos del equipo no llegan a los asesorados', () => {
  const BRYAN = '28c3cfe8-13ef-4f3e-95cc-f23c4f260bce'
  const MANUELA = 'aa202ff5-74c1-4b76-9140-8ba44dc62f17'
  const ids = { bryan: BRYAN, manuela: MANUELA }

  it('de todas las suscripciones, solo Bryan y Manuela cuentan como destinatarios del plan', () => {
    expect(destinatariosDelPlan(['u-asesorado', BRYAN, 'u-otra'], ids)).toEqual(['bryan'])
    expect(destinatariosDelPlan(['u-asesorado'], ids)).toEqual([])
    expect(destinatariosDelPlan([MANUELA, BRYAN], ids)).toEqual(['bryan', 'manuela'])
  })

  it('una tarea del equipo no produce aviso del plan si su dueño no es destinatario (un asesorado suscrito no basta)', () => {
    const duenos = destinatariosDelPlan(['u-asesorado'], ids)
    expect(decidirAvisos({ ...base, duenosConSuscripcion: duenos, tareas: [tarea()], ahora: OCHO_Y_MEDIA })).toEqual([])
  })
})

describe('quién recibe el recordatorio del check-in (29-oct)', () => {
  it('lo reciben los asesorados y la nutricionista, y el coach no', () => {
    const roles: readonly string[] = ROLES_DEL_RECORDATORIO_CHECKIN
    expect(roles).toContain('asesorado')
    expect(roles).toContain('nutricionista')
    expect(roles).not.toContain('coach')
  })

  it('que la nutricionista reciba el recordatorio no la vuelve destinataria de otra cosa: el plan sigue yendo solo por id', () => {
    expect(destinatariosDelPlan(['u-nutri'], { bryan: 'u-bryan', manuela: 'u-manuela' })).toEqual([])
  })
})

describe('lotesDeIds: la URL de las consultas no crece sin tope', () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`)
  it('parte en lotes de a lo sumo el tope y no pierde ningún id', () => {
    const lotes = lotesDeIds(ids(250), 100)
    expect(lotes.map((l) => l.length)).toEqual([100, 100, 50])
    expect(lotes.flat()).toEqual(ids(250))
  })
  it('una lista vacía no hace ninguna consulta, y una corta va en un solo lote', () => {
    expect(lotesDeIds([])).toEqual([])
    expect(lotesDeIds(ids(3))).toEqual([ids(3)])
  })
  it('no repite ids', () => {
    expect(lotesDeIds(['a', 'b', 'a'], 10)).toEqual([['a', 'b']])
  })
})
