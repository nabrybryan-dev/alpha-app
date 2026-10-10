import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Mismo patrón que `notasLlamada.test.ts`: se mockea `../supabase`, no este archivo, para probar el
 *  camino real que arma cada llamada. El doble REGISTRA los argumentos de cada eslabón (`from`, `select`,
 *  `eq`, `order`, `rpc`): una prueba que solo mira lo que devuelve el doble no ve si se pidió la tabla, el
 *  asesorado, el orden o el procedimiento equivocados, y pasa igual. */
type ErrorBase = { message: string; code?: string }

const estado = {
  activo: true,
  filasSelect: [] as unknown[],
  errorSelect: null as ErrorBase | null,
  /** `data: null` sin error: la base no dijo ni sí ni no. */
  sinDatosSelect: false,
  excepcionSelect: false,
  dataRpc: null as unknown,
  errorRpc: null as ErrorBase | null,
  excepcionRpc: false,
  // Lo que llegó a la base, en orden.
  tablas: [] as string[],
  selects: [] as string[],
  eqs: [] as unknown[][],
  orders: [] as unknown[][],
  rpcs: [] as { nombre: string; args: unknown }[],
}

vi.mock('../supabase', () => ({
  get modoNube() {
    return estado.activo
  },
  supabase: () => ({
    from: (tabla: string) => {
      estado.tablas.push(tabla)
      return {
        select: (columnas: string) => {
          estado.selects.push(columnas)
          const lectura = {
            eq: (...args: unknown[]) => {
              estado.eqs.push(args)
              return lectura
            },
            order: (...args: unknown[]) => {
              estado.orders.push(args)
              if (estado.excepcionSelect) return Promise.reject(new Error('Failed to fetch'))
              return Promise.resolve({
                data: estado.sinDatosSelect ? null : estado.filasSelect,
                error: estado.errorSelect,
              })
            },
          }
          return lectura
        },
      }
    },
    rpc: (nombre: string, args: unknown) => {
      estado.rpcs.push({ nombre, args })
      if (estado.excepcionRpc) return Promise.reject(new Error('Failed to fetch'))
      return Promise.resolve({ data: estado.dataRpc, error: estado.errorRpc })
    },
  }),
}))

const {
  observacionesDe,
  firmarObservacion,
  fechaDeObservacion,
  COLUMNAS_OBSERVACIONES_AGENTE,
  TABLA_OBSERVACIONES_AGENTE,
  RPC_FIRMAR_OBSERVACION,
} = await import('./observacionesAgente')

/** La fila tal como la devuelve la base. */
function fila(extra: Record<string, unknown> = {}) {
  return {
    id: 'obs-1',
    usuario_id: 'u-1',
    creado_en: '2026-10-09T15:00:00Z',
    tema: 'seguridad',
    carril: 'para_firma',
    titulo: 'Dolor de rodilla',
    texto: 'Mencionó dolor al bajar escaleras.',
    fuentes: [
      { tipo: 'base', ref: 'wiki/seguridad/dolor.md 2026-09-30', cita: 'derivar antes de cargar' },
      { tipo: 'dato', ref: 'notas_llamada 2026-10-08', cita: 'me duele la rodilla' },
    ],
    agente: 'agente-de-llamadas',
    corrida_id: 'corrida-1',
    estado: 'pendiente',
    firmada_por: null,
    firmada_en: null,
    nota_de_firma: null,
    ...extra,
  }
}

beforeEach(() => {
  Object.assign(estado, {
    activo: true,
    filasSelect: [],
    errorSelect: null,
    sinDatosSelect: false,
    excepcionSelect: false,
    dataRpc: null,
    errorRpc: null,
    excepcionRpc: false,
    tablas: [],
    selects: [],
    eqs: [],
    orders: [],
    rpcs: [],
  })
})

