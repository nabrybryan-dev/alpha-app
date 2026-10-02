import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Supabase simulado en su capa más baja: una consulta encadenable que, al esperarla, devuelve
 * lo que diga `estado` para esa tabla, y un `rpc` que apunta cada llamada.
 */
const estado = {
  activo: true,
  tablas: {} as Record<string, { data: unknown; error: { message: string } | null }>,
  rpc: { data: null as unknown, error: null as { message: string } | null },
  llamadas: [] as { nombre: string; args: unknown }[],
  lanza: false,
}

vi.mock('../supabase', () => {
  const consulta = (tabla: string) => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'order', 'limit', 'in', 'eq']) q[m] = () => q
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => {
      if (estado.lanza) return Promise.reject(new Error('red caída')).then(ok, ko)
      return Promise.resolve(estado.tablas[tabla] ?? { data: [], error: null }).then(ok, ko)
    }
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
        if (estado.lanza) return Promise.reject(new Error('red caída'))
        return Promise.resolve(estado.rpc)
      },
    }),
  }
})

const {
  COLUMNAS_CALCULADAS_DECISIONES,
  COLUMNAS_DECISIONES,
  PARAMETROS_ANOTAR_DECISION,
  aDecision,
  anotarDecision,
  argumentosDeAnotar,
  companerosDeDecision,
  decisionesCompartidas,
  firmarDecision,
} = await import('./decisiones')

const SQL = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0094_decisiones_compartidas.sql'), 'utf8')

function bloqueTabla(): string {
  const inicio = SQL.indexOf('create table if not exists public.decisiones (')
  expect(inicio, 'la 0094 no crea decisiones').toBeGreaterThan(0)
  return SQL.slice(inicio, SQL.indexOf('\n);\n', inicio))
}

function columnasDeLaTabla(): string[] {
  return bloqueTabla()
    .split('\n')
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => /^[a-z_]+\s/.test(l) && !/^(unique|constraint|check)\b/.test(l))
    .map((l) => l.split(/\s+/)[0])
}

describe('las columnas y los parámetros salen de la migración 0094', () => {
  it('las columnas que se leen existen en la tabla, o son las que calcula la vista', () => {
    const enLaTabla = columnasDeLaTabla()
    const calculadas: readonly string[] = COLUMNAS_CALCULADAS_DECISIONES
    for (const c of COLUMNAS_DECISIONES) {
      if (calculadas.includes(c)) continue
      expect(enLaTabla, `«${c}» no es una columna de decisiones en la 0094`).toContain(c)
    }
  })

  it('cada columna calculada aparece en la vista de la 0094', () => {
    const vista = SQL.slice(SQL.indexOf('create view public.decisiones_con_estado'), SQL.indexOf('revoke all on public.decisiones_con_estado'))
    for (const c of COLUMNAS_CALCULADAS_DECISIONES) expect(vista, `la vista no calcula «${c}»`).toMatch(new RegExp(`as ${c}\\b`))
  })

  it('no se lee lo que no hace falta: ni la huella de idempotencia ni quién anotó', () => {
    expect(COLUMNAS_DECISIONES).not.toContain('idempotencia')
  })

  it('los parámetros de la RPC son los de la función, en su orden', () => {
    const inicio = SQL.indexOf('create or replace function public.anotar_decision(')
    const cabecera = SQL.slice(inicio, SQL.indexOf(')\nreturns uuid', inicio))
    const enElSql = [...cabecera.matchAll(/^\s+(p_[a-z_]+)\s/gm)].map((m) => m[1])
    expect(enElSql).toEqual([...PARAMETROS_ANOTAR_DECISION])
  })

  it('argumentosDeAnotar manda exactamente esos parámetros, y lo que falta va nulo', () => {
    const args = argumentosDeAnotar({ area: 'creadores', palanca: 'segmento', direccion: 'incluye', sujeto: 'negocio:segmento' })
    expect(Object.keys(args)).toEqual([...PARAMETROS_ANOTAR_DECISION])
    expect(args.p_monto_cop).toBeNull()
    expect(args.p_firma_de).toBeNull()
  })
})

const fila = {
  id: 'd-1',
  decidido_por: 'u-1',
  decidido_en: '2026-09-28',
  area: 'creadores',
  palanca: 'segmento',
  direccion: 'incluye',
  sujeto: 'negocio:segmento',
  valor: null,
  monto_cop: '400000',
  periodicidad: 'mensual',
  vigencia_desde: '2026-10-01',
  vigencia_hasta: null,
  resumen: 'Oferta de alquiler',
  notas: null,
  referencia_tabla: null,
  referencia_id: null,
  le_toca_a: 'manuela',
  le_toca_que: 'preparar el mensaje',
  le_toca_vence: null,
  firma_de: 'u-2',
  firma_nivel: 'firma',
  firma_estado: 'pendiente',
  firma_vence_en: '2026-10-05',
  firma_respondida_en: null,
  firma_motivo: null,
  decidido_por_nombre: 'Bryan de prueba',
  firma_de_nombre: 'Manuela de prueba',
  faltan: [],
  programada: true,
  estado: 'propuesta',
}

beforeEach(() => {
  estado.activo = true
  estado.tablas = {}
  estado.rpc = { data: null, error: null }
  estado.llamadas = []
  estado.lanza = false
})

