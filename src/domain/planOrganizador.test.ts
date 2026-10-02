import { describe, expect, it } from 'vitest'
import {
  avanceDeHito,
  avanceDeObjetivo,
  bloqueSugerido,
  cargaSemanal,
  debePreguntarDestino,
  estaAtascada,
  intensidadDe,
  lunesDe,
  principalSinEmpezar,
  puedeAgregarTarea,
  puedeMoverTarea,
  relojMmSs,
  segundosRestantes,
  sumarDias,
  tareasDelDia,
  tareasParaDespues,
  type ItemPlan,
} from './planOrganizador'

let n = 0
function tarea(o: Partial<ItemPlan> = {}): ItemPlan {
  n += 1
  return {
    id: `t${n}`,
    nivel: 'tarea',
    padreId: 'h1',
    titulo: `Tarea ${n}`,
    primerPaso: 'abrir el tablero',
    dueno: 'bryan',
    palanca: 'A',
    fecha: '2026-09-30',
    estimadoMin: 30,
    prioridad: 'pequena',
    estado: 'pendiente',
    iniciadaEn: null,
    hechaEn: null,
    vecesMovida: 0,
    origen: null,
    actualizadoEn: '2026-09-30T08:00:00Z',
    ...o,
  }
}
const entrada = { titulo: 'Nueva', primerPaso: 'abrir la hoja', fecha: '2026-09-30', estimadoMin: 30, prioridad: 'pequena' as const }

describe('fechas', () => {
  it('el lunes de una semana, también desde el domingo', () => {
    expect(lunesDe('2026-09-30')).toBe('2026-09-28') // miércoles
    expect(lunesDe('2026-09-28')).toBe('2026-09-28')
    expect(lunesDe('2026-10-04')).toBe('2026-09-28') // domingo
    expect(sumarDias('2026-09-30', 3)).toBe('2026-10-03')
  })
})

describe('el día: 1 grande + 2 pequeñas', () => {
  it('separa la principal de las pequeñas y deja fuera descartadas y movidas', () => {
    const items = [
      tarea({ prioridad: 'principal' }),
      tarea(),
      tarea({ estado: 'descartada' }),
      tarea({ estado: 'movida' }),
      tarea({ fecha: '2026-10-01' }),
      tarea({ dueno: 'manuela' }),
    ]
    const dia = tareasDelDia(items, 'bryan', '2026-09-30')
    expect(dia.principal?.prioridad).toBe('principal')
    expect(dia.pequenas).toHaveLength(1)
    expect(dia.vivas).toHaveLength(2)
  })

  it('máximo 3 tareas por día y una sola principal, con el motivo dicho', () => {
    const tres = [tarea({ prioridad: 'principal' }), tarea(), tarea()]
    const v = puedeAgregarTarea(tres, 'bryan', entrada)
    expect(v).toEqual({ ok: false, motivo: expect.stringContaining('3 tareas') })
    const p = puedeAgregarTarea([tarea({ prioridad: 'principal' })], 'bryan', { ...entrada, prioridad: 'principal' })
    expect(p).toEqual({ ok: false, motivo: expect.stringContaining('principal') })
    expect(puedeAgregarTarea([tarea({ prioridad: 'principal' })], 'bryan', entrada)).toEqual({ ok: true })
    // El cupo es por dueño: Manuela no llena el día de Bryan.
    expect(puedeAgregarTarea([tarea({ dueno: 'manuela' }), tarea({ dueno: 'manuela' }), tarea({ dueno: 'manuela' })], 'bryan', entrada)).toEqual({ ok: true })
  })

  it('una descartada libera el cupo', () => {
    const items = [tarea(), tarea(), tarea({ estado: 'descartada' })]
    expect(puedeAgregarTarea(items, 'bryan', entrada)).toEqual({ ok: true })
  })

  it('tarea de 50 min como máximo, con primer paso y minutos', () => {
    expect(puedeAgregarTarea([], 'bryan', { ...entrada, estimadoMin: 51 })).toMatchObject({ ok: false })
    expect(puedeAgregarTarea([], 'bryan', { ...entrada, estimadoMin: 50 })).toEqual({ ok: true })
    expect(puedeAgregarTarea([], 'bryan', { ...entrada, estimadoMin: null })).toMatchObject({ ok: false })
    expect(puedeAgregarTarea([], 'bryan', { ...entrada, primerPaso: '  ' })).toMatchObject({ ok: false })
    expect(puedeAgregarTarea([], 'bryan', { ...entrada, titulo: '' })).toMatchObject({ ok: false })
  })

  it('una tarea sin día no ocupa cupo: va a «después»', () => {
    expect(puedeAgregarTarea([tarea(), tarea(), tarea()], 'bryan', { ...entrada, fecha: null })).toEqual({ ok: true })
    const despues = tareasParaDespues([tarea({ fecha: null }), tarea({ fecha: null, estado: 'hecha' }), tarea()], 'bryan')
    expect(despues).toHaveLength(1)
  })

  it('mover: no cuenta la propia tarea y respeta el cupo del destino', () => {
    const t = tarea({ prioridad: 'principal' })
    const lleno = [tarea({ fecha: '2026-10-01' }), tarea({ fecha: '2026-10-01' }), tarea({ fecha: '2026-10-01' })]
    expect(puedeMoverTarea([t, ...lleno], t, '2026-10-01')).toMatchObject({ ok: false })
    expect(puedeMoverTarea([t], t, '2026-09-30')).toEqual({ ok: true })
    expect(puedeMoverTarea([t, tarea({ fecha: '2026-10-02', prioridad: 'principal' })], t, '2026-10-02')).toMatchObject({ ok: false })
  })
})