describe('observacionesDe · lo que le pide a la base', () => {
  it('pide la tabla, las columnas, solo ese asesorado y lo más reciente primero', async () => {
    await observacionesDe('u-1')

    expect(estado.tablas).toEqual([TABLA_OBSERVACIONES_AGENTE])
    expect(estado.selects).toEqual([COLUMNAS_OBSERVACIONES_AGENTE.join(',')])
    expect(estado.eqs).toEqual([['usuario_id', 'u-1']])
    expect(estado.orders).toEqual([['creado_en', { ascending: false }]])
  })

  it('pasa la fila al vocabulario del dominio, con las fuentes leídas', async () => {
    estado.filasSelect = [
      fila({
        estado: 'aceptada',
        firmada_por: 'u-manuela',
        firmada_en: '2026-10-09T16:00:00Z',
        nota_de_firma: 'Lo veo el jueves.',
      }),
    ]
    const r = await observacionesDe('u-1')

    expect(r).toEqual({
      ok: true,
      observaciones: [
        {
          id: 'obs-1',
          usuarioId: 'u-1',
          creadoEn: '2026-10-09T15:00:00Z',
          tema: 'seguridad',
          carril: 'para_firma',
          titulo: 'Dolor de rodilla',
          texto: 'Mencionó dolor al bajar escaleras.',
          fuentes: [
            { tipo: 'base', ref: 'wiki/seguridad/dolor.md 2026-09-30', cita: 'derivar antes de cargar' },
            { tipo: 'dato', ref: 'notas_llamada 2026-10-08', cita: 'me duele la rodilla' },
          ],
          agente: 'agente-de-llamadas',
          corridaId: 'corrida-1',
          estado: 'aceptada',
          firmadaPor: 'u-manuela',
          firmadaEn: '2026-10-09T16:00:00Z',
          notaDeFirma: 'Lo veo el jueves.',
        },
      ],
    })
  })

  it('una fuente mal escrita no tumba la lista: lo que no es objeto se descarta y lo que falta queda vacío', async () => {
    estado.filasSelect = [fila({ fuentes: ['texto suelto', null, { tipo: 'rumor', ref: 'r' }, { tipo: 'base', cita: 'c' }] })]
    const r = await observacionesDe('u-1')

    expect(r.ok && r.observaciones[0].fuentes).toEqual([
      { tipo: 'sin_tipo', ref: 'r', cita: '' },
      { tipo: 'base', ref: '', cita: 'c' },
    ])
  })

  it('sin la nube o sin asesorado no toca la base: lista vacía', async () => {
    estado.activo = false
    expect(await observacionesDe('u-1')).toEqual({ ok: true, observaciones: [] })
    estado.activo = true
    expect(await observacionesDe('')).toEqual({ ok: true, observaciones: [] })
    expect(estado.tablas).toEqual([])
  })
})

describe('observacionesDe · un fallo NO es «no hay observaciones»', () => {
  it('un error de la base es ok:false con mensaje en español, nunca el crudo', async () => {
    estado.errorSelect = { message: 'permission denied for table observaciones_agente', code: '42501' }
    const r = await observacionesDe('u-1')

    expect(r).toEqual({ ok: false, error: 'No se pudieron cargar las observaciones del agente.' })
  })

  it('sin tabla (la 0115 no está aplicada) lo dice con otras palabras', async () => {
    estado.errorSelect = { message: 'relation "observaciones_agente" does not exist', code: '42P01' }
    const r = await observacionesDe('u-1')

    expect(r).toEqual({ ok: false, error: 'Las observaciones del agente todavía no están activadas en la base.' })
  })

  it('sin error pero sin datos es fallo, no lista vacía', async () => {
    estado.sinDatosSelect = true
    expect((await observacionesDe('u-1')).ok).toBe(false)
  })

  it('una excepción de red es fallo', async () => {
    estado.excepcionSelect = true
    expect(await observacionesDe('u-1')).toEqual({
      ok: false,
      error: 'No se pudieron cargar las observaciones del agente.',
    })
  })
})

