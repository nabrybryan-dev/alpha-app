import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Supabase falso en la capa más baja (mismo patrón que `cadenaCorridas.test.ts` y
 * `AgentesTab.test.tsx`): se mockea `../supabase`, no `./ordenes`, para probar el camino
 * real que arma el `insert` y traduce sus errores.
 */
interface FilaError {
  code?: string
  message: string
}
interface ResultadoInsert {
  data: unknown
  error: FilaError | null
}

const estado = {
  activo: true,
  resultadoInsert: { data: null, error: null } as ResultadoInsert,
  filasSelect: [] as unknown[],
  errorSelect: null as FilaError | null,
  insertsRecibidos: [] as Record<string, unknown>[],
  tiposFiltrados: [] as string[][],
}

function cliente() {
  return {
    from: (tabla: string) => {
      if (tabla !== 'ordenes') throw new Error(`tabla inesperada: ${tabla}`)
      return {
        insert: (payload: Record<string, unknown>) => {
          estado.insertsRecibidos.push(payload)
          return {
            select: () => ({
              single: () => Promise.resolve(estado.resultadoInsert),
            }),
          }
        },
        select: () => ({
          in: (_columna: string, tipos: string[]) => {
            estado.tiposFiltrados.push(tipos)
            return {
              order: () => Promise.resolve({ data: estado.filasSelect, error: estado.errorSelect }),
            }
          },
        }),
      }
    },
  }
}

vi.mock('../supabase', () => ({
  get modoNube() {
    return estado.activo
  },
  supabase: () => cliente(),
}))

const {
  claveDetener,
  claveReportarRiesgo,
  detenerPublicacion,
  insertarOrden,
  ordenesRecientes,
  reportarRiesgo,
} = await import('./ordenes')

function filaOrdenCruda(extra: Record<string, unknown> = {}) {
  return {
    id: 'orden-1',
    actor_id: 'u-actor',
    tipo: 'detener',
    objetivo: { usuario_id: 'u-1', semana_inicio: '2026-09-28', motivo: 'dolor lumbar' },
    idempotency_key: 'detener|u-1|2026-09-28|u-actor',
    creada_en: '2026-09-28T12:00:00Z',
    ...extra,
  }
}

