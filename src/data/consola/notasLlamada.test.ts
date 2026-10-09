import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Mismo patrón que `casosFirma.test.ts`: se mockea `../supabase`, no este archivo, para
 *  probar el camino real que arma cada llamada. */
const estado = {
  activo: true,
  filasSelect: [] as unknown[],
  errorSelect: null as { message: string; code?: string } | null,
  filaInsertada: null as unknown,
  errorInsert: null as { message: string; code?: string } | null,
  ultimoInsert: null as unknown,
}

vi.mock('../supabase', () => ({
  get modoNube() {
    return estado.activo
  },
  supabase: () => ({
    from: (tabla: string) => {
      if (tabla !== 'notas_llamada') throw new Error(`tabla inesperada: ${tabla}`)
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              order: () => Promise.resolve({ data: estado.filasSelect, error: estado.errorSelect }),
            }),
          }),
        }),
        insert: (fila: unknown) => {
          estado.ultimoInsert = fila
          return {
            select: () => ({
              single: () => Promise.resolve({ data: estado.filaInsertada, error: estado.errorInsert }),
            }),
          }
        },
      }
    },
  }),
}))

const { notasLlamadaDe, agregarNotaLlamada } = await import('./notasLlamada')

function filaCruda(extra: Record<string, unknown> = {}) {
  return {
    id: 'nota-1',
    usuario_id: 'u-1',
    coach_id: 'u-manuela',
    fecha: '2026-10-08',
    hora: '18:30',
    conclusiones: 'Se sintió bien con la sentadilla, le cuesta el desayuno antes de entrenar.',
    proxima_reunion: 'en 2 semanas',
    creado_en: '2026-10-08T23:30:00Z',
    ...extra,
  }
}

beforeEach(() => {
  estado.activo = true
  estado.filasSelect = []
  estado.errorSelect = null
  estado.filaInsertada = null
  estado.errorInsert = null
  estado.ultimoInsert = null
  vi.resetAllMocks()
})

describe('notasLlamadaDe', () => {
  it('trae las notas y las pasa a camelCase', async () => {
    estado.filasSelect = [filaCruda()]
    const notas = await notasLlamadaDe('u-1')
    expect(notas).toEqual([
      {
        id: 'nota-1',
        usuarioId: 'u-1',
        coachId: 'u-manuela',
        fecha: '2026-10-08',
        hora: '18:30',
        conclusiones: 'Se sintió bien con la sentadilla, le cuesta el desayuno antes de entrenar.',
        proximaReunion: 'en 2 semanas',
        creadoEn: '2026-10-08T23:30:00Z',
      },
    ])
  })

  it('sin conexión, sin usuario o con error de la base: lista vacía, nunca lanza', async () => {
    expect(await notasLlamadaDe('')).toEqual([])
    estado.activo = false
    expect(await notasLlamadaDe('u-1')).toEqual([])
    estado.activo = true
    estado.errorSelect = { message: 'boom' }
    expect(await notasLlamadaDe('u-1')).toEqual([])
  })
})

describe('agregarNotaLlamada', () => {
  it('manda fecha/hora/conclusiones/proxima_reunion, NUNCA coach_id: lo pone la columna', async () => {
    estado.filaInsertada = filaCruda()
    const resultado = await agregarNotaLlamada('u-1', {
      fecha: '2026-10-08',
      hora: '18:30',
      conclusiones: 'Se sintió bien con la sentadilla, le cuesta el desayuno antes de entrenar.',
      proximaReunion: 'en 2 semanas',
    })
    expect(resultado.ok).toBe(true)
    expect(estado.ultimoInsert).toEqual({
      usuario_id: 'u-1',
      fecha: '2026-10-08',
      hora: '18:30',
      conclusiones: 'Se sintió bien con la sentadilla, le cuesta el desayuno antes de entrenar.',
      proxima_reunion: 'en 2 semanas',
    })
    expect('coach_id' in (estado.ultimoInsert as object)).toBe(false)
  })

  it('hora y próxima reunión son opcionales: viajan null, no se omiten', async () => {
    estado.filaInsertada = filaCruda({ hora: null, proxima_reunion: null })
    await agregarNotaLlamada('u-1', { fecha: '2026-10-08', conclusiones: 'Llamada corta.' })
    expect(estado.ultimoInsert).toEqual({
      usuario_id: 'u-1',
      fecha: '2026-10-08',
      hora: null,
      conclusiones: 'Llamada corta.',
      proxima_reunion: null,
    })
  })

  it('sin conclusiones, ni siquiera llama a la base', async () => {
    const resultado = await agregarNotaLlamada('u-1', { fecha: '2026-10-08', conclusiones: '   ' })
    expect(resultado).toEqual({ ok: false, error: 'Escribe qué se habló en la llamada.' })
    expect(estado.ultimoInsert).toBeNull()
  })

  it('sin permiso, da el mensaje en español, no el código crudo', async () => {
    estado.errorInsert = { message: 'permission denied', code: '42501' }
    const resultado = await agregarNotaLlamada('u-1', { fecha: '2026-10-08', conclusiones: 'Algo.' })
    expect(resultado).toEqual({ ok: false, error: 'No tienes permiso para anotar llamadas de este asesorado.' })
  })

  it('sin conexión, ni siquiera llama a la base', async () => {
    estado.activo = false
    const resultado = await agregarNotaLlamada('u-1', { fecha: '2026-10-08', conclusiones: 'Algo.' })
    expect(resultado).toEqual({ ok: false, error: 'Sin conexión con la base: esto es un demo.' })
    expect(estado.ultimoInsert).toBeNull()
  })
})
