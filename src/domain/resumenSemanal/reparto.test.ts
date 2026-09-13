import { describe, expect, it } from 'vitest'
import type { AdherenciaNutricional, CheckinDiario, Sesion } from '../types'
import {
  lunesDeLaSemana,
  personasDeLaTanda,
  repartoSemanal,
  type PersonaDeLaTanda,
} from './reparto'

const LUNES = '2026-09-07'

function sesion(id: string, hecha: boolean): Sesion {
  return {
    id,
    dia: 1,
    orden: 1,
    nombre: 'Empuje',
    fecha: '2026-09-08',
    ejercicios: [
      {
        id: `${id}-e1`,
        ejercicioId: 'press-banca',
        nombre: 'Press banca',
        sets: 3,
        repsObjetivo: 8,
        rirObjetivo: 2,
        series: hecha
          ? [
              { reps: 8, pesoKg: 60, rir: 2 },
              { reps: 8, pesoKg: 60, rir: 2 },
              { reps: 8, pesoKg: 60, rir: 2 },
            ]
          : [],
      },
    ],
  } as unknown as Sesion
}

function noche(fecha: string): CheckinDiario {
  return {
    id: `c-${fecha}`,
    usuarioId: 'u-1',
    fecha,
    horaAcostarse: '23:00',
    horaLevantarse: '07:00',
  } as CheckinDiario
}

function adherencia(fecha: string): AdherenciaNutricional {
  return { id: `a-${fecha}`, usuarioId: 'u-1', fecha, estado: 'si' } as AdherenciaNutricional
}

const CON_TODO: PersonaDeLaTanda = {
  usuarioId: 'u-1',
  nombre: 'Valentina Cruz',
  sesiones: [sesion('s-1', true), sesion('s-2', false)],
  checkins: ['01', '02', '03', '04', '05', '06', '07'].map((d) => noche(`2026-09-${d}`)),
  adherencias: [adherencia('2026-09-02'), adherencia('2026-09-03')],
}

describe('el reparto de la tanda semanal', () => {
  it('le arma a cada quien SU guion, con sus números', () => {
    const tanda = repartoSemanal([CON_TODO], LUNES)

    expect(tanda.saltos).toEqual([])
    expect(tanda.encargos).toHaveLength(1)
    const encargo = tanda.encargos[0]
    expect(encargo.usuarioId).toBe('u-1')
    expect(encargo.semana).toBe(LUNES)
    expect(encargo.guion.texto).toContain('Hola Valentina')
    expect(encargo.guion.texto).toContain('2 sesiones y completaste 1')
    expect(encargo.guion.texto).toContain('100 por ciento')
  })

  it('a quien no tiene NADA que contarle no se le manda un hola y adiós', () => {
    // Saludo y despedida no dependen de ningún dato: sin este freno saldría un
    // vídeo con la voz del coach que no dice ni un número, y suena a error.
    const vacio: PersonaDeLaTanda = {
      usuarioId: 'u-2',
      nombre: 'Camilo',
      sesiones: [],
      checkins: [],
      adherencias: [],
    }
    const tanda = repartoSemanal([vacio], LUNES)

    expect(tanda.encargos).toEqual([])
    expect(tanda.saltos).toEqual([{ usuarioId: 'u-2', nombre: 'Camilo', motivo: 'nada-que-decir' }])
  })

  it('con una sola de las tres cosas, sí hay revisión', () => {
    const soloSueno: PersonaDeLaTanda = {
      usuarioId: 'u-3',
      nombre: 'Ana',
      sesiones: [],
      checkins: [noche('2026-09-01')],
      adherencias: [],
    }
    const tanda = repartoSemanal([soloSueno], LUNES)

    expect(tanda.saltos).toEqual([])
    expect(tanda.encargos[0].guion.texto).toContain('noches registradas')
  })

  it('un encargo sin dueño no se publica', () => {
    const tanda = repartoSemanal([{ ...CON_TODO, usuarioId: '  ' }], LUNES)
    expect(tanda.encargos).toEqual([])
    expect(tanda.saltos[0].motivo).toBe('sin-usuario')
  })

  it('a quien el coach deja fuera no le sale vídeo, aunque tenga microciclo activo', () => {
    const otra = { ...CON_TODO, usuarioId: 'u-9', nombre: 'Ana Pérez' }
    const tanda = repartoSemanal([CON_TODO, otra], LUNES, ['  ana   PÉREZ '])

    expect(tanda.encargos.map((e) => e.usuarioId)).toEqual(['u-1'])
    expect(tanda.saltos).toEqual([{ usuarioId: 'u-9', nombre: 'Ana Pérez', motivo: 'fuera-por-el-coach' }])
  })

  it('la lista de fuera casa también por id, y con la tilde escrita de otra forma', () => {
    const otra = { ...CON_TODO, usuarioId: 'u-9', nombre: 'Ana Pérez' }
    expect(repartoSemanal([otra], LUNES, ['u-9']).encargos).toEqual([])
    expect(repartoSemanal([otra], LUNES, ['Ana Pe\u0301rez']).encargos).toEqual([])
    expect(repartoSemanal([otra], LUNES, ['Ana']).encargos).toHaveLength(1)
  })

  it('una semana que no es lunes se para AQUÍ, no veintitrés audios después', () => {
    expect(() => repartoSemanal([CON_TODO], '2026-09-13')).toThrow(/lunes/)
    expect(() => repartoSemanal([CON_TODO], 'el domingo')).toThrow(/lunes/)
  })

  it('reparte a los veintitrés de una pasada y no se traga a nadie', () => {
    const personas = Array.from({ length: 23 }, (_, i) => ({
      ...CON_TODO,
      usuarioId: `u-${i}`,
      nombre: `Persona ${i}`,
    }))
    const tanda = repartoSemanal(personas, LUNES)
    expect(tanda.encargos).toHaveLength(23)
    expect(new Set(tanda.encargos.map((e) => e.usuarioId)).size).toBe(23)
  })
})

