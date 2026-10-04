import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VERSION_AUTORIZACION } from '../../domain/interesados/formulario'
import {
  generarCodigoAtajo,
  leerEstadoSalud,
  otorgarPermisoE,
  revocarCodigoAtajo,
  revocarPermisoE,
} from './saludCelular'

/**
 * La capa de datos de la Fase A de salud del celular. Se mockea el cliente de Supabase
 * (como `vida/tarjetasVida.test.ts`): lo que se comprueba es QUÉ función de la base se llama,
 * con qué argumentos, y que un fallo nunca lanza.
 */

const MIGRACION = join(process.cwd(), 'supabase', 'migrations', '0093_salud_del_celular_atajo.sql')

type Respuesta = { data: unknown; error: { code?: string; message: string } | null }
let respuesta: Respuesta
let llamadas: { nombre: string; args: Record<string, unknown> | undefined }[]
let lanza = false

vi.mock('../supabase', () => ({
  modoNube: true,
  supabase: () => ({
    rpc: (nombre: string, args?: Record<string, unknown>) => {
      llamadas.push({ nombre, args })
      if (lanza) throw new Error('red caída')
      return Promise.resolve(respuesta)
    },
  }),
}))

beforeEach(() => {
  respuesta = { data: null, error: null }
  llamadas = []
  lanza = false
})

describe('las funciones que se llaman existen en la migración 0093', () => {
  const sql = readFileSync(MIGRACION, 'utf8')

  it('cada rpc de este módulo es una función que crea la migración, para authenticated', async () => {
    respuesta = { data: { consentimiento: true }, error: null }
    await leerEstadoSalud()
    await otorgarPermisoE()
    await revocarPermisoE(false)
    await generarCodigoAtajo()
    await revocarCodigoAtajo()
    const nombres = [...new Set(llamadas.map((l) => l.nombre))].sort()
    expect(nombres).toEqual([
      'salud_atajo_generar_token',
      'salud_atajo_revocar_token',
      'salud_dar_consentimiento',
      'salud_estado',
      'salud_revocar_consentimiento',
    ])
    for (const nombre of nombres) {
      expect(sql, nombre).toContain(`create or replace function public.${nombre}(`)
      expect(sql, nombre).toMatch(new RegExp(`grant execute on function public\\.${nombre}\\([^)]*\\) to authenticated`))
    }
  })

  it('la versión del texto que se manda es la que acepta la función de la base', () => {
    expect(sql).toContain(`p_version is distinct from '${VERSION_AUTORIZACION}'`)
    expect(sql).toContain(`version_autorizacion = '${VERSION_AUTORIZACION}'`)
  })
})

describe('leerEstadoSalud', () => {
  it('traduce lo que responde la base', async () => {
    respuesta = {
      data: {
        consentimiento: true,
        consentimiento_desde: '2026-09-28T15:00:00Z',
        codigo_activo: true,
        codigo_creado_en: '2026-09-28T15:05:00Z',
        codigo_ultimo_uso_en: null,
        ultima_muestra: '2026-09-27',
      },
      error: null,
    }
    expect(await leerEstadoSalud()).toEqual({
      permiso: true,
      permisoDesde: '2026-09-28T15:00:00Z',
      codigoActivo: true,
      codigoCreadoEn: '2026-09-28T15:05:00Z',
      codigoUltimoUsoEn: null,
      ultimaMuestra: '2026-09-27',
    })
    expect(llamadas[0].nombre).toBe('salud_estado')
  })

  it('sin permiso ni código, todo en falso y nulo', async () => {
    respuesta = { data: { consentimiento: false, codigo_activo: false }, error: null }
    expect(await leerEstadoSalud()).toEqual({
      permiso: false,
      permisoDesde: null,
      codigoActivo: false,
      codigoCreadoEn: null,
      codigoUltimoUsoEn: null,
      ultimaMuestra: null,
    })
  })

  it('si la base falla (p. ej. la migración no está aplicada) o lanza, devuelve null y no rompe', async () => {
    respuesta = { data: null, error: { code: 'PGRST202', message: 'no existe la función' } }
    expect(await leerEstadoSalud()).toBeNull()
    respuesta = { data: null, error: null }
    expect(await leerEstadoSalud()).toBeNull()
    lanza = true
    expect(await leerEstadoSalud()).toBeNull()
  })
})

