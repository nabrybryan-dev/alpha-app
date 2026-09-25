import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const MIGRACION = join(process.cwd(), 'supabase', 'migrations', '0083_consola_servidor_y_permisos.sql')

interface FilaError {
  message: string
}

const estado = {
  activo: true,
  filas: [] as unknown[],
  error: null as FilaError | null,
  usuarioPedido: undefined as string | undefined,
}

function cliente() {
  return {
    from: (tabla: string) => {
      if (tabla !== 'capacidades_staff') throw new Error(`tabla inesperada: ${tabla}`)
      return {
        select: () => ({
          eq: (_columna: string, valor: string) => {
            estado.usuarioPedido = valor
            return Promise.resolve({ data: estado.filas, error: estado.error })
          },
        }),
      }
    },
  }
}

vi.mock('../supabase', () => ({
  get modoNube() {
    return estado.activo
  },
  supabase: () => cliente(),
}))

const { CAPACIDADES, capacidadesDe } = await import('./capacidadesStaff')

beforeEach(() => {
  estado.activo = true
  estado.filas = []
  estado.error = null
  estado.usuarioPedido = undefined
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CAPACIDADES sale del mismo vocabulario que el `check` de la migración 0083', () => {
  it('cada capacidad declarada aquí existe en el `check` de la migración', () => {
    const sql = readFileSync(MIGRACION, 'utf8')
    const bloque = sql.slice(
      sql.indexOf('create table if not exists public.capacidades_staff'),
      sql.indexOf('primary key (usuario_id, capacidad)'),
    )
    expect(bloque.length).toBeGreaterThan(0)
    for (const capacidad of CAPACIDADES) {
      expect(bloque, `la migración 0083 no declara la capacidad "${capacidad}"`).toContain(`'${capacidad}'`)
    }
  })
})

describe('capacidadesDe', () => {
  it('en modo demo no consulta nada', async () => {
    estado.activo = false
    await expect(capacidadesDe('u-1')).resolves.toEqual([])
  })

  it('sin usuarioId no consulta nada', async () => {
    await expect(capacidadesDe('')).resolves.toEqual([])
  })

  it('filtra por SU usuario_id', async () => {
    estado.filas = []
    await capacidadesDe('u-especifico')
    expect(estado.usuarioPedido).toBe('u-especifico')
  })

  it('devuelve la lista de capacidades de las filas', async () => {
    estado.filas = [{ capacidad: 'detener_publicacion' }, { capacidad: 'reportar_riesgo' }]
    await expect(capacidadesDe('u-1')).resolves.toEqual(['detener_publicacion', 'reportar_riesgo'])
  })

  it('descarta una capacidad que no reconoce, en vez de colarla disfrazada de válida', async () => {
    estado.filas = [{ capacidad: 'detener_publicacion' }, { capacidad: 'inventada' }]
    await expect(capacidadesDe('u-1')).resolves.toEqual(['detener_publicacion'])
  })

  it('ante un error de la base devuelve [], nunca lanza', async () => {
    estado.error = { message: 'RLS' }
    await expect(capacidadesDe('u-1')).resolves.toEqual([])
  })
})