describe('firmarObservacion', () => {
  it('llama a la función de firma con el id, la decisión y la nota, y devuelve la fila firmada', async () => {
    estado.dataRpc = fila({ estado: 'aceptada', firmada_por: 'u-manuela', firmada_en: '2026-10-09T16:00:00Z' })
    const r = await firmarObservacion('obs-1', 'aceptada', '  Lo veo el jueves.  ')

    expect(estado.rpcs).toEqual([
      { nombre: RPC_FIRMAR_OBSERVACION, args: { p_id: 'obs-1', p_decision: 'aceptada', p_nota: 'Lo veo el jueves.' } },
    ])
    expect(RPC_FIRMAR_OBSERVACION).toBe('firmar_observacion_agente')
    expect(r.ok && r.observacion).toMatchObject({ id: 'obs-1', estado: 'aceptada', firmadaPor: 'u-manuela' })
    // Quién firma NO se manda: lo pone la base.
    expect(Object.keys(estado.rpcs[0].args as object).sort()).toEqual(['p_decision', 'p_id', 'p_nota'])
  })

  it('sin nota o con una nota en blanco manda null, no un texto vacío', async () => {
    estado.dataRpc = fila({ estado: 'descartada', firmada_por: 'u-1', firmada_en: '2026-10-09T16:00:00Z' })
    await firmarObservacion('obs-1', 'descartada')
    await firmarObservacion('obs-1', 'descartada', '   ')

    expect(estado.rpcs.map((c) => (c.args as { p_nota: unknown }).p_nota)).toEqual([null, null])
  })

  it('si el cliente envuelve la fila en un arreglo, la toma igual', async () => {
    estado.dataRpc = [fila({ estado: 'aceptada', firmada_por: 'u-1', firmada_en: '2026-10-09T16:00:00Z' })]
    const r = await firmarObservacion('obs-1', 'aceptada')

    expect(r.ok && r.observacion.estado).toBe('aceptada')
  })

  it('sin permiso (42501) dice que no tiene permiso', async () => {
    estado.errorRpc = { message: 'solo quien entra a la consola firma', code: '42501' }
    expect(await firmarObservacion('obs-1', 'aceptada')).toEqual({
      ok: false,
      error: 'No tienes permiso para firmar observaciones del agente.',
      yaFirmada: false,
    })
  })

  it('ya firmada por otra persona (22023 con el texto de la función) lo dice y marca yaFirmada', async () => {
    estado.errorRpc = { message: 'la observación ya está firmada', code: '22023' }
    expect(await firmarObservacion('obs-1', 'aceptada')).toEqual({
      ok: false,
      error: 'Otra persona del equipo ya la firmó. Se vuelve a cargar la lista.',
      yaFirmada: true,
    })
  })

  it('una nota demasiado larga (22023 por otro motivo) no se confunde con «ya firmada»', async () => {
    estado.errorRpc = { message: 'la nota de la firma va de 1 a 500 caracteres', code: '22023' }
    const r = await firmarObservacion('obs-1', 'aceptada')

    expect(r).toMatchObject({ ok: false, yaFirmada: false, error: 'La nota de la firma es demasiado larga: máximo 500 letras.' })
  })

  it('una observación que ya no existe (P0002) lo dice', async () => {
    estado.errorRpc = { message: 'la observación no existe', code: 'P0002' }
    expect(await firmarObservacion('obs-1', 'aceptada')).toMatchObject({
      ok: false,
      error: 'Esa observación ya no existe. Vuelve a cargar la lista.',
    })
  })

  it('sin la función (la 0115 no está aplicada) dice que no está activada', async () => {
    estado.errorRpc = { message: 'Could not find the function public.firmar_observacion_agente', code: 'PGRST202' }
    expect(await firmarObservacion('obs-1', 'aceptada')).toMatchObject({
      ok: false,
      error: 'Las observaciones del agente todavía no están activadas en la base.',
    })
  })

  it('cualquier otro error da un mensaje genérico en español, nunca el texto crudo', async () => {
    estado.errorRpc = { message: 'duplicate key value violates unique constraint "x"', code: '23505' }
    const r = await firmarObservacion('obs-1', 'aceptada')

    expect(r).toEqual({ ok: false, error: 'No se pudo guardar la firma. Vuelve a intentarlo.', yaFirmada: false })
  })

  it('una respuesta sin fila no se da por firmada', async () => {
    estado.dataRpc = null
    expect((await firmarObservacion('obs-1', 'aceptada')).ok).toBe(false)
  })

  it('una excepción de red dice que no se guardó', async () => {
    estado.excepcionRpc = true
    expect(await firmarObservacion('obs-1', 'aceptada')).toEqual({
      ok: false,
      error: 'Sin conexión: la firma no se guardó. Vuelve a intentarlo.',
      yaFirmada: false,
    })
  })

  it('sin la nube no toca la base', async () => {
    estado.activo = false
    const r = await firmarObservacion('obs-1', 'aceptada')

    expect(r.ok).toBe(false)
    expect(estado.rpcs).toEqual([])
  })
})

describe('fechaDeObservacion', () => {
  it('corta el día por la hora de Colombia, no por la del navegador ni por UTC', () => {
    // 03:30 UTC del 9 es 22:30 del 8 en Colombia (jueves 8 de octubre de 2026).
    expect(fechaDeObservacion('2026-10-09T03:30:00Z')).toBe('jue 8 oct 2026')
    // 05:00 UTC ya es el 9 en Colombia.
    expect(fechaDeObservacion('2026-10-09T05:00:00Z')).toBe('vie 9 oct 2026')
  })

  it('lo que no es una fecha vuelve tal cual', () => {
    expect(fechaDeObservacion('ayer')).toBe('ayer')
  })
})