describe('el lunes de la semana', () => {
  it('el domingo pertenece a la semana que se acaba de cerrar', () => {
    // El vídeo sale el domingo y habla de la semana que termina ESE domingo.
    expect(lunesDeLaSemana('2026-09-13')).toBe('2026-09-07')
  })

  it('un lunes es su propio lunes', () => {
    expect(lunesDeLaSemana('2026-09-07')).toBe('2026-09-07')
  })

  it('y cualquier día de en medio cae en el mismo', () => {
    expect(lunesDeLaSemana('2026-09-10')).toBe('2026-09-07')
  })
})

describe('de las filas de la base a las personas de la tanda', () => {
  const FILAS = {
    usuarios: [
      { id: 'u-1', nombre: 'Valentina Cruz' },
      { id: 'u-2', nombre: 'Camilo' },
    ],
    microciclos: [
      { usuario_id: 'u-1', datos: { sesiones: [sesion('s-1', true)] } },
      // Un microciclo activo de alguien que NO es asesorado: el coach probando.
      { usuario_id: 'staff-1', datos: { sesiones: [sesion('s-9', true)] } },
    ],
    checkins: [
      { usuario_id: 'u-1', datos: noche('2026-09-01') },
      { usuario_id: 'u-2', datos: noche('2026-09-02') },
    ],
    adherencias: [
      { id: 'a-1', usuario_id: 'u-1', fecha: '2026-09-02', estado: 'si' as const, comentario: null },
    ],
  }

  it('le da a cada quien SUS filas y no las del de al lado', () => {
    const personas = personasDeLaTanda(FILAS)

    expect(personas).toHaveLength(1)
    expect(personas[0].usuarioId).toBe('u-1')
    expect(personas[0].nombre).toBe('Valentina Cruz')
    expect(personas[0].sesiones).toHaveLength(1)
    // El check-in de u-2 no se le cuela: `usuario_id` en la columna, `usuarioId` en el
    // dominio, y un nombre mal copiado aquí no da error —le dice a alguien que no entrenó—.
    expect(personas[0].checkins).toHaveLength(1)
    expect(personas[0].checkins[0].fecha).toBe('2026-09-01')
    expect(personas[0].adherencias[0].usuarioId).toBe('u-1')
    expect(personas[0].adherencias[0].comentario).toBeUndefined()
  })

  it('quien no tiene microciclo activo no entra en la tanda', () => {
    // Camilo es asesorado y tiene check-in, pero está en pausa: no le llega revisión.
    expect(personasDeLaTanda(FILAS).map((p) => p.usuarioId)).not.toContain('u-2')
  })

  it('un microciclo de alguien que no es asesorado se queda fuera', () => {
    expect(personasDeLaTanda(FILAS).map((p) => p.usuarioId)).not.toContain('staff-1')
  })

  it('con --persona se recorta a uno solo', () => {
    expect(personasDeLaTanda(FILAS, 'u-1')).toHaveLength(1)
    expect(personasDeLaTanda(FILAS, 'u-2')).toEqual([])
  })

  it('un microciclo sin sesiones no revienta: llega vacío y el reparto lo salta', () => {
    const personas = personasDeLaTanda({
      ...FILAS,
      microciclos: [{ usuario_id: 'u-1', datos: null }],
      checkins: [],
      adherencias: [],
    })
    expect(personas[0].sesiones).toEqual([])
    expect(repartoSemanal(personas, LUNES).saltos[0].motivo).toBe('nada-que-decir')
  })
})