describe('otorgarPermisoE', () => {
  it('manda la versión vigente del texto y la declaración aceptada', async () => {
    expect(await otorgarPermisoE()).toEqual({ ok: true })
    expect(llamadas).toEqual([
      { nombre: 'salud_dar_consentimiento', args: { p_version: VERSION_AUTORIZACION, p_declaracion: true } },
    ])
  })

  it('un fallo o una excepción se devuelven como error, sin lanzar', async () => {
    respuesta = { data: null, error: { code: '22023', message: 'x' } }
    expect(await otorgarPermisoE()).toEqual({ ok: false, motivo: 'error' })
    lanza = true
    expect(await otorgarPermisoE()).toEqual({ ok: false, motivo: 'error' })
  })
})

describe('revocarPermisoE', () => {
  it('pide borrar o no lo enviado, y devuelve cuánto se revocó y se borró', async () => {
    respuesta = { data: { consentimiento: false, codigos_revocados: 1, muestras_borradas: 12 }, error: null }
    expect(await revocarPermisoE(true)).toEqual({ ok: true, codigosRevocados: 1, muestrasBorradas: 12 })
    expect(llamadas[0]).toEqual({ nombre: 'salud_revocar_consentimiento', args: { p_borrar_datos: true } })
    await revocarPermisoE(false)
    expect(llamadas[1].args).toEqual({ p_borrar_datos: false })
  })

  it('un fallo se devuelve como error', async () => {
    respuesta = { data: null, error: { message: 'x' } }
    expect(await revocarPermisoE(true)).toEqual({ ok: false, motivo: 'error' })
  })
})

describe('generarCodigoAtajo', () => {
  it('devuelve el código que entrega la base, una sola vez', async () => {
    respuesta = { data: { token: 'sa_' + 'a'.repeat(40) }, error: null }
    expect(await generarCodigoAtajo()).toEqual({ ok: true, codigo: 'sa_' + 'a'.repeat(40) })
    expect(llamadas[0].nombre).toBe('salud_atajo_generar_token')
  })

  it('sin el permiso E la base dice 42501 y el motivo es sin_permiso', async () => {
    respuesta = { data: null, error: { code: '42501', message: 'falta el permiso' } }
    expect(await generarCodigoAtajo()).toEqual({ ok: false, motivo: 'sin_permiso' })
  })

  it('una respuesta sin código no se da por buena', async () => {
    respuesta = { data: {}, error: null }
    expect(await generarCodigoAtajo()).toEqual({ ok: false, motivo: 'error' })
    respuesta = { data: { token: '' }, error: null }
    expect(await generarCodigoAtajo()).toEqual({ ok: false, motivo: 'error' })
    // Ni algo que no tiene la forma de un código (sa_ y 40 hexadecimales).
    respuesta = { data: { token: 'un-texto-cualquiera' }, error: null }
    expect(await generarCodigoAtajo()).toEqual({ ok: false, motivo: 'error' })
  })

  it('no deja el código en ningún almacenamiento del teléfono', async () => {
    respuesta = { data: { token: 'sa_' + 'b'.repeat(40) }, error: null }
    await generarCodigoAtajo()
    const guardado = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage })
    expect(guardado).not.toContain('b'.repeat(40))
  })
})

describe('revocarCodigoAtajo', () => {
  it('dice si había un código', async () => {
    respuesta = { data: true, error: null }
    expect(await revocarCodigoAtajo()).toEqual({ ok: true, habia: true })
    respuesta = { data: false, error: null }
    expect(await revocarCodigoAtajo()).toEqual({ ok: true, habia: false })
  })
})
