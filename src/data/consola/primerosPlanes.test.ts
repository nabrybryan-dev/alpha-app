import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const MIGRACION = join(process.cwd(), 'supabase', 'migrations', '0086_aprobacion_primer_plan.sql')

const estado = {
  activo: true,
  filas: [] as unknown[],
  error: null as { message: string; code?: string } | null,
  rpcArgs: undefined as unknown,
  rpcRespuesta: { data: null as unknown, error: null as { message: string; code?: string } | null },
  estadosPedidos: undefined as unknown,
}

vi.mock('../supabase', () => ({
  get modoNube() {
    return estado.activo
  },
  supabase: () => ({
    from: () => ({
      select: () => ({
        in: (_c: string, valores: unknown) => {
          estado.estadosPedidos = valores
          return { order: () => Promise.resolve({ data: estado.filas, error: estado.error }) }
        },
      }),
    }),
    rpc: (nombre: string, args: unknown) => {
      estado.rpcArgs = { nombre, args }
      return Promise.resolve(estado.rpcRespuesta)
    },
  }),
}))

const { COLUMNAS_PRIMER_PLAN, aPrimerPlan, decidirPrimerPlan, primerosPlanesPendientes } = await import('./primerosPlanes')

const filaBase = {
  id: 'ap-1',
  usuario_id: 'u-1',
  microciclo_id: 'm-1',
  estado: 'propuesto',
  riesgo: 'bajo',
  motivo_riesgo: null,
  dudas_pendientes: [],
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
})

describe('las columnas salen del create table de la 0086', () => {
  it('cada columna declarada aquí existe en la migración', () => {
    const sql = readFileSync(MIGRACION, 'utf8')
    const bloque = sql.slice(sql.indexOf('create table if not exists public.aprobaciones_primer_plan'), sql.indexOf('comment on table public.aprobaciones_primer_plan'))
    for (const columna of COLUMNAS_PRIMER_PLAN) expect(bloque, columna).toMatch(new RegExp(`\\n\\s+${columna}\\s`))
  })
})

describe('aPrimerPlan', () => {
  it('descarta un estado o un riesgo desconocido', () => {
    expect(aPrimerPlan({ ...filaBase, estado: 'inventado' })).toBeNull()
    expect(aPrimerPlan({ ...filaBase, riesgo: 'altisimo' })).toBeNull()
  })

  it('dudas nulas se leen como lista vacía', () => {
    expect(aPrimerPlan({ ...filaBase, dudas_pendientes: null })?.dudasPendientes).toEqual([])
  })
})

describe('primerosPlanesPendientes', () => {
  it('en demo no consulta', async () => {
    estado.activo = false
    await expect(primerosPlanesPendientes()).resolves.toEqual([])
  })

  it('pide solo los pendientes', async () => {
    estado.filas = [filaBase]
    const lista = await primerosPlanesPendientes()
    expect(estado.estadosPedidos).toEqual(['propuesto', 'espera_bryan'])
    expect(lista.map((p) => p.id)).toEqual(['ap-1'])
  })

  it('ante un error devuelve [], nunca lanza', async () => {
    estado.error = { message: 'RLS' }
    await expect(primerosPlanesPendientes()).resolves.toEqual([])
  })
})

describe('decidirPrimerPlan', () => {
  it('rechazar sin motivo no llega a la red', async () => {
    const r = await decidirPrimerPlan('ap-1', 'rechazar', '   ')
    expect(r.ok).toBe(false)
    expect(estado.rpcArgs).toBeUndefined()
  })

  it('llama a la RPC con los nombres de la 0086 y devuelve la fila', async () => {
    estado.rpcRespuesta = { data: { ...filaBase, estado: 'aprobado' }, error: null }
    const r = await decidirPrimerPlan('ap-1', 'aprobar', '')
    expect(estado.rpcArgs).toEqual({ nombre: 'decidir_primer_plan', args: { aprobacion_id: 'ap-1', decision: 'aprobar', motivo: null } })
    expect(r.ok && r.plan.estado).toBe('aprobado')
  })

  it('traduce el rechazo del servidor en un mensaje', async () => {
    estado.rpcRespuesta = { data: null, error: { code: '42501', message: 'Este plan lo aprueba Bryan (riesgo alto, estado propuesto)' } }
    const r = await decidirPrimerPlan('ap-1', 'aprobar', '')
    expect(r).toEqual({ ok: false, error: 'Este plan lo aprueba Bryan (riesgo alto, estado propuesto)' })
  })
})
