import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const estado = {
  activo: true,
  tabla: { data: [] as unknown, error: null as { message: string; code?: string } | null },
  llamadas: [] as { metodo: string; args: unknown[] }[],
  tablasPedidas: [] as string[],
}

vi.mock('../supabase', () => {
  const consulta = () => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'order', 'limit', 'is', 'not', 'eq', 'update']) {
      q[m] = (...args: unknown[]) => {
        estado.llamadas.push({ metodo: m, args })
        return q
      }
    }
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(estado.tabla).then(ok, ko)
    return q
  }
  return {
    get modoNube() {
      return estado.activo
    },
    supabase: () => ({
      from: (tabla: string) => {
        estado.tablasPedidas.push(tabla)
        return consulta()
      },
    }),
  }
})

const { COLUMNAS_AVISOS_PRAXIS, TABLA_AVISOS_PRAXIS, aAviso, avisosAtendidos, avisosPendientes, marcarAvisoAtendido } =
  await import('./avisosPraxis')

const SQL = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0108_praxis_avisos_coach.sql'), 'utf8')

const fila = (parcial: Record<string, unknown> = {}) => ({
  id: 'a-1', usuario_id: 'u-1', creado_en: '2026-10-03T14:32:00Z', origen: 'praxis', nivel: 'vida', atendido_en: null, atendido_por: null, ...parcial,
})

beforeEach(() => {
  estado.activo = true
  estado.tabla = { data: [], error: null }
  estado.llamadas = []
  estado.tablasPedidas = []
})

describe('la tabla y las columnas salen de la migración 0108', () => {
  it('la tabla que se lee existe en la migración', () => {
    expect(SQL).toContain(`create table if not exists public.${TABLA_AVISOS_PRAXIS}`)
  })
  it('cada columna que se lee existe en la tabla, y no se pide ninguna más', () => {
    const tabla = SQL.slice(SQL.indexOf(`create table if not exists public.${TABLA_AVISOS_PRAXIS}`), SQL.indexOf('comment on table'))
    for (const c of COLUMNAS_AVISOS_PRAXIS) expect(tabla, c).toMatch(new RegExp(`^\\s+${c}\\s`, 'm'))
  })
  it('lo único que se marca son las dos columnas que la base deja actualizar', () => {
    expect(SQL).toContain('grant update (atendido_en, atendido_por) on public.praxis_avisos_coach to authenticated')
  })
})

describe('leer los avisos', () => {
  it('los pendientes: pide los que no tienen atendido_en, del más nuevo al más viejo', async () => {
    estado.tabla = { data: [fila(), fila({ id: 'a-2', nivel: 'cuidado' })], error: null }
    const r = await avisosPendientes()
    expect(r).toMatchObject({ ok: true })
    if (r.ok) expect(r.datos.map((a) => [a.id, a.nivel])).toEqual([['a-1', 'vida'], ['a-2', 'cuidado']])
    expect(estado.tablasPedidas).toEqual([TABLA_AVISOS_PRAXIS])
    expect(estado.llamadas).toContainEqual({ metodo: 'is', args: ['atendido_en', null] })
    expect(estado.llamadas).toContainEqual({ metodo: 'order', args: ['creado_en', { ascending: false }] })
  })

  it('los atendidos: pide los que sí tienen atendido_en', async () => {
    estado.tabla = { data: [fila({ atendido_en: '2026-10-03T15:00:00Z', atendido_por: 'u-coach' })], error: null }
    const r = await avisosAtendidos()
    expect(r.ok && r.datos[0].atendidoPor).toBe('u-coach')
    expect(estado.llamadas).toContainEqual({ metodo: 'not', args: ['atendido_en', 'is', null] })
  })

  it('sin la nube (modo demo) es un vacío confirmado, sin consultar nada', async () => {
    estado.activo = false
    expect(await avisosPendientes()).toEqual({ ok: true, datos: [] })
    expect(estado.tablasPedidas).toEqual([])
  })

  it('la tabla sin migrar (PGRST205 o 42P01) se distingue de un fallo cualquiera', async () => {
    estado.tabla = { data: null, error: { message: 'Could not find the table', code: 'PGRST205' } }
    expect(await avisosPendientes()).toMatchObject({ ok: false, sinTabla: true })
    estado.tabla = { data: null, error: { message: 'relation does not exist', code: '42P01' } }
    expect(await avisosPendientes()).toMatchObject({ ok: false, sinTabla: true })
    estado.tabla = { data: null, error: { message: 'JWT expired', code: 'PGRST301' } }
    expect(await avisosPendientes()).toMatchObject({ ok: false, sinTabla: false, error: 'JWT expired' })
  })

  it('un fallo nunca se disfraza de «sin avisos»', async () => {
    estado.tabla = { data: 'no son filas', error: null }
    expect(await avisosPendientes()).toMatchObject({ ok: false })
  })

  it('un tipo que la app no conoce no se descarta en silencio: la lectura falla y lo dice', async () => {
    estado.tabla = { data: [fila(), fila({ id: 'a-2', nivel: 'otro_tipo' })], error: null }
    const r = await avisosPendientes()
    expect(r).toMatchObject({ ok: false })
    expect(!r.ok && r.error).toMatch(/1 avisos con valores/)
    expect(aAviso(fila({ origen: 'sms' }) as never)).toBeNull()
  })
})

describe('marcar atendido', () => {
  it('actualiza solo atendido_en y atendido_por, sobre ese aviso y solo si sigue pendiente', async () => {
    estado.tabla = { data: [{ id: 'a-1' }], error: null }
    const r = await marcarAvisoAtendido('a-1', 'u-coach')
    expect(r).toEqual({ ok: true, id: 'a-1' })
    const upd = estado.llamadas.find((l) => l.metodo === 'update')
    expect(Object.keys(upd?.args[0] as object).sort()).toEqual(['atendido_en', 'atendido_por'])
    expect((upd?.args[0] as { atendido_por: string }).atendido_por).toBe('u-coach')
    expect(estado.llamadas).toContainEqual({ metodo: 'eq', args: ['id', 'a-1'] })
    expect(estado.llamadas).toContainEqual({ metodo: 'is', args: ['atendido_en', null] })
  })

  it('si la base no tocó ninguna fila (otro lo atendió, o sin permiso) lo dice y no finge', async () => {
    estado.tabla = { data: [], error: null }
    expect(await marcarAvisoAtendido('a-1', 'u-coach')).toMatchObject({ ok: false, error: expect.stringMatching(/ya no estaba pendiente/) })
  })

  it('si la base rechaza, devuelve el motivo', async () => {
    estado.tabla = { data: null, error: { message: 'permission denied' } }
    expect(await marcarAvisoAtendido('a-1', 'u-coach')).toEqual({ ok: false, error: 'permission denied' })
  })

  it('sin la nube no marca nada', async () => {
    estado.activo = false
    expect(await marcarAvisoAtendido('a-1', 'u-coach')).toMatchObject({ ok: false })
    expect(estado.tablasPedidas).toEqual([])
  })
})
