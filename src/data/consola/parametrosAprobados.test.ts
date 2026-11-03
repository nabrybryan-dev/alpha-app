import { beforeEach, describe, expect, it, vi } from 'vitest'

const estado = {
  activo: false,
  rpcArgs: undefined as unknown,
  rpcRespuesta: { data: null as unknown, error: null as { message: string; code?: string } | null },
  lectura: { data: null as unknown, error: null as { message: string } | null },
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
          eq: () => ({ maybeSingle: () => Promise.resolve(estado.lectura) }),
        }),
      }
    },
    rpc: (nombre: string, args: unknown) => {
      estado.rpcArgs = { nombre, args }
      return Promise.resolve(estado.rpcRespuesta)
    },
  }),
}))

const m = await import('./parametrosAprobados')

beforeEach(() => {
  estado.activo = false
  estado.rpcRespuesta = { data: null, error: null }
  estado.lectura = { data: null, error: null }
  estado.rpcArgs = undefined
  m.reiniciarDemoParametros()
})

describe('modo demo: sin red, estado local', () => {
  it('sin aprobar la lectura da null; tras aprobar da lo aprobado en forma canonica', async () => {
    expect(await m.leerParametrosAprobados('a1')).toEqual({ ok: true, aprobacion: null })
    const r = await m.aprobarParametrosPlan('a1', { z: 1, a: 2 })
    expect(r.ok).toBe(true)
    const l = await m.leerParametrosAprobados('a1')
    expect(l.ok && l.aprobacion && Object.keys(l.aprobacion.parametros)).toEqual(['a', 'z'])
    expect(estado.rpcArgs).toBeUndefined()
  })

  it('no se arrastra a otro plan', async () => {
    await m.aprobarParametrosPlan('a1', { a: 1 })
    expect(await m.leerParametrosAprobados('a2')).toEqual({ ok: true, aprobacion: null })
  })
})

describe('modo nube', () => {
  it('la RPC recibe el id y los parametros canonicos', async () => {
    estado.activo = true
    estado.rpcRespuesta = {
      data: { plan_renovado_id: 'a1', parametros: { a: 2, z: 1 }, aprobado_por: 'u', aprobado_en: '2026-11-02T00:00:00Z' },
      error: null,
    }
    const r = await m.aprobarParametrosPlan('a1', { z: 1, a: 2 })
    expect(r.ok).toBe(true)
    expect(estado.rpcArgs).toEqual({
      nombre: 'aprobar_parametros_plan',
      args: { p_plan_renovado_id: 'a1', p_parametros: { a: 2, z: 1 } },
    })
  })

  it('el error de permiso y el de valores cambiados llegan en claro', async () => {
    estado.activo = true
    estado.rpcRespuesta = { data: null, error: { code: '42501', message: 'x' } }
    expect(await m.aprobarParametrosPlan('a1', {})).toEqual({ ok: false, error: 'No tienes permiso para aprobar los parámetros.' })
    estado.rpcRespuesta = { data: null, error: { code: '22023', message: 'Los valores cambiaron, vuelve a mirar' } }
    expect(await m.aprobarParametrosPlan('a1', {})).toEqual({ ok: false, error: 'Los valores cambiaron, vuelve a mirar' })
  })

  it('una fila con forma inesperada se descarta y un error de lectura no es "sin aprobar"', async () => {
    estado.activo = true
    estado.lectura = { data: { plan_renovado_id: 'a1', parametros: [1], aprobado_por: 'u', aprobado_en: 'x' }, error: null }
    expect((await m.leerParametrosAprobados('a1')).ok).toBe(false)
    estado.lectura = { data: null, error: { message: 'caido' } }
    expect(await m.leerParametrosAprobados('a1')).toEqual({ ok: false, error: 'caido' })
    estado.lectura = { data: null, error: null }
    expect(await m.leerParametrosAprobados('a1')).toEqual({ ok: true, aprobacion: null })
    expect(estado.tabla).toBe('parametros_aprobados')
  })
})
