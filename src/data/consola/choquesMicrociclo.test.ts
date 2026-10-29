import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const estado = {
  activo: true,
  tabla: { data: [] as unknown, error: null as { message: string; code?: string } | null },
  rpc: { error: null as { message: string; code?: string } | null },
  llamadasRpc: [] as { fn: string; args: unknown }[],
  tablasPedidas: [] as string[],
}

vi.mock('../supabase', () => {
  const consulta = () => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order']) q[m] = () => q
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
      rpc: (fn: string, args: unknown) => {
        estado.llamadasRpc.push({ fn, args })
        return Promise.resolve(estado.rpc)
      },
    }),
  }
})

const { choquesPendientes, confirmarPisar, descartarChoque, textoChoque } = await import('./choquesMicrociclo')

const SQL = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0147_candado_de_microciclos.sql'), 'utf8')

const fila = (p: Record<string, unknown> = {}) => ({
  id: 'c-1', usuario_id: 'u-1', propuesta_id: 'm-10', propuesta_numero: 9, propuesta_origen: 'app',
  existente_id: 'm-9', existente_numero: 9, existente_origen: 'cadena',
  existente_en: '2026-10-27T13:05:00Z', existente_por: null, creado_en: '2026-10-28T09:00:00Z', ...p,
})

beforeEach(() => {
  estado.activo = true
  estado.tabla = { data: [], error: null }
  estado.rpc = { error: null }
  estado.llamadasRpc = []
  estado.tablasPedidas = []
})

describe('choquesPendientes', () => {
  it('en modo demo no pregunta a nadie', async () => {
    estado.activo = false
    expect(await choquesPendientes()).toEqual({ ok: true, choques: [] })
    expect(estado.tablasPedidas).toEqual([])
  })

  it('traduce la fila: quién la cargó y cuándo', async () => {
    estado.tabla = { data: [fila()], error: null }
    const r = await choquesPendientes()
    expect(estado.tablasPedidas).toEqual(['microciclos_choques'])
    expect(r).toEqual({
      ok: true,
      choques: [{
        id: 'c-1', usuarioId: 'u-1', propuestaId: 'm-10', propuestaNumero: 9,
        existenteNumero: 9, existenteOrigen: 'cadena', existenteEn: '2026-10-27T13:05:00Z',
      }],
    })
  })

  it('un fallo es ok:false, nunca una lista vacía', async () => {
    estado.tabla = { data: null, error: { message: 'x', code: '42P01' } }
    expect((await choquesPendientes()).ok).toBe(false)
  })
})

describe('las dos decisiones del coach', () => {
  it('confirmar llama a la función de confirmación con la propuesta', async () => {
    expect(await confirmarPisar('m-10')).toEqual({ ok: true })
    expect(estado.llamadasRpc).toEqual([{ fn: 'confirmar_pisar_microciclo', args: { p_propuesta_id: 'm-10' } }])
  })

  it('descartar llama a la función de descarte con el aviso', async () => {
    expect(await descartarChoque('c-1')).toEqual({ ok: true })
    expect(estado.llamadasRpc).toEqual([{ fn: 'descartar_choque_microciclo', args: { p_choque_id: 'c-1' } }])
  })

  it('un error de la base se devuelve, no se traga', async () => {
    estado.rpc = { error: { message: 'no', code: '42501' } }
    expect((await confirmarPisar('m-10')).ok).toBe(false)
  })
})

describe('textoChoque', () => {
  it('dice quién la cargó, cuándo, y que no se hizo nada', () => {
    const t = textoChoque(
      { id: 'c-1', usuarioId: 'u-1', propuestaId: 'm-10', propuestaNumero: 9, existenteNumero: 9, existenteOrigen: 'cadena', existenteEn: '2026-10-27T13:05:00Z' },
      'Persona de prueba',
    )
    expect(t).toContain('Persona de prueba')
    expect(t).toContain('la cadena de agentes')
    expect(t).toContain('M9')
    expect(t).toContain('2026-10-27')
    expect(t).toMatch(/no se (activ|pis)/i)
  })
})

describe('la migración 0147 y este archivo dicen lo mismo', () => {
  it('existen las dos funciones que se llaman y la tabla que se lee', () => {
    expect(SQL).toContain('function public.confirmar_pisar_microciclo(p_propuesta_id text)')
    expect(SQL).toContain('function public.descartar_choque_microciclo(p_choque_id uuid)')
    expect(SQL).toContain('create table if not exists public.microciclos_choques')
  })
})
