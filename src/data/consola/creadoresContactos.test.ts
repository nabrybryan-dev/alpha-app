import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  COLUMNAS_CREADORES_CONTACTOS,
  TABLA_CREADORES_CONTACTOS,
  aContacto,
  contactosDe,
  textoContacto,
} from './creadoresContactos'

/** Supabase en memoria: entiende `eq`, `gt`, `order` y `limit`, y cuenta exacto. */
type FilaMem = Record<string, unknown>
const estado = {
  activo: true,
  filas: [] as FilaMem[],
  error: null as null | { message: string },
  lanza: false,
  tablasPedidas: [] as string[],
}

vi.mock('../supabase', () => {
  const consulta = (tabla: string) => {
    estado.tablasPedidas.push(tabla)
    const q = { eq: [] as [string, unknown][], gt: [] as [string, string][], head: false, limite: Infinity }
    const ejecutar = async () => {
      if (estado.lanza) throw new Error('red caída')
      if (estado.error) return { data: null, error: estado.error, count: null }
      const filas = estado.filas
        .filter((f) => q.eq.every(([c, v]) => f[c] === v))
        .filter((f) => q.gt.every(([c, v]) => String(f[c]) > v))
        .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      if (q.head) return { data: null, error: null, count: filas.length }
      return { data: filas.slice(0, q.limite).map((f) => ({ ...f })), error: null, count: filas.length }
    }
    const b: Record<string, unknown> = {}
    Object.assign(b, {
      select: (_c?: string, o?: { head?: boolean }) => ((q.head = Boolean(o?.head)), b),
      eq: (c: string, v: unknown) => (q.eq.push([c, v]), b),
      gt: (c: string, v: string) => (q.gt.push([c, v]), b),
      order: () => b,
      limit: (n: number) => ((q.limite = n), b),
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => ejecutar().then(res, rej),
    })
    return b
  }
  return {
    get modoNube() {
      return estado.activo
    },
    supabase: () => ({ from: consulta }),
  }
})

const fila = (extra: FilaMem): FilaMem => ({
  id: 'k1', creador_id: 'land:cuenta_de_prueba', tipo: 'whatsapp', valor: '+570000000',
  origen: 'landing-praxis', recibido_en: '2026-11-11T10:00:00Z', ...extra,
})

beforeEach(() => {
  estado.activo = true
  estado.filas = []
  estado.error = null
  estado.lanza = false
  estado.tablasPedidas = []
})

describe('contactosDe', () => {
  it('trae solo los de ese creador, el más reciente primero', async () => {
    estado.filas = [
      fila({ id: 'k1', recibido_en: '2026-11-10T10:00:00Z' }),
      fila({ id: 'k2', tipo: 'correo', valor: 'a@ejemplo.test', recibido_en: '2026-11-11T10:00:00Z' }),
      fila({ id: 'k3', creador_id: 'ig:910000001', recibido_en: '2026-11-12T10:00:00Z' }),
    ]
    const r = await contactosDe('land:cuenta_de_prueba')
    expect(r.ok && r.datos.map((c) => c.id)).toEqual(['k2', 'k1'])
    expect(estado.tablasPedidas.every((t) => t === TABLA_CREADORES_CONTACTOS)).toBe(true)
  })

  it('un fallo de la consulta (p. ej. la 0178 sin aplicar: la tabla no existe) es un fallo, no un vacío', async () => {
    estado.error = { message: 'relation "public.creadores_contactos" does not exist' }
    const r = await contactosDe('ig:910000001')
    expect(r).toEqual({ ok: false, error: 'relation "public.creadores_contactos" does not exist' })
  })

  it('nunca lanza: una excepción también vuelve como fallo', async () => {
    estado.lanza = true
    expect(await contactosDe('ig:910000001')).toEqual({ ok: false, error: 'red caída' })
  })

  it('en demo, o sin creador, no consulta nada', async () => {
    estado.activo = false
    expect(await contactosDe('ig:910000001')).toEqual({ ok: true, datos: [] })
    estado.activo = true
    expect(await contactosDe('')).toEqual({ ok: true, datos: [] })
    expect(estado.tablasPedidas).toEqual([])
  })
})

describe('aContacto y textoContacto', () => {
  it('descarta un tipo desconocido o un valor vacío', () => {
    expect(aContacto(fila({ tipo: 'telegram' }) as never)).toBeNull()
    expect(aContacto(fila({ tipo: 'toString' }) as never)).toBeNull()
    expect(aContacto(fila({ valor: '  ' }) as never)).toBeNull()
    expect(aContacto(fila({ valor: null }) as never)).toBeNull()
  })

  it('dice el tipo en palabras y el valor', () => {
    expect(textoContacto(aContacto(fila({}) as never)!)).toBe('WhatsApp · +570000000')
    expect(textoContacto(aContacto(fila({ tipo: 'correo', valor: 'a@ejemplo.test' }) as never)!)).toBe('Correo · a@ejemplo.test')
  })
})

describe('las columnas salen de la migración 0178', () => {
  it('creadores_contactos', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0178_creadores_desde_landing.sql'), 'utf8')
    const inicio = sql.indexOf('create table if not exists public.creadores_contactos (')
    expect(inicio, 'la 0178 no crea creadores_contactos').toBeGreaterThan(0)
    const columnas = sql
      .slice(inicio, sql.indexOf(');\n', inicio))
      .split('\n')
      .slice(1)
      .map((l) => l.trim())
      .filter((l) => /^[a-z_]+\s/.test(l) && !/^(unique|constraint|check)\b/.test(l))
      .map((l) => l.split(/\s+/)[0])
    expect([...columnas].sort()).toEqual([...COLUMNAS_CREADORES_CONTACTOS].sort())
  })
})
