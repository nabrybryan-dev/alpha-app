import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Mismo patrón que `notasLlamada.test.ts`: se dobla `../supabase` y se REGISTRA cada eslabón,
 *  para ver que la consulta pide la tabla, la persona y el orden correctos. UUID inventados. */
const estado = {
  activo: true,
  filas: [] as unknown[],
  error: null as { message: string } | null,
  sinDatos: false,
  excepcion: false,
  tablas: [] as string[],
  selects: [] as string[],
  eqs: [] as unknown[][],
  orders: [] as unknown[][],
  limits: [] as number[],
  ins: [] as unknown[][],
}

function respuesta() {
  if (estado.excepcion) return Promise.reject(new Error('Failed to fetch'))
  return Promise.resolve({ data: estado.sinDatos ? null : estado.filas, error: estado.error })
}

vi.mock('../supabase', () => ({
  get modoNube() {
    return estado.activo
  },
  supabase: () => ({
    from: (tabla: string) => {
      estado.tablas.push(tabla)
      return {
        select: (columnas: string) => {
          estado.selects.push(columnas)
          const lectura = {
            eq: (...args: unknown[]) => {
              estado.eqs.push(args)
              return lectura
            },
            order: (...args: unknown[]) => {
              estado.orders.push(args)
              return lectura
            },
            limit: (n: number) => {
              estado.limits.push(n)
              return respuesta()
            },
            in: (...args: unknown[]) => {
              estado.ins.push(args)
              return respuesta()
            },
          }
          return lectura
        },
      }
    },
  }),
}))

const { TOPE_LLAMADAS, aGuionGuardado, guionDe, hoyEnColombia, llamadasPorHacer, seleccionarLlamadas, usuariosConGuion } = await import('./guionesLlamada')
const { default: EJEMPLO } = await import('../../domain/consolaCoach/guion-llamada-v1.fixture.json')

const USUARIO = '00000000-0000-4000-8000-0000000000b1'
const PERSONA = '00000000-0000-4000-8000-0000000000d1'

function fila(extra: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-0000000000c1',
    person_id: PERSONA,
    usuario_id: USUARIO as string | null,
    origen: 'landing',
    guion: { ...EJEMPLO, apertura: 'Abre así.', reserva: { ...EJEMPLO.reserva, fecha: '2026-11-09', hora: '16:30' } },
    dia_preferido: '2026-11-05',
    franja_preferida: 'tarde',
    revision: 1793372400000,
    creado_en: '2026-10-30T15:00:00Z',
    ...extra,
  }
}

beforeEach(() => {
  Object.assign(estado, {
    activo: true,
    filas: [],
    error: null,
    sinDatos: false,
    excepcion: false,
    tablas: [],
    selects: [],
    eqs: [],
    orders: [],
    limits: [],
    ins: [],
  })
})

describe('guionDe', () => {
  it('pide la revisión más alta de ESA persona, una sola fila', async () => {
    estado.filas = [fila()]
    const r = await guionDe(USUARIO)
    expect(estado.tablas).toEqual(['guiones_llamada'])
    expect(estado.selects[0]).toBe('id,person_id,usuario_id,origen,guion,dia_preferido,franja_preferida,revision,creado_en')
    expect(estado.eqs).toEqual([['usuario_id', USUARIO]])
    expect(estado.orders).toEqual([['revision', { ascending: false }]])
    expect(estado.limits).toEqual([1])
    expect(r.ok && r.lectura?.tipo === 'guion' && r.lectura.guardado.guion.apertura).toBe('Abre así.')
  })

  it('la columna del día manda sobre la reserva del guion; la hora sale de la reserva', async () => {
    estado.filas = [fila()]
    const r = await guionDe(USUARIO)
    expect(r.ok && r.lectura?.tipo === 'guion' && r.lectura.guardado).toMatchObject({
      diaPreferido: '2026-11-05',
      franjaPreferida: 'en la tarde',
      horaPreferida: '16:30',
    })
  })

  it('sin columna de día, usa la fecha de la reserva', () => {
    const l = aGuionGuardado(fila({ dia_preferido: null }) as never)
    expect(l?.tipo === 'guion' && l.guardado.diaPreferido).toBe('2026-11-09')
  })

  it('una versión desconocida no se pinta: se marca como ilegible', () => {
    expect(aGuionGuardado(fila({ guion: { ...EJEMPLO, version: 'guion-llamada-v2' } }) as never)).toEqual({
      tipo: 'ilegible',
      ilegible: { version: 'guion-llamada-v2' },
    })
  })

  it('sin filas es «no hay guion», no un error', async () => {
    expect(await guionDe(USUARIO)).toEqual({ ok: true, lectura: null })
  })

  it('una fila con guion que no es objeto se descarta', async () => {
    estado.filas = [fila({ guion: 'roto' })]
    expect(await guionDe(USUARIO)).toEqual({ ok: true, lectura: null })
  })

  it('un error, una respuesta vacía o la red caída son ok:false (no «no hay»)', async () => {
    estado.error = { message: 'permission denied' }
    expect((await guionDe(USUARIO)).ok).toBe(false)
    estado.error = null
    estado.sinDatos = true
    expect((await guionDe(USUARIO)).ok).toBe(false)
    estado.sinDatos = false
    estado.excepcion = true
    const r = await guionDe(USUARIO)
    expect(r).toEqual({ ok: false, error: 'No se pudo cargar el guion de la llamada.' })
  })

  it('en demo o sin persona no pregunta a nadie', async () => {
    estado.activo = false
    expect(await guionDe(USUARIO)).toEqual({ ok: true, lectura: null })
    estado.activo = true
    expect(await guionDe('')).toEqual({ ok: true, lectura: null })
    expect(estado.tablas).toEqual([])
  })
})