beforeEach(() => {
  estado.activo = true
  estado.resultadoInsert = { data: filaOrdenCruda(), error: null }
  estado.filasSelect = []
  estado.errorSelect = null
  estado.insertsRecibidos = []
  estado.tiposFiltrados = []
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('las claves de idempotencia', () => {
  it('claveDetener: detener|usuario|semana|actor', () => {
    expect(claveDetener('u-1', '2026-09-28', 'u-actor')).toBe('detener|u-1|2026-09-28|u-actor')
  })

  it('claveReportarRiesgo: reportar_riesgo|usuario|semana|actor', () => {
    expect(claveReportarRiesgo('u-1', '2026-09-28', 'u-actor')).toBe('reportar_riesgo|u-1|2026-09-28|u-actor')
  })

  it('la misma persona+semana+actor siempre da la MISMA clave (dos clics no la cambian)', () => {
    const primera = claveDetener('u-1', '2026-09-28', 'u-actor')
    const segunda = claveDetener('u-1', '2026-09-28', 'u-actor')
    expect(primera).toBe(segunda)
  })

  it('personas o semanas distintas dan claves distintas', () => {
    expect(claveDetener('u-1', '2026-09-28', 'u-actor')).not.toBe(claveDetener('u-2', '2026-09-28', 'u-actor'))
    expect(claveDetener('u-1', '2026-09-28', 'u-actor')).not.toBe(claveDetener('u-1', '2026-10-05', 'u-actor'))
  })
})

describe('insertarOrden', () => {
  it('en modo demo (sin conexión) no llama a la base y devuelve un error legible', async () => {
    estado.activo = false
    const resultado = await insertarOrden('detener', { usuario_id: 'u-1' }, 'clave-1')
    expect(resultado).toEqual({ ok: false, error: 'Sin conexión con la base: esto es un demo.' })
    expect(estado.insertsRecibidos).toEqual([])
  })

  it('inserta con exactamente tipo, objetivo e idempotency_key, y ningún actor_id (lo pone la base)', async () => {
    await insertarOrden('detener', { usuario_id: 'u-1', semana_inicio: '2026-09-28', motivo: 'x' }, 'clave-1')
    expect(estado.insertsRecibidos).toEqual([
      { tipo: 'detener', objetivo: { usuario_id: 'u-1', semana_inicio: '2026-09-28', motivo: 'x' }, idempotency_key: 'clave-1' },
    ])
  })

  it('éxito: traduce la fila a Orden en camelCase', async () => {
    const resultado = await insertarOrden('detener', {}, 'clave-1')
    expect(resultado).toEqual({
      ok: true,
      yaExistia: false,
      orden: {
        id: 'orden-1',
        actorId: 'u-actor',
        tipo: 'detener',
        objetivo: { usuario_id: 'u-1', semana_inicio: '2026-09-28', motivo: 'dolor lumbar' },
        idempotencyKey: 'detener|u-1|2026-09-28|u-actor',
        creadaEn: '2026-09-28T12:00:00Z',
      },
    })
  })

  it('23505 (idempotency_key duplicada) se trata como éxito silencioso: "ya existía", no un error', async () => {
    estado.resultadoInsert = { data: null, error: { code: '23505', message: 'duplicate key value' } }
    const resultado = await insertarOrden('detener', {}, 'clave-1')
    expect(resultado).toEqual({ ok: true, yaExistia: true })
  })

  it('42501 (RLS: sin la capacidad) se traduce a un mensaje legible, no al código de Postgres', async () => {
    estado.resultadoInsert = { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } }
    const resultado = await insertarOrden('detener', {}, 'clave-1')
    expect(resultado).toEqual({ ok: false, error: 'No tienes permiso para esta acción.' })
  })

  it('un error de red no lanza: devuelve { ok: false }', async () => {
    estado.resultadoInsert = { data: null, error: { message: 'fetch failed' } }
    const resultado = await insertarOrden('detener', {}, 'clave-1')
    expect(resultado).toEqual({ ok: false, error: 'fetch failed' })
  })
})

describe('dos clics = una sola orden (idempotencia real de punta a punta)', () => {
  it('el segundo insert con la MISMA clave choca con 23505 y no crea una segunda orden', async () => {
    const clave = claveDetener('u-1', '2026-09-28', 'u-actor')

    // Primer clic: la base acepta e inserta la fila.
    estado.resultadoInsert = { data: filaOrdenCruda({ idempotency_key: clave }), error: null }
    const primero = await detenerPublicacion({ usuarioId: 'u-1', semanaInicio: '2026-09-28', motivo: 'x', actorId: 'u-actor' })
    expect(primero).toEqual({ ok: true, yaExistia: false, orden: expect.objectContaining({ idempotencyKey: clave }) })

    // Segundo clic (mismo actor, misma persona, misma semana): la base rechaza por
    // `idempotency_key` duplicada — exactamente lo que dispara el índice único de la 0083.
    estado.resultadoInsert = { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "ordenes_idempotency_key_key"' } }
    const segundo = await detenerPublicacion({ usuarioId: 'u-1', semanaInicio: '2026-09-28', motivo: 'x', actorId: 'u-actor' })
    expect(segundo).toEqual({ ok: true, yaExistia: true })

    // Los dos intentos mandaron LA MISMA clave: es lo que hace posible que la base
    // reconozca el segundo como un duplicado del primero, no como una orden nueva.
    expect(estado.insertsRecibidos).toHaveLength(2)
    expect(estado.insertsRecibidos[0].idempotency_key).toBe(clave)
    expect(estado.insertsRecibidos[1].idempotency_key).toBe(clave)
  })
})

describe('detenerPublicacion y reportarRiesgo: objetivo y clave correctos', () => {
  it('detenerPublicacion arma {usuario_id, semana_inicio, motivo} y la clave detener|...', async () => {
    await detenerPublicacion({ usuarioId: 'u-9', semanaInicio: '2026-10-05', motivo: 'se cayó', actorId: 'u-actor' })
    expect(estado.insertsRecibidos[0]).toEqual({
      tipo: 'detener',
      objetivo: { usuario_id: 'u-9', semana_inicio: '2026-10-05', motivo: 'se cayó' },
      idempotency_key: 'detener|u-9|2026-10-05|u-actor',
    })
  })

  it('reportarRiesgo arma el mismo objetivo con tipo reportar_riesgo y su propia clave', async () => {
    await reportarRiesgo({ usuarioId: 'u-9', semanaInicio: '2026-10-05', motivo: 'dolor articular', actorId: 'u-actor' })
    expect(estado.insertsRecibidos[0]).toEqual({
      tipo: 'reportar_riesgo',
      objetivo: { usuario_id: 'u-9', semana_inicio: '2026-10-05', motivo: 'dolor articular' },
      idempotency_key: 'reportar_riesgo|u-9|2026-10-05|u-actor',
    })
  })
})

describe('ordenesRecientes', () => {
  it('en modo demo no consulta nada', async () => {
    estado.activo = false
    const ordenes = await ordenesRecientes(['detener'])
    expect(ordenes).toEqual([])
    expect(estado.tiposFiltrados).toEqual([])
  })

  it('filtra por los tipos pedidos', async () => {
    estado.filasSelect = [filaOrdenCruda()]
    await ordenesRecientes(['detener', 'reportar_riesgo'])
    expect(estado.tiposFiltrados).toEqual([['detener', 'reportar_riesgo']])
  })

  it('traduce cada fila a Orden y descarta un tipo que no reconoce', async () => {
    estado.filasSelect = [filaOrdenCruda(), filaOrdenCruda({ id: 'orden-2', tipo: 'algo-nuevo' })]
    const ordenes = await ordenesRecientes(['detener'])
    expect(ordenes).toHaveLength(1)
    expect(ordenes[0].id).toBe('orden-1')
  })

  it('ante un error de la base devuelve [], nunca lanza', async () => {
    estado.errorSelect = { message: 'tabla caída' }
    await expect(ordenesRecientes(['detener'])).resolves.toEqual([])
  })
})
