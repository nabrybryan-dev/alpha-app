import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const estado = {
  activo: true,
  filasPorSeccion: {} as Record<string, unknown[]>,
  errorEn: null as string | null,
  lanza: false,
  consultas: [] as { seccion: string; columnas: string; orden: string; limite: number }[],
}

vi.mock('../supabase', () => {
  const consulta = () => {
    const q: Record<string, unknown> = {}
    const c = { seccion: '', columnas: '', orden: '', limite: 0 }
    q.select = (cols: string) => ((c.columnas = cols), q)
    q.eq = (_col: string, v: string) => ((c.seccion = v), q)
    q.order = (col: string, o: { ascending: boolean }) => ((c.orden = `${col}:${o.ascending ? 'asc' : 'desc'}`), q)
    q.limit = (n: number) => ((c.limite = n), q)
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => {
      estado.consultas.push({ ...c })
      if (estado.lanza) return Promise.reject(new Error('red caída')).then(ok, ko)
      if (estado.errorEn === c.seccion) return Promise.resolve({ data: null, error: { message: 'RLS' } }).then(ok, ko)
      return Promise.resolve({ data: estado.filasPorSeccion[c.seccion] ?? [], error: null }).then(ok, ko)
    }
    return q
  }
  return {
    get modoNube() {
      return estado.activo
    },
    supabase: () => ({ from: (t: string) => (t === 'admin_tablero' ? consulta() : (() => { throw new Error(`tabla inesperada: ${t}`) })()) }),
  }
})

const { COLUMNAS_ADMIN_TABLERO, adminTablero } = await import('./adminTablero')

const datosOk = {
  tarjeta: { titulo: 'Finanzas', semaforo: 'amarillo', frase: 'Caja justa', cifra: '3,2 M', cifra_etiqueta: 'caja' },
  filas: [],
  grafico: null,
}

beforeEach(() => {
  estado.activo = true
  estado.filasPorSeccion = {}
  estado.errorEn = null
  estado.lanza = false
  estado.consultas = []
})

describe('COLUMNAS_ADMIN_TABLERO', () => {
  it('son columnas de la tabla de la migración 0102', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0102_admin_tablero.sql'), 'utf8')
    const cuerpo = sql.slice(sql.indexOf('create table if not exists public.admin_tablero'))
    for (const columna of COLUMNAS_ADMIN_TABLERO) {
      expect(cuerpo, `la migración no tiene la columna ${columna}`).toMatch(new RegExp(`\\n\\s+${columna}\\s`))
    }
  })
})

describe('adminTablero', () => {
  it('en demo (sin nube) devuelve las siete secciones sin corte, sin consultar', async () => {
    estado.activo = false
    const r = await adminTablero()
    expect(r.ok && r.datos.map((s) => s.estado)).toEqual(Array(7).fill('sin_corte'))
    expect(estado.consultas).toHaveLength(0)
  })

  it('pide el último corte de CADA sección, una consulta por sección', async () => {
    await adminTablero()
    expect(estado.consultas.map((c) => c.seccion)).toEqual([
      'finanzas', 'plan', 'propuestas', 'desvios', 'influencers', 'mercadeo', 'plataforma',
    ])
    for (const c of estado.consultas) {
      expect(c.orden).toBe('corte:desc')
      expect(c.limite).toBe(1)
      expect(c.columnas).toBe(COLUMNAS_ADMIN_TABLERO.join(','))
    }
  })

  it('valida lo leído: una sección buena, otra mala y el resto sin corte', async () => {
    estado.filasPorSeccion = {
      finanzas: [{ id: 'a', seccion: 'finanzas', corte: '2026-09-28', datos: datosOk, fuente: 'finanzas.json', huella: 'h' }],
      plan: [{ id: 'b', seccion: 'plan', corte: '2026-09-28', datos: { tarjeta: 1 }, fuente: null, huella: null }],
    }
    const r = await adminTablero()
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.datos.map((s) => s.estado)).toEqual(['ok', 'invalida', 'sin_corte', 'sin_corte', 'sin_corte', 'sin_corte', 'sin_corte'])
  })

  it('un error en UNA sección falla la lectura entera y nombra la sección', async () => {
    estado.errorEn = 'desvios'
    const r = await adminTablero()
    expect(r).toEqual({ ok: false, error: 'desvios: RLS' })
  })

  it('si la red lanza, devuelve fallo y no lanza', async () => {
    estado.lanza = true
    const r = await adminTablero()
    expect(r).toEqual({ ok: false, error: 'red caída' })
  })
})
