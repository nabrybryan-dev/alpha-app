import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Corregir y borrar una nota (0114). Archivo aparte de `notasLlamada.test.ts` porque su doble
 * de Supabase es otro: aquí las cadenas son `update().eq().select()` y `delete().eq().select()`.
 * El doble registra lo que llega, para que una prueba no pase mirando solo lo que devuelve.
 */
const estado = {
  activo: true,
  filas: [] as unknown[],
  error: null as { message: string; code?: string } | null,
  excepcion: false,
  updates: [] as unknown[],
  borrados: 0,
  eqs: [] as unknown[][],
}

const FILA = {
  id: 'n-1',
  usuario_id: 'u-1',
  coach_id: 'c-1',
  fecha: '2026-10-08',
  hora: '18:30:00',
  conclusiones: 'Corregida.',
  tareas: null,
  proxima_reunion: null,
  creado_en: '2026-10-08T23:30:00Z',
}

vi.mock('../supabase', () => ({
  get modoNube() {
    return estado.activo
  },
  supabase: () => ({
    from: () => {
      const final = {
        eq: (...args: unknown[]) => {
          estado.eqs.push(args)
          return {
            select: () => {
              if (estado.excepcion) return Promise.reject(new Error('Failed to fetch'))
              return Promise.resolve({ data: estado.error ? null : estado.filas, error: estado.error })
            },
          }
        },
      }
      return {
        update: (cambios: unknown) => {
          estado.updates.push(cambios)
          return final
        },
        delete: () => {
          estado.borrados += 1
          return final
        },
      }
    },
  }),
}))

const { borrarNotaLlamada, corregirNotaLlamada } = await import('./notasLlamada')

beforeEach(() => {
  estado.activo = true
  estado.filas = [FILA]
  estado.error = null
  estado.excepcion = false
  estado.updates = []
  estado.borrados = 0
  estado.eqs = []
})

describe('corregirNotaLlamada', () => {
  const NOTA = { fecha: '2026-10-08', hora: '18:30', conclusiones: '  Corregida.  ', tareas: '', proximaReunion: '' }

  it('manda solo las cinco columnas del texto, a la nota que se pidió', async () => {
    const r = await corregirNotaLlamada('n-1', NOTA)
    expect(r).toMatchObject({ ok: true, nota: { id: 'n-1', conclusiones: 'Corregida.' } })
    expect(estado.eqs).toEqual([['id', 'n-1']])
    expect(estado.updates).toEqual([
      { fecha: '2026-10-08', hora: '18:30', conclusiones: 'Corregida.', tareas: null, proxima_reunion: null },
    ])
    // Una corrección no cambia de quién es la llamada ni quién la anotó.
    expect(Object.keys(estado.updates[0] as object)).not.toContain('coach_id')
    expect(Object.keys(estado.updates[0] as object)).not.toContain('usuario_id')
  })

  it('si la base no toca ninguna fila (la nota es de otro), lo dice en vez de dar por corregido', async () => {
    estado.filas = []
    expect(await corregirNotaLlamada('n-1', NOTA)).toEqual({
      ok: false,
      error: 'Solo puedes corregir las notas que anotaste tú.',
    })
  })

  it('sin texto o sin fecha no llama a la base', async () => {
    expect((await corregirNotaLlamada('n-1', { ...NOTA, conclusiones: '  ' })).ok).toBe(false)
    expect((await corregirNotaLlamada('n-1', { ...NOTA, fecha: '' })).ok).toBe(false)
    expect(estado.updates).toEqual([])
  })

  it('un error de la base o de la red da un mensaje en español, no el crudo', async () => {
    estado.error = { message: 'permission denied for table notas_llamada', code: '42501' }
    expect(await corregirNotaLlamada('n-1', NOTA)).toEqual({
      ok: false,
      error: 'No tienes permiso para anotar llamadas de este asesorado.',
    })
    estado.error = null
    estado.excepcion = true
    expect(await corregirNotaLlamada('n-1', NOTA)).toEqual({
      ok: false,
      error: 'Sin conexión: la nota no se guardó. Vuelve a intentarlo.',
    })
  })
})

describe('borrarNotaLlamada', () => {
  it('borra la nota que se pidió', async () => {
    expect(await borrarNotaLlamada('n-1')).toEqual({ ok: true })
    expect(estado.borrados).toBe(1)
    expect(estado.eqs).toEqual([['id', 'n-1']])
  })

  it('si la base no borra ninguna fila (la nota es de otro), lo dice', async () => {
    estado.filas = []
    expect(await borrarNotaLlamada('n-1')).toEqual({ ok: false, error: 'Solo puedes borrar las notas que anotaste tú.' })
  })

  it('sin modo nube no toca la base', async () => {
    estado.activo = false
    expect((await borrarNotaLlamada('n-1')).ok).toBe(false)
    expect(estado.borrados).toBe(0)
  })

  it('un fallo de red se dice como tal', async () => {
    estado.excepcion = true
    expect(await borrarNotaLlamada('n-1')).toEqual({
      ok: false,
      error: 'Sin conexión: la nota no se borró. Vuelve a intentarlo.',
    })
  })
})
