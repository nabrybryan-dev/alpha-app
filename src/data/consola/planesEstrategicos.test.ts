import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  COLUMNAS_PLANES_ESTRATEGICOS,
  historialDePlanes,
  planVigente,
  TABLA_PLANES_ESTRATEGICOS,
} from './planesEstrategicos'

const MIGRACION = join(process.cwd(), 'supabase', 'migrations', '0083_consola_servidor_y_permisos.sql')

describe('el nombre de las columnas sale de la migración 0083, no se inventa aquí', () => {
  it('cada columna que se pide con select() existe de verdad en la tabla planes_estrategicos', () => {
    const sql = readFileSync(MIGRACION, 'utf8')
    const bloque = sql.slice(
      sql.indexOf('create table if not exists public.planes_estrategicos'),
      sql.indexOf('comment on table public.planes_estrategicos'),
    )
    expect(bloque.length).toBeGreaterThan(0)
    for (const columna of COLUMNAS_PLANES_ESTRATEGICOS) {
      expect(bloque, `la migración 0083 no declara la columna "${columna}"`).toMatch(
        new RegExp(`\\b${columna}\\b`),
      )
    }
  })

  it('el único vigente por persona lo garantiza un índice, no este archivo', () => {
    const sql = readFileSync(MIGRACION, 'utf8')
    expect(sql).toContain('planes_estrategicos_un_vigente_por_persona')
    expect(sql).toMatch(/create unique index[^;]*planes_estrategicos[^;]*where\s+vigente/i)
  })

  it('la tabla que se consulta es la que crea la migración', () => {
    const sql = readFileSync(MIGRACION, 'utf8')
    expect(sql).toContain(`create table if not exists public.${TABLA_PLANES_ESTRATEGICOS}`)
  })
})

const filaVigente = {
  id: 'plan-1',
  usuario_id: 'u-1',
  version: 2,
  vigente: true,
  contenido: { objetivo: 'hipertrofia' },
  hash: 'hash-v2',
  creado_en: '2026-09-28T12:00:00Z',
}

let filaUnica: typeof filaVigente | null
let filas: (typeof filaVigente)[]
let errorPropio: { code: string; message: string } | null
let usuarioFiltrado: string | undefined
let vigenteFiltrado: boolean | undefined
let columnasPedidas: string | undefined
let ordenPedido: { columna: string; ascending: boolean } | undefined

vi.mock('../supabase', () => ({
  modoNube: true,
  supabase: () => ({
    from: (tabla: string) => {
      expect(tabla).toBe('planes_estrategicos')
      return {
        select: (columnas: string) => {
          columnasPedidas = columnas
          return {
            eq: (columna: string, valor: unknown) => {
              if (columna === 'usuario_id') usuarioFiltrado = valor as string
              return {
                eq: (columna2: string, valor2: unknown) => {
                  if (columna2 === 'vigente') vigenteFiltrado = valor2 as boolean
                  return { maybeSingle: () => Promise.resolve({ data: filaUnica, error: errorPropio }) }
                },
                order: (columna2: string, opts: { ascending: boolean }) => {
                  ordenPedido = { columna: columna2, ascending: opts.ascending }
                  return Promise.resolve({ data: filas, error: errorPropio })
                },
              }
            },
          }
        },
      }
    },
  }),
}))

describe('planVigente: el propio, filtrado por vigente=true, sin lanzar nunca', () => {
  beforeEach(() => {
    filaUnica = filaVigente
    errorPropio = null
    usuarioFiltrado = undefined
    vigenteFiltrado = undefined
    columnasPedidas = undefined
  })

  it('pide exactamente las columnas declaradas', async () => {
    await planVigente('u-1')
    expect(columnasPedidas).toBe(COLUMNAS_PLANES_ESTRATEGICOS.join(','))
  })

  it('filtra por SU usuario_id y por vigente=true', async () => {
    await planVigente('u-especifico')
    expect(usuarioFiltrado).toBe('u-especifico')
    expect(vigenteFiltrado).toBe(true)
  })

  it('traduce la fila a camelCase', async () => {
    const plan = await planVigente('u-1')
    expect(plan).toEqual({
      id: 'plan-1',
      usuarioId: 'u-1',
      version: 2,
      vigente: true,
      contenido: { objetivo: 'hipertrofia' },
      hash: 'hash-v2',
      creadoEn: '2026-09-28T12:00:00Z',
    })
  })

  it('sin fila (nadie tiene plan vigente todavía) da null, no lanza', async () => {
    filaUnica = null
    await expect(planVigente('u-1')).resolves.toBeNull()
  })

  it('ante un error de la base da null, nunca lanza', async () => {
    errorPropio = { code: '42P01', message: 'relation "planes_estrategicos" does not exist' }
    await expect(planVigente('u-1')).resolves.toBeNull()
  })

  it('sin usuarioId no consulta nada', async () => {
    await planVigente('')
    expect(columnasPedidas).toBeUndefined()
  })
})

describe('historialDePlanes: todas las versiones, de más reciente a más vieja', () => {
  beforeEach(() => {
    filas = [filaVigente, { ...filaVigente, id: 'plan-0', version: 1, vigente: false, hash: 'hash-v1' }]
    errorPropio = null
    ordenPedido = undefined
  })

  it('ordena por version descendente', async () => {
    await historialDePlanes('u-1')
    expect(ordenPedido).toEqual({ columna: 'version', ascending: false })
  })

  it('devuelve todas las versiones traducidas', async () => {
    const historial = await historialDePlanes('u-1')
    expect(historial.map((p) => p.version)).toEqual([2, 1])
    expect(historial.map((p) => p.vigente)).toEqual([true, false])
  })

  it('devuelve [] ante un error, nunca lanza', async () => {
    errorPropio = { code: '42P01', message: 'no existe' }
    await expect(historialDePlanes('u-1')).resolves.toEqual([])
  })
})
