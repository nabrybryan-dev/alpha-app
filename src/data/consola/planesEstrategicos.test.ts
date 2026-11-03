import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  COLUMNAS_PLANES_ESTRATEGICOS,
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
let errorPropio: { code: string; message: string } | null
let usuarioFiltrado: string | undefined
let vigenteFiltrado: boolean | undefined
let columnasPedidas: string | undefined

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
