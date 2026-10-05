import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TABLA_MENSAJES_VIDA, mensajesVidaDe } from './mensajesVida'

const MIGRACION = join(process.cwd(), 'supabase', 'migrations', '0088_tarjeta_semanal_y_mensajes_de_vida.sql')

describe('mensajes_vida existe tal como la crea la migración 0088', () => {
  it('la tabla que se consulta es la que crea la migración, con sus columnas', () => {
    const sql = readFileSync(MIGRACION, 'utf8')
    const bloque = sql.slice(
      sql.indexOf('create table if not exists public.mensajes_vida'),
      sql.indexOf('comment on table public.mensajes_vida'),
    )
    expect(bloque.length).toBeGreaterThan(0)
    for (const columna of [
      'id',
      'usuario_id',
      'texto',
      'tipo',
      'enviar_despues_de',
      'enviado_en',
      'detenido_en',
      'creado_en',
    ]) {
      expect(bloque, `la migración 0088 no declara "${columna}"`).toMatch(new RegExp(`\\b${columna}\\b`))
    }
  })

  it('la tabla que consulta este archivo es la que declara la migración', () => {
    const sql = readFileSync(MIGRACION, 'utf8')
    expect(sql).toContain(`create table if not exists public.${TABLA_MENSAJES_VIDA}`)
  })

  it('la política de lectura exige dueño, ventana y no detenido — este archivo no repite esa lógica', () => {
    const sql = readFileSync(MIGRACION, 'utf8')
    expect(sql).toMatch(/mensajes_vida_leer[\s\S]*auth\.uid\(\)[\s\S]*enviar_despues_de[\s\S]*detenido_en/)
  })
})

let filas: Record<string, unknown>[]
let errorPropio: { code: string; message: string } | null
let usuarioFiltrado: string | undefined
let ordenPedido: { columna: string; ascending: boolean } | undefined

vi.mock('../supabase', () => ({
  modoNube: true,
  supabase: () => ({
    from: (tabla: string) => {
      expect(tabla).toBe('mensajes_vida')
      return {
        select: () => ({
          eq: (columna: string, valor: unknown) => {
            if (columna === 'usuario_id') usuarioFiltrado = valor as string
            return {
              order: (col: string, opts: { ascending: boolean }) => {
                ordenPedido = { columna: col, ascending: opts.ascending }
                return Promise.resolve({ data: filas, error: errorPropio })
              },
            }
          },
        }),
      }
    },
  }),
}))

describe('mensajesVidaDe', () => {
  beforeEach(() => {
    filas = [
      {
        id: 'mv-1',
        usuario_id: 'u-1',
        texto: 'Sal 10 minutos antes de las 10am.',
        tipo: 'prescripcion_vida',
        enviar_despues_de: '2026-09-27T08:00:00Z',
        enviado_en: null,
        detenido_en: null,
        creado_en: '2026-09-27T06:00:00Z',
      },
    ]
    errorPropio = null
    usuarioFiltrado = undefined
    ordenPedido = undefined
  })

  it('filtra por el usuario y ordena del más reciente al más viejo', async () => {
    await mensajesVidaDe('u-1')
    expect(usuarioFiltrado).toBe('u-1')
    expect(ordenPedido).toEqual({ columna: 'enviar_despues_de', ascending: false })
  })

  it('traduce cada fila a camelCase', async () => {
    const mensajes = await mensajesVidaDe('u-1')
    expect(mensajes).toEqual([
      {
        id: 'mv-1',
        usuarioId: 'u-1',
        texto: 'Sal 10 minutos antes de las 10am.',
        tipo: 'prescripcion_vida',
        enviarDespuesDe: '2026-09-27T08:00:00Z',
        enviadoEn: null,
        detenidoEn: null,
        creadoEn: '2026-09-27T06:00:00Z',
      },
    ])
  })

  it('sin usuarioId no consulta nada', async () => {
    await mensajesVidaDe('')
    expect(usuarioFiltrado).toBeUndefined()
  })

  it('ante un error de la base da [], nunca lanza', async () => {
    errorPropio = { code: '42P01', message: 'no existe' }
    await expect(mensajesVidaDe('u-1')).resolves.toEqual([])
  })
})
