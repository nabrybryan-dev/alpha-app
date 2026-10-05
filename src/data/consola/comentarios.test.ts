import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const estado = {
  activo: true,
  tabla: { data: [] as unknown, error: null as { message: string } | null },
  rpc: { data: null as unknown, error: null as { message: string } | null },
  llamadas: [] as { nombre: string; args: unknown }[],
  tablasPedidas: [] as string[],
}

vi.mock('../supabase', () => {
  const consulta = () => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'order', 'limit']) q[m] = () => q
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
      rpc: (nombre: string, args: unknown) => {
        estado.llamadas.push({ nombre, args })
        return Promise.resolve(estado.rpc)
      },
    }),
  }
})

const {
  COLUMNAS_MIS_COMENTARIOS,
  PARAMETROS_ENVIAR_COMENTARIO,
  aComentario,
  enviarComentario,
  misComentarios,
} = await import('./comentarios')

const SQL = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0095_comentarios_app.sql'), 'utf8')

describe('las columnas y los parámetros salen de la migración 0095', () => {
  it('las columnas que se leen son las de la vista mis_comentarios, y solo esas', () => {
    const inicio = SQL.indexOf('create view public.mis_comentarios as')
    const seleccion = SQL.slice(SQL.indexOf('select', inicio), SQL.indexOf('from public.comentarios_app', inicio))
    const enElSql = [...seleccion.matchAll(/c\.([a-z_]+)/g)].map((m) => m[1])
    expect(enElSql).toEqual([...COLUMNAS_MIS_COMENTARIOS])
  })

  it('nunca se pide un campo interno del triaje', () => {
    for (const interno of ['contrato_id', 'texto_saneado', 'triado_por', 'cerrado_por', 'usuario_id', 'rol_autor']) {
      expect(COLUMNAS_MIS_COMENTARIOS).not.toContain(interno)
    }
  })

  it('los parámetros de la RPC son los de enviar_comentario, en su orden', () => {
    const inicio = SQL.indexOf('create or replace function public.enviar_comentario(')
    const cabecera = SQL.slice(inicio, SQL.indexOf(')\nreturns bigint', inicio))
    expect([...cabecera.matchAll(/^\s+(p_[a-z_]+)\s/gm)].map((m) => m[1])).toEqual([...PARAMETROS_ENVIAR_COMENTARIO])
  })
})

beforeEach(() => {
  estado.activo = true
  estado.tabla = { data: [], error: null }
  estado.rpc = { data: null, error: null }
  estado.llamadas = []
  estado.tablasPedidas = []
})

const fila = { id: 7, creado_en: '2026-09-28T10:00:00Z', tipo: 'falla', pantalla: '/hoy', texto: 'no carga', estado: 'nuevo' }

describe('misComentarios', () => {
  it('lee de la VISTA, nunca de la tabla', async () => {
    estado.tabla = { data: [fila], error: null }
    const r = await misComentarios()
    expect(estado.tablasPedidas).toEqual(['mis_comentarios'])
    expect(r.ok && r.datos[0]).toEqual({
      id: '7', creadoEn: '2026-09-28T10:00:00Z', tipo: 'falla', pantalla: '/hoy', texto: 'no carga', estado: 'nuevo',
    })
  })
  it('sin nube es un vacío confirmado', async () => {
    estado.activo = false
    expect(await misComentarios()).toEqual({ ok: true, datos: [] })
  })
  it('un error de la consulta es un error, no «sin comentarios»', async () => {
    estado.tabla = { data: null, error: { message: 'permiso denegado' } }
    expect(await misComentarios()).toEqual({ ok: false, error: 'permiso denegado' })
  })
  it('un valor desconocido no se descarta en silencio', async () => {
    estado.tabla = { data: [fila, { ...fila, id: 8, estado: 'inventado' }], error: null }
    const r = await misComentarios()
    expect(r.ok).toBe(false)
  })
  it('aComentario deja pasar el texto purgado (null)', () => {
    expect(aComentario({ ...fila, texto: null })?.texto).toBeNull()
  })
})

describe('enviarComentario', () => {
  it('manda tipo, pantalla, texto y versión con los nombres de la función', async () => {
    estado.rpc = { data: 12, error: null }
    const r = await enviarComentario({ tipo: 'idea', pantalla: '/hoy', texto: 'una idea', version: 'v1' })
    expect(r).toEqual({ ok: true, id: '12' })
    expect(estado.llamadas[0]).toEqual({
      nombre: 'enviar_comentario',
      args: { p_tipo: 'idea', p_pantalla: '/hoy', p_texto: 'una idea', p_version: 'v1' },
    })
  })
  it('si la base rechaza, lo dice', async () => {
    estado.rpc = { data: null, error: { message: 'ya enviaste 10 comentarios hoy' } }
    const r = await enviarComentario({ tipo: 'idea', pantalla: '/hoy', texto: 'otra' })
    expect(r).toEqual({ ok: false, error: 'ya enviaste 10 comentarios hoy' })
  })
  it('sin nube no envía', async () => {
    estado.activo = false
    const r = await enviarComentario({ tipo: 'idea', pantalla: '/hoy', texto: 'otra' })
    expect(r.ok).toBe(false)
    expect(estado.llamadas).toHaveLength(0)
  })
})