describe('aDecision', () => {
  it('acomoda la fila: el monto llega como número y la firma queda entera', () => {
    const d = aDecision(fila)
    expect(d?.montoCop).toBe(400000)
    expect(d?.estado).toBe('propuesta')
    expect(d?.firmaDeNombre).toBe('Manuela de prueba')
    expect(d?.programada).toBe(true)
  })
  it('un área, una dirección o un estado que la app no conoce no se disfraza: null', () => {
    expect(aDecision({ ...fila, area: 'inventada' })).toBeNull()
    expect(aDecision({ ...fila, direccion: 'inventada' })).toBeNull()
    expect(aDecision({ ...fila, estado: 'inventado' })).toBeNull()
    expect(aDecision({ ...fila, periodicidad: 'anual' })).toBeNull()
  })
})

describe('decisionesCompartidas', () => {
  it('en modo demo (sin nube) es un vacío confirmado', async () => {
    estado.activo = false
    expect(await decisionesCompartidas()).toEqual({ ok: true, datos: [] })
  })

  it('lee las filas de la vista', async () => {
    estado.tablas.decisiones_con_estado = { data: [fila], error: null }
    const r = await decisionesCompartidas()
    expect(r.ok && r.datos.map((d) => d.id)).toEqual(['d-1'])
  })

  it('un error de la consulta es un error, NUNCA una lista vacía', async () => {
    estado.tablas.decisiones_con_estado = { data: null, error: { message: 'permiso denegado' } }
    const r = await decisionesCompartidas()
    expect(r).toEqual({ ok: false, error: 'permiso denegado' })
  })

  it('una red caída es un error, no una lista vacía', async () => {
    estado.lanza = true
    expect((await decisionesCompartidas()).ok).toBe(false)
  })

  it('una fila con un valor desconocido no se descarta en silencio: la lectura falla y lo dice', async () => {
    estado.tablas.decisiones_con_estado = { data: [fila, { ...fila, id: 'd-2', area: 'inventada' }], error: null }
    const r = await decisionesCompartidas()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/1 decisiones con valores/)
  })
})

describe('companerosDeDecision', () => {
  it('lee a quién se le puede pedir la firma', async () => {
    estado.rpc = { data: [{ id: 'u-2', nombre: 'Bryan de prueba' }], error: null }
    expect(await companerosDeDecision()).toEqual({ ok: true, datos: [{ id: 'u-2', nombre: 'Bryan de prueba' }] })
  })
  it('un error no es «nadie»', async () => {
    estado.rpc = { data: null, error: { message: 'sin sesión' } }
    expect(await companerosDeDecision()).toEqual({ ok: false, error: 'sin sesión' })
  })
})

describe('anotar y firmar', () => {
  it('anotar llama a la RPC con los nombres de la función y devuelve el id', async () => {
    estado.rpc = { data: 'd-9', error: null }
    const r = await anotarDecision({ area: 'creadores', palanca: 'segmento', direccion: 'incluye', sujeto: 'negocio:segmento' })
    expect(r).toEqual({ ok: true, id: 'd-9' })
    expect(estado.llamadas[0].nombre).toBe('anotar_decision')
    expect(Object.keys(estado.llamadas[0].args as object)).toEqual([...PARAMETROS_ANOTAR_DECISION])
  })

  it('si la base rechaza, dice el motivo: nunca simula que se anotó', async () => {
    estado.rpc = { data: null, error: { message: 'esa decisión la anota solo el coach' } }
    const r = await anotarDecision({ area: 'finanzas', palanca: 'bono', direccion: 'inicia', sujeto: 'negocio:bono' })
    expect(r).toEqual({ ok: false, error: 'esa decisión la anota solo el coach' })
  })

  it('sin nube no anota (y lo dice)', async () => {
    estado.activo = false
    const r = await anotarDecision({ area: 'creadores', palanca: 'segmento', direccion: 'incluye', sujeto: 'negocio:segmento' })
    expect(r.ok).toBe(false)
    expect(estado.llamadas).toHaveLength(0)
  })

  it('una red caída al anotar es «no anotada», no una excepción', async () => {
    estado.lanza = true
    const r = await anotarDecision({ area: 'creadores', palanca: 'segmento', direccion: 'incluye', sujeto: 'negocio:segmento' })
    expect(r).toEqual({ ok: false, error: 'red caída' })
  })

  it('firmar manda id, veredicto y motivo con los nombres de la función', async () => {
    await firmarDecision('d-1', 'rechazada', 'falta el precio')
    expect(estado.llamadas[0]).toEqual({
      nombre: 'firmar_decision',
      args: { p_id: 'd-1', p_veredicto: 'rechazada', p_motivo: 'falta el precio' },
    })
  })

  it('los parámetros de firmar_decision son los de la función', () => {
    const inicio = SQL.indexOf('create or replace function public.firmar_decision(')
    const cabecera = SQL.slice(inicio, SQL.indexOf(')\nreturns void', inicio))
    expect([...cabecera.matchAll(/^\s+(p_[a-z_]+)\s/gm)].map((m) => m[1])).toEqual(['p_id', 'p_veredicto', 'p_motivo'])
  })
})