describe('atasco y arrastre', () => {
  it('atascada: abierta, con día, y 2 días o más sin cambios', () => {
    const vieja = tarea({ actualizadoEn: '2026-09-28T10:00:00Z' })
    expect(estaAtascada(vieja, '2026-09-30')).toBe(true)
    expect(estaAtascada(tarea({ actualizadoEn: '2026-09-29T10:00:00Z' }), '2026-09-30')).toBe(false)
    expect(estaAtascada(tarea({ actualizadoEn: '2026-09-20T10:00:00Z', estado: 'hecha' }), '2026-09-30')).toBe(false)
    expect(estaAtascada(tarea({ actualizadoEn: '2026-09-20T10:00:00Z', fecha: null }), '2026-09-30')).toBe(false)
    expect(estaAtascada(tarea({ actualizadoEn: '2026-09-20T10:00:00Z', fecha: '2026-10-05' }), '2026-09-30')).toBe(false)
    expect(estaAtascada(tarea({ actualizadoEn: '2026-09-20T10:00:00Z', estado: 'en_curso' }), '2026-09-30')).toBe(true)
  })

  it('movida dos veces sube a pregunta', () => {
    expect(debePreguntarDestino(tarea({ vecesMovida: 1 }))).toBe(false)
    expect(debePreguntarDestino(tarea({ vecesMovida: 2 }))).toBe(true)
    expect(debePreguntarDestino(tarea({ vecesMovida: 3, estado: 'hecha' }))).toBe(false)
  })
})

describe('la semana', () => {
  it('planeado vs hecho, solo tareas vivas del dueño dentro de la semana', () => {
    const items = [
      tarea({ fecha: '2026-09-28', estimadoMin: 50, estado: 'hecha', hechaEn: '2026-09-28T15:00:00Z' }),
      tarea({ fecha: '2026-09-30', estimadoMin: 30 }),
      tarea({ fecha: '2026-10-04', estimadoMin: 20 }),
      tarea({ fecha: '2026-10-05', estimadoMin: 60 }), // otra semana
      tarea({ fecha: '2026-09-29', estimadoMin: 45, estado: 'descartada' }),
      tarea({ fecha: '2026-09-29', estimadoMin: 45, dueno: 'manuela' }),
    ]
    const c = cargaSemanal(items, 'bryan', '2026-09-28')
    expect(c).toMatchObject({ planeadoMin: 100, hechoMin: 50, tareas: 3, hechas: 1, intensidad: 'baja' })
  })

  it('la intensidad sube con las horas planeadas', () => {
    expect(intensidadDe(0)).toBe('baja')
    expect(intensidadDe(6 * 60 - 1)).toBe('baja')
    expect(intensidadDe(6 * 60)).toBe('media')
    expect(intensidadDe(10 * 60)).toBe('alta')
  })

  it('el avance de un hito y de un objetivo sale de sus tareas, y sin tareas no inventa un 0 %', () => {
    const hito = (id: string, padreId: string): ItemPlan => tarea({ id, nivel: 'hito', padreId, prioridad: null, estimadoMin: null })
    const items = [
      hito('h1', 'o1'),
      hito('h2', 'o1'),
      tarea({ padreId: 'h1', estado: 'hecha', hechaEn: 'x' }),
      tarea({ padreId: 'h1' }),
      tarea({ padreId: 'h2', estado: 'hecha', hechaEn: 'x' }),
      tarea({ padreId: 'h2', estado: 'descartada' }),
      tarea({ padreId: 'otro' }),
    ]
    expect(avanceDeHito(items, 'h1')).toMatchObject({ hechas: 1, total: 2, pct: 50, sinTareas: false })
    expect(avanceDeObjetivo(items, 'o1')).toMatchObject({ hechas: 2, total: 3, pct: 67 })
    expect(avanceDeObjetivo(items, 'no-existe')).toMatchObject({ total: 0, sinTareas: true })
  })
})

describe('aviso y temporizador', () => {
  it('avisa si la principal de hoy no se empezó, y solo entonces', () => {
    const p = tarea({ prioridad: 'principal' })
    expect(principalSinEmpezar([p], 'bryan', '2026-09-30')?.id).toBe(p.id)
    expect(principalSinEmpezar([{ ...p, estado: 'en_curso' }], 'bryan', '2026-09-30')).toBeNull()
    expect(principalSinEmpezar([{ ...p, estado: 'hecha' }], 'bryan', '2026-09-30')).toBeNull()
    expect(principalSinEmpezar([tarea()], 'bryan', '2026-09-30')).toBeNull()
    expect(principalSinEmpezar([p], 'manuela', '2026-09-30')).toBeNull()
  })

  it('el reloj cuenta hacia atrás y no baja de cero', () => {
    const inicio = Date.UTC(2026, 8, 30, 12, 0, 0)
    expect(segundosRestantes(inicio, 25, inicio)).toBe(1500)
    expect(segundosRestantes(inicio, 25, inicio + 60_000)).toBe(1440)
    expect(segundosRestantes(inicio, 25, inicio + 99 * 60_000)).toBe(0)
    expect(relojMmSs(1500)).toBe('25:00')
    expect(relojMmSs(65)).toBe('01:05')
    expect(relojMmSs(-3)).toBe('00:00')
  })

  it('el bloque sugerido es 25 o 50', () => {
    expect(bloqueSugerido(15)).toBe(25)
    expect(bloqueSugerido(25)).toBe(25)
    expect(bloqueSugerido(40)).toBe(50)
    expect(bloqueSugerido(null)).toBe(50)
  })
})
