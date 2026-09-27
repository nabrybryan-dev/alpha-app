import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const MIGRACION = join(process.cwd(), 'supabase', 'migrations', '0087_aprobacion_plan_estrategico_renovado.sql')

const estado = {
  activo: true,
  filas: [] as unknown[],
  error: null as { message: string; code?: string } | null,
  rpcArgs: undefined as unknown,
  rpcRespuesta: { data: null as unknown, error: null as { message: string; code?: string } | null },
  estadosPedidos: undefined as unknown,
  filtroOr: undefined as string | undefined,
  tabla: undefined as string | undefined,
}

vi.mock('../supabase', () => ({
  get modoNube() {
    return estado.activo
  },
  supabase: () => ({
    from: (tabla: string) => {
      estado.tabla = tabla
      return {
        select: () => ({
          in: (_c: string, valores: unknown) => {
            estado.estadosPedidos = valores
            return { order: () => Promise.resolve({ data: estado.filas, error: estado.error }) }
          },
          eq: () => ({
            or: (filtro: string) => {
              estado.filtroOr = filtro
              return Promise.resolve({ data: estado.filas, error: estado.error })
            },
          }),
        }),
      }
    },
    rpc: (nombre: string, args: unknown) => {
      estado.rpcArgs = { nombre, args }
      return Promise.resolve(estado.rpcRespuesta)
    },
  }),
}))

const { COLUMNAS_PLAN_RENOVADO, aPlanRenovado, borradorYVigente, decidirPlanEstrategico, planesRenovadosPendientes } =
  await import('./planesRenovados')

const filaBase = {
  id: 'ape-1',
  usuario_id: 'u-1',
  plan_id: 'p-2',
  hash: 'h2',
  estado: 'propuesto',
  riesgo: 'bajo',
  clinico: false,
  motivo_riesgo: null,
  dudas_pendientes: [],
  justificacion: [{ decision: 'x', evidencia: 'y' }],
  supuestos: [],
  preguntas_para_bryan: [],
  plazo_hasta: '2026-09-28T12:00:00Z',
  decidido_por: null,
  motivo: null,
  decidido_en: null,
  motivo_espera: null,
  creado_en: '2026-09-26T12:00:00Z',
  actualizado_en: '2026-09-26T12:00:00Z',
}

beforeEach(() => {
  estado.activo = true
  estado.filas = []
  estado.error = null
  estado.rpcArgs = undefined
  estado.rpcRespuesta = { data: null, error: null }
  estado.estadosPedidos = undefined
  estado.filtroOr = undefined
})

describe('las columnas salen de la 0087', () => {
  it('cada columna pedida existe en el create table de aprobaciones_plan_estrategico', () => {
    const sql = readFileSync(MIGRACION, 'utf8')
    const bloque = sql.slice(
      sql.indexOf('create table if not exists public.aprobaciones_plan_estrategico'),
      sql.indexOf('comment on table public.aprobaciones_plan_estrategico'),
    )
    expect(bloque.length).toBeGreaterThan(0)
    for (const c of COLUMNAS_PLAN_RENOVADO) {
      expect(bloque, `la 0087 no declara "${c}"`).toMatch(new RegExp(`^\\s+${c}\\s`, 'm'))
    }
  })
})

describe('aPlanRenovado', () => {
  it('traduce la fila y descarta formas inesperadas', () => {
    expect(aPlanRenovado(filaBase)).toMatchObject({ id: 'ape-1', planId: 'p-2', clinico: false, riesgo: 'bajo' })
    expect(aPlanRenovado({ ...filaBase, estado: 'raro' })).toBeNull()
    expect(aPlanRenovado({ ...filaBase, riesgo: 'enorme' })).toBeNull()
  })

  it('un clínico sin valor se trata como clínico (lo conservador)', () => {
    expect(aPlanRenovado({ ...filaBase, clinico: null })?.clinico).toBe(true)
  })
})

describe('planesRenovadosPendientes', () => {
  it('pide solo los pendientes y nunca lanza', async () => {
    estado.filas = [filaBase, { ...filaBase, id: 'mala', estado: '??' }]
    const lista = await planesRenovadosPendientes()
    expect(estado.tabla).toBe('aprobaciones_plan_estrategico')
    expect(estado.estadosPedidos).toEqual(['propuesto', 'espera_bryan'])
    expect(lista.map((p) => p.id)).toEqual(['ape-1'])
    estado.error = { message: 'rls' }
    expect(await planesRenovadosPendientes()).toEqual([])
    estado.activo = false
    expect(await planesRenovadosPendientes()).toEqual([])
  })
})

describe('borradorYVigente', () => {
  it('separa el borrador del vigente en una sola consulta', async () => {
    estado.filas = [
      { id: 'p-1', version: 1, vigente: true, contenido: { a: 1 } },
      { id: 'p-2', version: 2, vigente: false, contenido: { a: 2 } },
    ]
    const r = await borradorYVigente('u-1', 'p-2')
    expect(estado.tabla).toBe('planes_estrategicos')
    expect(estado.filtroOr).toBe('id.eq.p-2,vigente.eq.true')
    expect(r).toEqual({
      ok: true,
      datos: { borrador: { version: 2, contenido: { a: 2 } }, vigente: { version: 1, contenido: { a: 1 } } },
    })
  })

  it('sin borrador, error; sin vigente, null', async () => {
    estado.filas = [{ id: 'p-2', version: 1, vigente: false, contenido: {} }]
    expect(await borradorYVigente('u-1', 'p-2')).toMatchObject({ ok: true, datos: { vigente: null } })
    estado.filas = []
    expect(await borradorYVigente('u-1', 'p-2')).toMatchObject({ ok: false })
  })
})

describe('decidirPlanEstrategico', () => {
  it('rechazar sin motivo no llama a la base', async () => {
    expect(await decidirPlanEstrategico('ape-1', 'rechazar', '  ')).toEqual({ ok: false, error: 'Escribe el motivo del rechazo.' })
    expect(estado.rpcArgs).toBeUndefined()
  })

  it('llama a la RPC con el motivo limpio y devuelve la fila', async () => {
    estado.rpcRespuesta = { data: { ...filaBase, estado: 'aprobado' }, error: null }
    const r = await decidirPlanEstrategico('ape-1', 'aprobar', '  ok  ')
    expect(estado.rpcArgs).toEqual({ nombre: 'decidir_plan_estrategico', args: { aprobacion_id: 'ape-1', decision: 'aprobar', motivo: 'ok' } })
    expect(r).toMatchObject({ ok: true, plan: { estado: 'aprobado' } })
  })

  it('el permiso denegado se dice tal cual', async () => {
    estado.rpcRespuesta = { data: null, error: { code: '42501', message: 'Este plan lo aprueba Bryan' } }
    expect(await decidirPlanEstrategico('ape-1', 'aprobar', '')).toEqual({ ok: false, error: 'Este plan lo aprueba Bryan' })
  })
})
