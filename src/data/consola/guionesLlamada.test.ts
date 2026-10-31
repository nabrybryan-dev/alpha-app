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

const { aGuionGuardado, guionDe, usuariosConGuion } = await import('./guionesLlamada')

const USUARIO = '00000000-0000-4000-8000-0000000000b1'

function fila(extra: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-0000000000c1',
    usuario_id: USUARIO,
    origen: 'landing',
    guion: { version: 3, apertura: 'Abre así.', preferencia: { fecha: '2026-11-09', franja: 'noche', hora: '19:00' } },
    dia_preferido: '2026-11-05',
    franja_preferida: 'tarde',
    version: 3,
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
  it('pide la versión más alta de ESA persona, una sola fila', async () => {
    estado.filas = [fila()]
    const r = await guionDe(USUARIO)
    expect(estado.tablas).toEqual(['guiones_llamada'])
    expect(estado.selects[0]).toBe('id,usuario_id,origen,guion,dia_preferido,franja_preferida,version,creado_en')
    expect(estado.eqs).toEqual([['usuario_id', USUARIO]])
    expect(estado.orders).toEqual([['version', { ascending: false }]])
    expect(estado.limits).toEqual([1])
    expect(r.ok && r.guion?.version).toBe(3)
    expect(r.ok && r.guion?.guion.apertura).toBe('Abre así.')
  })

  it('las columnas mandan sobre la preferencia escrita dentro del guion', async () => {
    estado.filas = [fila()]
    const r = await guionDe(USUARIO)
    expect(r.ok && r.guion).toMatchObject({ diaPreferido: '2026-11-05', franjaPreferida: 'en la tarde', horaPreferida: '19:00' })
  })

  it('sin columnas, usa la preferencia del guion', () => {
    const g = aGuionGuardado(fila({ dia_preferido: null, franja_preferida: null }) as never)
    expect(g).toMatchObject({ diaPreferido: '2026-11-09', franjaPreferida: 'en la noche' })
  })

  it('sin filas es «no hay guion», no un error', async () => {
    expect(await guionDe(USUARIO)).toEqual({ ok: true, guion: null })
  })

  it('una fila con guion que no es objeto se descarta', async () => {
    estado.filas = [fila({ guion: 'roto' })]
    expect(await guionDe(USUARIO)).toEqual({ ok: true, guion: null })
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
    expect(await guionDe(USUARIO)).toEqual({ ok: true, guion: null })
    estado.activo = true
    expect(await guionDe('')).toEqual({ ok: true, guion: null })
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
