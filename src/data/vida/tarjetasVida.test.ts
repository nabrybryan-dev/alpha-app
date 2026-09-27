import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TABLA_TARJETAS_VIDA, guardarTarjetaVida, semanasRespondidasDe, ultimaTarjetaVidaDe } from './tarjetasVida'

const MIGRACION = join(process.cwd(), 'supabase', 'migrations', '0088_tarjeta_semanal_y_mensajes_de_vida.sql')

describe('tarjetas_vida existe tal como la crea la migración 0088', () => {
  it('la tabla que se consulta es la que crea la migración, con sus columnas', () => {
    const sql = readFileSync(MIGRACION, 'utf8')
    const bloque = sql.slice(
      sql.indexOf('create table if not exists public.tarjetas_vida'),
      sql.indexOf('comment on table public.tarjetas_vida'),
    )
    expect(bloque.length).toBeGreaterThan(0)
    for (const columna of ['id', 'usuario_id', 'semana_inicio', 'respuestas', 'creado_en']) {
      expect(bloque, `la migración 0088 no declara "${columna}"`).toMatch(new RegExp(`\\b${columna}\\b`))
    }
  })

  it('la tabla que consulta este archivo es la que declara la migración', () => {
    const sql = readFileSync(MIGRACION, 'utf8')
    expect(sql).toContain(`create table if not exists public.${TABLA_TARJETAS_VIDA}`)
  })
})

let filasSemanas: { semana_inicio: string }[]
let filaUnica: Record<string, unknown> | null
let errorPropio: { code: string; message: string } | null
let errorInsert: { code: string; message: string } | null
let usuarioFiltrado: string | undefined
let insertado: Record<string, unknown> | undefined
let ordenPedido: { columna: string; ascending: boolean } | undefined

function eqResultado() {
  return {
    // Awaitable directamente (semanasRespondidasDe no encadena nada más).
    then: (resuelve: (v: { data: unknown; error: unknown }) => void) =>
      resuelve({ data: filasSemanas, error: errorPropio }),
    order: (columna: string, opts: { ascending: boolean }) => {
      ordenPedido = { columna, ascending: opts.ascending }
      return {
        limit: () => ({
          maybeSingle: () => Promise.resolve({ data: filaUnica, error: errorPropio }),
        }),
      }
    },
  }
}

vi.mock('../supabase', () => ({
  modoNube: true,
  supabase: () => ({
    from: (tabla: string) => {
      expect(tabla).toBe('tarjetas_vida')
      return {
        select: () => ({
          eq: (columna: string, valor: unknown) => {
            if (columna === 'usuario_id') usuarioFiltrado = valor as string
            return eqResultado()
          },
        }),
        insert: (payload: Record<string, unknown>) => {
          insertado = payload
          return Promise.resolve({ error: errorInsert })
        },
      }
    },
  }),
}))

describe('semanasRespondidasDe', () => {
  beforeEach(() => {
    filasSemanas = [{ semana_inicio: '2026-09-14' }, { semana_inicio: '2026-09-21' }]
    errorPropio = null
    usuarioFiltrado = undefined
  })

  it('filtra por el usuario y devuelve solo las semanas', async () => {
    const semanas = await semanasRespondidasDe('u-1')
    expect(usuarioFiltrado).toBe('u-1')
    expect(semanas).toEqual(['2026-09-14', '2026-09-21'])
  })

  it('sin usuarioId no consulta nada', async () => {
    await semanasRespondidasDe('')
    expect(usuarioFiltrado).toBeUndefined()
  })

  it('ante un error de la base da [], nunca lanza', async () => {
    errorPropio = { code: '42P01', message: 'no existe' }
    await expect(semanasRespondidasDe('u-1')).resolves.toEqual([])
  })
})

describe('ultimaTarjetaVidaDe', () => {
  beforeEach(() => {
    filaUnica = {
      id: 't-1',
      usuario_id: 'u-1',
      semana_inicio: '2026-09-21',
      respuestas: { V1: 2 },
      creado_en: '2026-09-21T10:00:00Z',
    }
    errorPropio = null
    ordenPedido = undefined
  })

  it('ordena por semana_inicio descendente', async () => {
    await ultimaTarjetaVidaDe('u-1')
    expect(ordenPedido).toEqual({ columna: 'semana_inicio', ascending: false })
  })

  it('traduce la fila a camelCase', async () => {
    const tarjeta = await ultimaTarjetaVidaDe('u-1')
    expect(tarjeta).toEqual({
      id: 't-1',
      usuarioId: 'u-1',
      semanaInicio: '2026-09-21',
      respuestas: { V1: 2 },
      creadoEn: '2026-09-21T10:00:00Z',
    })
  })

  it('sin fila da null, no lanza', async () => {
    filaUnica = null
    await expect(ultimaTarjetaVidaDe('u-1')).resolves.toBeNull()
  })
})

describe('guardarTarjetaVida', () => {
  beforeEach(() => {
    errorInsert = null
    insertado = undefined
  })

  it('rechaza sin llegar a la base si las respuestas no pasan el dominio', async () => {
    const resultado = await guardarTarjetaVida('u-1', '2026-09-21', { V1: 99 })
    expect(resultado).toEqual({
      ok: false,
      motivo: 'respuestas_invalidas',
      reparos: expect.arrayContaining([expect.stringContaining('V1')]),
    })
    expect(insertado).toBeUndefined()
  })

  it('inserta usuario_id, semana_inicio y respuestas', async () => {
    await guardarTarjetaVida('u-1', '2026-09-21', { V1: 2, V7: 4 })
    expect(insertado).toEqual({ usuario_id: 'u-1', semana_inicio: '2026-09-21', respuestas: { V1: 2, V7: 4 } })
  })

  it('un unique_violation (23505) se traduce a "ya_respondida", no a un error genérico', async () => {
    errorInsert = { code: '23505', message: 'duplicate key' }
    const resultado = await guardarTarjetaVida('u-1', '2026-09-21', { V1: 2 })
    expect(resultado).toEqual({ ok: false, motivo: 'ya_respondida' })
  })

  it('cualquier otro error de la base se traduce a "error"', async () => {
    errorInsert = { code: '42P01', message: 'no existe' }
    const resultado = await guardarTarjetaVida('u-1', '2026-09-21', { V1: 2 })
    expect(resultado).toEqual({ ok: false, motivo: 'error' })
  })

  it('ok cuando no hay error', async () => {
    await expect(guardarTarjetaVida('u-1', '2026-09-21', { V1: 2 })).resolves.toEqual({ ok: true })
  })
})
