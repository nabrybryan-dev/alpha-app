import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const estado = {
  activo: true,
  llamadas: [] as { nombre: string; args: unknown }[],
  respuesta: { data: null as unknown, error: null as { message: string; code?: string } | null },
}

vi.mock('../supabase', () => ({
  get modoNube() {
    return estado.activo
  },
  supabase: () => ({
    rpc: (nombre: string, args: unknown) => {
      estado.llamadas.push({ nombre, args })
      return Promise.resolve(estado.respuesta)
    },
  }),
}))

const { aEstadoRegla, cambiarReglaVentana, leerReglaVentana } = await import('./reglaVentana')

beforeEach(() => {
  estado.activo = true
  estado.llamadas = []
  estado.respuesta = { data: null, error: null }
})

const encendidaPorAlguien = {
  activa: true,
  actualizada_en: '2026-11-07T15:00:00Z',
  ultimo_cambio: {
    activa_despues: true,
    hecho_por: 'u-staff',
    hecho_por_nombre: 'Staff de prueba',
    hecho_en: '2026-11-07T15:00:00Z',
    nota: 'probamos una semana',
  },
}

describe('aEstadoRegla', () => {
  it('lee el estado y el último cambio', () => {
    expect(aEstadoRegla(encendidaPorAlguien)).toEqual({
      encendida: true,
      ultimoCambio: { encendida: true, por: 'u-staff', porNombre: 'Staff de prueba', en: '2026-11-07T15:00:00Z', nota: 'probamos una semana' },
    })
  })

  it('sin cambios registrados, el último cambio es null (nunca se tocó)', () => {
    expect(aEstadoRegla({ activa: false, ultimo_cambio: null })).toEqual({ encendida: false, ultimoCambio: null })
  })

  it('una forma inesperada se descarta entera', () => {
    expect(aEstadoRegla(null)).toBeNull()
    expect(aEstadoRegla({ activa: 'si' })).toBeNull()
    expect(aEstadoRegla({ activa: true, ultimo_cambio: { activa_despues: 'x', hecho_en: 'y' } })).toBeNull()
  })
})

describe('leerReglaVentana', () => {
  it('en demo no consulta', async () => {
    estado.activo = false
    expect((await leerReglaVentana()).ok).toBe(false)
    expect(estado.llamadas).toEqual([])
  })

  it('llama a estado_regla_ventana', async () => {
    estado.respuesta = { data: encendidaPorAlguien, error: null }
    const r = await leerReglaVentana()
    expect(estado.llamadas).toEqual([{ nombre: 'estado_regla_ventana', args: undefined }])
    expect(r.ok && r.estado.encendida).toBe(true)
  })

  it('un error no es «apagada»: lo dice', async () => {
    estado.respuesta = { data: null, error: { message: 'red caída' } }
    expect(await leerReglaVentana()).toEqual({ ok: false, error: 'red caída' })
  })
})

describe('cambiarReglaVentana', () => {
  it('encender y apagar llaman a su RPC con la nota', async () => {
    await cambiarReglaVentana(true, '  una semana de prueba ')
    await cambiarReglaVentana(false, '')
    expect(estado.llamadas).toEqual([
      { nombre: 'encender_regla_ventana', args: { p_nota: 'una semana de prueba' } },
      { nombre: 'apagar_regla_ventana', args: { p_nota: null } },
    ])
  })

  it('sin permiso, lo dice en claro', async () => {
    estado.respuesta = { data: null, error: { code: '42501', message: 'falta la capacidad' } }
    expect(await cambiarReglaVentana(true, '')).toEqual({ ok: false, error: 'No tienes permiso para cambiar esta regla.' })
  })
})

describe('los nombres salen de las migraciones', () => {
  it('las tres RPC existen con el parámetro p_nota', () => {
    const leer = (f: string) => readFileSync(join(process.cwd(), 'supabase', 'migrations', f), 'utf8')
    expect(leer('0143_encender_regla_ventana_con_registro.sql')).toMatch(/function public\.encender_regla_ventana\(p_nota text/)
    const sql = leer('0170_interruptor_regla_ventana.sql')
    expect(sql).toMatch(/function public\.apagar_regla_ventana\(p_nota text/)
    expect(sql).toMatch(/function public\.estado_regla_ventana\(\)/)
    for (const clave of ["'activa'", "'ultimo_cambio'", "'activa_despues'", "'hecho_por'", "'hecho_por_nombre'", "'hecho_en'", "'nota'"]) {
      expect(sql, clave).toContain(clave)
    }
  })
})
