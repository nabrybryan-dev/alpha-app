import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const estado = {
  activo: true,
  tablas: {} as Record<string, { data: unknown; error: { message: string } | null }>,
  rpc: { data: 'nuevo-id' as unknown, error: null as { message: string } | null },
  llamadas: [] as { nombre: string; args: unknown }[],
}

vi.mock('../supabase', () => {
  const consulta = (tabla: string) => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'order', 'limit', 'in']) q[m] = () => q
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
      Promise.resolve(estado.tablas[tabla] ?? { data: [], error: null }).then(ok, ko)
    return q
  }
  return {
    get modoNube() {
      return estado.activo
    },
    supabase: () => ({
      from: (tabla: string) => consulta(tabla),
      rpc: (nombre: string, args: unknown) => {
        estado.llamadas.push({ nombre, args })
        return Promise.resolve(estado.rpc)
      },
    }),
  }
})

const {
  COLUMNAS_COMENTARIOS_HALLAZGO,
  COLUMNAS_HALLAZGOS,
  PARAMETROS_COMENTAR_HALLAZGO,
  TABLA_COMENTARIOS_HALLAZGO,
  TABLA_HALLAZGOS,
  comentarHallazgo,
  esTablaAusente0103,
  hallazgosDeMercadeo,
} = await import('./mercadeoHallazgos')

const SQL = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0103_mercadeo_hallazgos.sql'), 'utf8')

function columnasDe(tabla: string): string[] {
  const inicio = SQL.indexOf(`create table if not exists public.${tabla} (`)
  expect(inicio, `la 0103 no crea ${tabla}`).toBeGreaterThan(0)
  return SQL.slice(inicio, SQL.indexOf('\n);\n', inicio))
    .split('\n')
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => /^[a-z_]+\s/.test(l) && !/^(unique|constraint|check)\b/.test(l))
    .map((l) => l.split(/\s+/)[0])
}

const fh = (o: Record<string, unknown> = {}) => ({
  id: 'h1', codigo: 'H-01', tipo: 'hook', titulo: 'Un hook', resumen: 'Resumen', fuente_nombre: null, fuente_url: null,
  fuente_fecha: null, estado: 'nuevo', ...o,
})
const fc = (o: Record<string, unknown> = {}) => ({
  id: 'c1', hallazgo_id: 'h1', autor: 'manuela', texto: 'Hola', en_respuesta_a: null, creado_en: '2026-09-30T10:00:00Z', ...o,
})

beforeEach(() => {
  estado.activo = true
  estado.tablas = {}
  estado.rpc = { data: 'nuevo-id', error: null }
  estado.llamadas = []
})

describe('columnas y parámetros contra la 0103', () => {
  it('las columnas que la app pide existen en las tablas de la migración', () => {
    const h = columnasDe('mercadeo_hallazgos')
    for (const c of COLUMNAS_HALLAZGOS) expect(h, `mercadeo_hallazgos.${c}`).toContain(c)
    const k = columnasDe('mercadeo_hallazgo_comentarios')
    for (const c of COLUMNAS_COMENTARIOS_HALLAZGO) expect(k, `mercadeo_hallazgo_comentarios.${c}`).toContain(c)
    expect(TABLA_HALLAZGOS).toBe('mercadeo_hallazgos')
    expect(TABLA_COMENTARIOS_HALLAZGO).toBe('mercadeo_hallazgo_comentarios')
  })
  it('el RPC de comentar tiene los parámetros que la app manda', () => {
    const inicio = SQL.indexOf('create or replace function public.comentar_hallazgo_mercadeo(')
    const firma = SQL.slice(inicio, SQL.indexOf('\nreturns', inicio))
    expect([...firma.matchAll(/(p_[a-z_]+)\s/g)].map((m) => m[1])).toEqual([...PARAMETROS_COMENTAR_HALLAZGO])
  })
  it('la migración cierra la puerta: revoke antes de grant, RLS y nada de escritura para authenticated', () => {
    expect(SQL).toMatch(/revoke all on public\.mercadeo_hallazgos from anon, authenticated, public/)
    expect(SQL).toMatch(/revoke all on public\.mercadeo_hallazgo_comentarios from anon, authenticated, public/)
    expect(SQL).toMatch(/grant select on public\.mercadeo_hallazgos to authenticated/)
    expect(SQL).not.toMatch(/grant (insert|update|delete|all) on public\.mercadeo_hallazgo[a-z_]* to authenticated/)
  })
})

describe('hallazgosDeMercadeo', () => {
  it('sin nube: vacío confirmado, sin consulta', async () => {
    estado.activo = false
    expect(await hallazgosDeMercadeo()).toEqual({ ok: true, datos: [] })
  })
  it('trae los hallazgos con su hilo', async () => {
    estado.tablas[TABLA_HALLAZGOS] = { data: [fh()], error: null }
    estado.tablas[TABLA_COMENTARIOS_HALLAZGO] = { data: [fc(), fc({ id: 'c2', autor: 'agente', en_respuesta_a: 'c1' })], error: null }
    const r = await hallazgosDeMercadeo()
    expect(r.ok && r.datos[0].comentarios.map((c) => c.autor)).toEqual(['manuela', 'agente'])
    expect(r.ok && r.datos[0].comentarios[1].enRespuestaA).toBe('c1')
  })
  it('un fallo es un fallo, no una lista vacía', async () => {
    estado.tablas[TABLA_HALLAZGOS] = { data: null, error: { message: 'RLS' } }
    expect(await hallazgosDeMercadeo()).toEqual({ ok: false, error: 'RLS' })
  })
  it('un tipo o un autor que la app no conoce no se descarta en silencio', async () => {
    estado.tablas[TABLA_HALLAZGOS] = { data: [fh({ tipo: 'meme' })], error: null }
    expect((await hallazgosDeMercadeo()).ok).toBe(false)
    estado.tablas[TABLA_HALLAZGOS] = { data: [fh()], error: null }
    estado.tablas[TABLA_COMENTARIOS_HALLAZGO] = { data: [fc({ autor: 'otro' })], error: null }
    expect((await hallazgosDeMercadeo()).ok).toBe(false)
  })
  it('la tabla ausente se reconoce para decir «pendiente»', () => {
    expect(esTablaAusente0103('relation "public.mercadeo_hallazgos" does not exist')).toBe(true)
    expect(esTablaAusente0103('permission denied')).toBe(false)
  })
})

describe('comentarHallazgo', () => {
  it('llama al RPC con los parámetros de la migración', async () => {
    const r = await comentarHallazgo('h1', 'Probémoslo')
    expect(r).toEqual({ ok: true, id: 'nuevo-id' })
    expect(estado.llamadas).toEqual([{ nombre: 'comentar_hallazgo_mercadeo', args: { p_hallazgo_id: 'h1', p_texto: 'Probémoslo' } }])
  })
  it('lo que rechaza la base se dice, no se esconde', async () => {
    estado.rpc = { data: null, error: { message: 'ese hallazgo está descartado' } }
    expect(await comentarHallazgo('h1', 'x')).toEqual({ ok: false, error: 'ese hallazgo está descartado' })
  })
  it('sin nube no escribe', async () => {
    estado.activo = false
    expect((await comentarHallazgo('h1', 'x')).ok).toBe(false)
    expect(estado.llamadas).toEqual([])
  })
})
