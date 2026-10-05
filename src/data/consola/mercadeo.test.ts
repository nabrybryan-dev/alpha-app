import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const estado = {
  activo: true,
  tablas: {} as Record<string, { data: unknown; error: { message: string } | null }>,
  rpc: { data: null as unknown, error: null as { message: string } | null },
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
  COLUMNAS_MERCADEO_PREGUNTAS,
  COLUMNAS_MERCADEO_REFERENCIAS,
  PARAMETROS_MOVER_REGLA,
  PARAMETROS_RESPONDER_BUZON,
  moverRegla,
  preguntasDeMercadeo,
  responderBuzon,
} = await import('./mercadeo')

const SQL = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0096_buzon_mercadeo.sql'), 'utf8')

function columnasDe(tabla: string): string[] {
  const inicio = SQL.indexOf(`create table if not exists public.${tabla} (`)
  expect(inicio, `la 0096 no crea ${tabla}`).toBeGreaterThan(0)
  return SQL.slice(inicio, SQL.indexOf('\n);\n', inicio))
    .split('\n')
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => /^[a-z_]+\s/.test(l) && !/^(unique|constraint|check)\b/.test(l))
    .map((l) => l.split(/\s+/)[0])
}

const parametros = (funcion: string, retorno: string) => {
  const inicio = SQL.indexOf(`create or replace function public.${funcion}(`)
  return [...SQL.slice(inicio, SQL.indexOf(`)\nreturns ${retorno}`, inicio)).matchAll(/^\s+(p_[a-z_]+)\s/gm)].map((m) => m[1])
}

describe('las columnas y los parámetros salen de la migración 0096', () => {
  it('las columnas de preguntas que se leen existen en la tabla', () => {
    const enLaTabla = columnasDe('mercadeo_preguntas')
    for (const c of COLUMNAS_MERCADEO_PREGUNTAS) expect(enLaTabla, `«${c}» no está en mercadeo_preguntas`).toContain(c)
  })
  it('las columnas de referencias que se leen existen en la tabla', () => {
    const enLaTabla = columnasDe('mercadeo_referencias')
    for (const c of COLUMNAS_MERCADEO_REFERENCIAS) expect(enLaTabla, `«${c}» no está en mercadeo_referencias`).toContain(c)
  })
  it('los parámetros de las dos RPC son los de las funciones, en su orden', () => {
    expect(parametros('responder_buzon_mercadeo', 'void')).toEqual([...PARAMETROS_RESPONDER_BUZON])
    expect(parametros('mover_regla_mercadeo', 'void')).toEqual([...PARAMETROS_MOVER_REGLA])
  })
})

const pregunta = {
  id: 'p-1', codigo: 'P-01', texto: '¿Qué creador corta mejor el ritmo?', tema: 'corte', uso: 'regla',
  destinataria_id: 'u-1', enviada_en: '2026-09-28T10:00:00Z', vence_en: '2026-10-05', estado: 'respondida',
  respuesta: 'Cortan al segundo 1.', respondida_en: '2026-09-29T10:00:00Z', regla_estado: 'sin_regla',
  regla_codigo: null, regla_enunciado: null, regla_vigente_desde: null, regla_revisar_antes_de: null,
}
const referencia = { id: 'r-1', pregunta_id: 'p-1', orden: 1, tipo: 'reel', url: 'https://instagram.com/reel/A/', url_normalizada: 'https://instagram.com/reel/A', nota: 'corte al segundo 1' }

beforeEach(() => {
  estado.activo = true
  estado.tablas = {}
  estado.rpc = { data: null, error: null }
  estado.llamadas = []
})

describe('preguntasDeMercadeo', () => {
  it('une cada pregunta con SUS referencias', async () => {
    estado.tablas.mercadeo_preguntas = { data: [pregunta, { ...pregunta, id: 'p-2', codigo: 'P-02' }], error: null }
    estado.tablas.mercadeo_referencias = { data: [referencia], error: null }
    const r = await preguntasDeMercadeo()
    expect(r.ok && r.datos.map((p) => [p.codigo, p.referencias.length])).toEqual([['P-01', 1], ['P-02', 0]])
  })
  it('sin nube, un vacío confirmado; sin preguntas, un vacío sin pedir referencias', async () => {
    estado.activo = false
    expect(await preguntasDeMercadeo()).toEqual({ ok: true, datos: [] })
    estado.activo = true
    estado.tablas.mercadeo_preguntas = { data: [], error: null }
    expect(await preguntasDeMercadeo()).toEqual({ ok: true, datos: [] })
  })
  it('un error al leer las preguntas o las referencias es un error, no un vacío', async () => {
    estado.tablas.mercadeo_preguntas = { data: null, error: { message: 'permiso denegado' } }
    expect(await preguntasDeMercadeo()).toEqual({ ok: false, error: 'permiso denegado' })
    estado.tablas.mercadeo_preguntas = { data: [pregunta], error: null }
    estado.tablas.mercadeo_referencias = { data: null, error: { message: 'referencias caídas' } }
    expect(await preguntasDeMercadeo()).toEqual({ ok: false, error: 'referencias caídas' })
  })
  it('un valor desconocido no se descarta en silencio', async () => {
    estado.tablas.mercadeo_preguntas = { data: [{ ...pregunta, regla_estado: 'inventada' }], error: null }
    estado.tablas.mercadeo_referencias = { data: [], error: null }
    expect((await preguntasDeMercadeo()).ok).toBe(false)
    estado.tablas.mercadeo_preguntas = { data: [pregunta], error: null }
    estado.tablas.mercadeo_referencias = { data: [{ ...referencia, tipo: 'inventado' }], error: null }
    expect((await preguntasDeMercadeo()).ok).toBe(false)
  })
})

describe('responder y mover la regla', () => {
  it('responder manda la pregunta, el texto y las referencias con los nombres de la función', async () => {
    const r = await responderBuzon('p-1', 'Cortan al segundo 1', [{ tipo: 'reel', url: 'https://a.com/1', nota: 'corte al segundo 1' }])
    expect(r.ok).toBe(true)
    expect(estado.llamadas[0]).toEqual({
      nombre: 'responder_buzon_mercadeo',
      args: {
        p_pregunta_id: 'p-1',
        p_texto: 'Cortan al segundo 1',
        p_referencias: [{ tipo: 'reel', url: 'https://a.com/1', nota: 'corte al segundo 1' }],
      },
    })
  })
  it('si la base rechaza, lo dice', async () => {
    estado.rpc = { data: null, error: { message: 'esa pregunta caducó' } }
    expect(await responderBuzon('p-1', 'tarde', [])).toEqual({ ok: false, error: 'esa pregunta caducó' })
  })
  it('mover la regla manda el estado y el enunciado', async () => {
    await moverRegla('p-1', 'vigente', 'Cortar al segundo 1')
    expect(estado.llamadas[0]).toEqual({
      nombre: 'mover_regla_mercadeo',
      args: { p_id: 'p-1', p_estado: 'vigente', p_enunciado: 'Cortar al segundo 1' },
    })
  })
  it('sin nube no escribe nada', async () => {
    estado.activo = false
    expect((await responderBuzon('p-1', 'x', [])).ok).toBe(false)
    expect((await moverRegla('p-1', 'retirada')).ok).toBe(false)
    expect(estado.llamadas).toHaveLength(0)
  })
})