describe('usuariosConGuion', () => {
  it('una sola consulta para toda la lista', async () => {
    estado.filas = [{ usuario_id: USUARIO }, { usuario_id: USUARIO }]
    const r = await usuariosConGuion([USUARIO, 'otro'])
    expect(estado.selects).toEqual(['usuario_id'])
    expect(estado.ins).toEqual([['usuario_id', [USUARIO, 'otro']]])
    expect(r.ok && [...r.usuarios]).toEqual([USUARIO])
  })

  it('lista vacía o demo: no consulta', async () => {
    expect(await usuariosConGuion([])).toEqual({ ok: true, usuarios: new Set() })
    expect(estado.tablas).toEqual([])
  })

  it('un fallo es ok:false', async () => {
    estado.excepcion = true
    expect((await usuariosConGuion([USUARIO])).ok).toBe(false)
  })
})

describe('seleccionarLlamadas', () => {
  const HOY = '2026-11-05'
  const otra = '00000000-0000-4000-8000-0000000000d2'
  const tercera = '00000000-0000-4000-8000-0000000000d3'

  it('se queda con la revisión más alta de cada persona', () => {
    const vieja = fila({ id: 'v', usuario_id: null, revision: 1, dia_preferido: '2026-11-20' })
    const nueva = fila({ id: 'n', usuario_id: null, revision: 2, dia_preferido: '2026-11-07' })
    const lista = seleccionarLlamadas([vieja, nueva] as never, HOY)
    expect(lista.map((l) => l.guardado.id)).toEqual(['n'])
    expect(lista[0]).toMatchObject({ personId: PERSONA, usuarioId: null, dia: '2026-11-07' })
  })

  it('entra quien no tiene cuenta (aunque su día ya pasó) y quien la tiene con la llamada hoy o después', () => {
    const lista = seleccionarLlamadas(
      [
        fila({ id: 'sin-cuenta-pasada', person_id: PERSONA, usuario_id: null, dia_preferido: '2026-11-01' }),
        fila({ id: 'con-cuenta-hoy', person_id: otra, dia_preferido: HOY }),
        fila({ id: 'con-cuenta-pasada', person_id: tercera, dia_preferido: '2026-11-04' }),
      ] as never,
      HOY,
    )
    expect(lista.map((l) => l.guardado.id)).toEqual(['sin-cuenta-pasada', 'con-cuenta-hoy'])
  })

  it('ordena por día de la llamada; sin día, al final; a igual día, por llegada', () => {
    const lista = seleccionarLlamadas(
      [
        fila({ id: 'tarde', person_id: PERSONA, usuario_id: null, dia_preferido: '2026-11-09', creado_en: '2026-10-30T16:00:00Z' }),
        fila({ id: 'temprano', person_id: otra, usuario_id: null, dia_preferido: '2026-11-09', creado_en: '2026-10-30T09:00:00Z' }),
        fila({ id: 'antes', person_id: tercera, usuario_id: null, dia_preferido: '2026-11-06' }),
      ] as never,
      HOY,
    )
    expect(lista.map((l) => l.guardado.id)).toEqual(['antes', 'temprano', 'tarde'])
  })

  it('lo que no se sabe leer no entra (no hay qué abrir)', () => {
    const lista = seleccionarLlamadas([fila({ usuario_id: null, guion: { ...EJEMPLO, version: 'guion-llamada-v2' } })] as never, HOY)
    expect(lista).toEqual([])
  })

  it('hoy es el de Colombia, no el UTC', () => {
    // 03:00 UTC del 6 = 22:00 del 5 en Bogotá.
    expect(hoyEnColombia(new Date('2026-11-06T03:00:00Z'))).toBe('2026-11-05')
  })
})

describe('llamadasPorHacer', () => {
  it('una consulta: las revisiones más recientes, con tope', async () => {
    estado.filas = [fila({ usuario_id: null })]
    const r = await llamadasPorHacer(new Date('2026-11-01T15:00:00Z'))
    expect(estado.tablas).toEqual(['guiones_llamada'])
    expect(estado.eqs).toEqual([])
    expect(estado.orders).toEqual([['revision', { ascending: false }]])
    expect(estado.limits).toEqual([TOPE_LLAMADAS])
    expect(r.ok && r.llamadas.map((l) => l.personId)).toEqual([PERSONA])
  })

  it('cero filas (también por RLS) es lista vacía; un fallo es ok:false; en demo no consulta', async () => {
    expect(await llamadasPorHacer()).toEqual({ ok: true, llamadas: [] })
    estado.excepcion = true
    expect(await llamadasPorHacer()).toEqual({ ok: false, error: 'No se pudieron cargar las llamadas por hacer.' })
    estado.excepcion = false
    estado.error = { message: 'x' }
    expect((await llamadasPorHacer()).ok).toBe(false)
    estado.tablas = []
    estado.activo = false
    expect(await llamadasPorHacer()).toEqual({ ok: true, llamadas: [] })
    expect(estado.tablas).toEqual([])
  })
})
