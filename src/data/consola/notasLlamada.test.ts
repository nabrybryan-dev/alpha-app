import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Mismo patrón que `casosFirma.test.ts`: se mockea `../supabase`, no este archivo, para
 *  probar el camino real que arma cada llamada.
 *
 *  El doble REGISTRA los argumentos de cada eslabón de la cadena (`from`, `select`, `eq`,
 *  `order`, `insert`): una prueba que solo mira lo que devuelve el doble no ve si la consulta
 *  se pidió bien (otra tabla, otro asesorado, otro orden) y pasa igual. */
const estado = {
  activo: true,
  filasSelect: [] as unknown[],
  errorSelect: null as { message: string; code?: string } | null,
  /** `data: null` sin error: la base no dijo ni sí ni no. */
  sinDatosSelect: false,
  excepcionSelect: false,
  filaInsertada: null as unknown,
  errorInsert: null as { message: string; code?: string } | null,
  excepcionInsert: false,
  // Lo que llegó a la base, en orden.
  tablas: [] as string[],
  selects: [] as string[],
  eqs: [] as unknown[][],
  orders: [] as unknown[][],
  inserts: [] as unknown[],
}

/** Un eslabón de la cadena `select().eq().order()…`: anotado a mano porque se devuelve a sí
 *  mismo y TypeScript no puede inferir un tipo que se refiere a sí mismo. */
interface Lectura {
  eq: (...args: unknown[]) => Lectura
  order: (...args: unknown[]) => Lectura | Promise<{ data: unknown; error: { message: string; code?: string } | null }>
}

vi.mock('../supabase', () => ({
  get modoNube() {
    return estado.activo
  },
  supabase: () => ({
    from: (tabla: string) => {
      estado.tablas.push(tabla)
      if (tabla !== 'notas_llamada') throw new Error(`tabla inesperada: ${tabla}`)
      return {
        select: (columnas: string) => {
          estado.selects.push(columnas)
          let ordenes = 0
          const lectura: Lectura = {
            eq: (...args: unknown[]) => {
              estado.eqs.push(args)
              return lectura
            },
            order: (...args: unknown[]) => {
              estado.orders.push(args)
              ordenes += 1
              // El tercer `order` es el último eslabón: ahí la consulta se resuelve.
              if (ordenes < 3) return lectura
              if (estado.excepcionSelect) return Promise.reject(new Error('Failed to fetch'))
              return Promise.resolve({
                data: estado.sinDatosSelect ? null : estado.filasSelect,
                error: estado.errorSelect,
              })
            },
          }
          return lectura
        },
        insert: (fila: unknown) => {
          estado.inserts.push(fila)
          return {
            select: () => ({
              single: () => {
                if (estado.excepcionInsert) return Promise.reject(new Error('Failed to fetch'))
                return Promise.resolve({ data: estado.filaInsertada, error: estado.errorInsert })
              },
            }),
          }
        },
      }
    },
  }),
}))

const { notasLlamadaDe, agregarNotaLlamada, COLUMNAS_NOTAS_LLAMADA, fechaDeLlamada, horaDeLlamada } =
  await import('./notasLlamada')

/** La fila tal como la devuelve la base: `time` baja como `HH:MM:SS`, no como `HH:MM`. */
function filaCruda(extra: Record<string, unknown> = {}) {
  return {
    id: 'nota-1',
    usuario_id: 'u-1',
    coach_id: 'u-manuela',
    fecha: '2026-10-08',
    hora: '18:30:00',
    conclusiones: 'Se sintió bien con la sentadilla, le cuesta el desayuno antes de entrenar.',
    tareas: 'Mandar el menú del jueves',
    proxima_reunion: 'en 2 semanas',
    creado_en: '2026-10-08T23:30:00Z',
    ...extra,
  }
}

beforeEach(() => {
  estado.activo = true
  estado.filasSelect = []
  estado.errorSelect = null
  estado.sinDatosSelect = false
  estado.excepcionSelect = false
  estado.filaInsertada = null
  estado.errorInsert = null
  estado.excepcionInsert = false
  estado.tablas = []
  estado.selects = []
  estado.eqs = []
  estado.orders = []
  estado.inserts = []
})

describe('COLUMNAS_NOTAS_LLAMADA', () => {
  it('«tareas» va justo después de «conclusiones»', () => {
    const columnas: readonly string[] = COLUMNAS_NOTAS_LLAMADA
    expect(columnas.indexOf('tareas')).toBe(columnas.indexOf('conclusiones') + 1)
  })
})

describe('notasLlamadaDe', () => {
  it('trae las notas, con su hora tal como baja de la base, y las pasa a camelCase', async () => {
    estado.filasSelect = [filaCruda()]
    const resultado = await notasLlamadaDe('u-1')
    expect(resultado).toEqual({
      ok: true,
      notas: [
        {
          id: 'nota-1',
          usuarioId: 'u-1',
          coachId: 'u-manuela',
          fecha: '2026-10-08',
          hora: '18:30:00',
          conclusiones: 'Se sintió bien con la sentadilla, le cuesta el desayuno antes de entrenar.',
          tareas: 'Mandar el menú del jueves',
          proximaReunion: 'en 2 semanas',
          creadoEn: '2026-10-08T23:30:00Z',
        },
      ],
    })
  })

  it('una fila anterior a la 0113 trae tareas null y se queda en null', async () => {
    estado.filasSelect = [filaCruda({ tareas: null })]
    const resultado = await notasLlamadaDe('u-1')
    expect(resultado.ok && resultado.notas[0].tareas).toBeNull()
  })

  it('pide la tabla correcta, SOLO las notas de ese asesorado y las columnas nuevas', async () => {
    await notasLlamadaDe('u-1')
    expect(estado.tablas).toEqual(['notas_llamada'])
    expect(estado.eqs).toEqual([['usuario_id', 'u-1']])
    expect(estado.selects).toEqual([COLUMNAS_NOTAS_LLAMADA.join(',')])
    expect(estado.selects[0]).toContain('tareas')
  })

  it('ordena por fecha desc, luego hora desc con los null al final, luego creado_en desc', async () => {
    await notasLlamadaDe('u-1')
    expect(estado.orders).toEqual([
      ['fecha', { ascending: false }],
      ['hora', { ascending: false, nullsFirst: false }],
      ['creado_en', { ascending: false }],
    ])
  })

  it('sin conexión o sin usuario: ok con lista vacía, y ni siquiera toca la base', async () => {
    expect(await notasLlamadaDe('')).toEqual({ ok: true, notas: [] })
    estado.activo = false
    expect(await notasLlamadaDe('u-1')).toEqual({ ok: true, notas: [] })
    expect(estado.tablas).toEqual([])
  })

  it('un error de la base NO se parece a «no hay notas»: ok:false con texto en español', async () => {
    estado.errorSelect = { message: 'JWT expired' }
    const resultado = await notasLlamadaDe('u-1')
    expect(resultado).toEqual({ ok: false, error: 'No se pudieron cargar las notas de llamada.' })
  })

  it('una excepción (sin red) tampoco se traga: ok:false', async () => {
    estado.excepcionSelect = true
    const resultado = await notasLlamadaDe('u-1')
    expect(resultado).toEqual({ ok: false, error: 'No se pudieron cargar las notas de llamada.' })
  })

  it('una respuesta sin datos y sin error tampoco se toma por «lista vacía»', async () => {
    estado.sinDatosSelect = true
    const resultado = await notasLlamadaDe('u-1')
    expect(resultado.ok).toBe(false)
  })
})

describe('agregarNotaLlamada', () => {
  it('manda usuario/fecha/hora/conclusiones/tareas/proxima_reunion, NUNCA coach_id: lo pone la columna', async () => {
    estado.filaInsertada = filaCruda()
    const resultado = await agregarNotaLlamada('u-1', {
      fecha: '2026-10-08',
      hora: '18:30',
      conclusiones: 'Se sintió bien con la sentadilla, le cuesta el desayuno antes de entrenar.',
      tareas: 'Mandar el menú del jueves',
      proximaReunion: 'en 2 semanas',
    })
    expect(resultado.ok).toBe(true)
    expect(estado.inserts).toEqual([
      {
        usuario_id: 'u-1',
        fecha: '2026-10-08',
        hora: '18:30',
        conclusiones: 'Se sintió bien con la sentadilla, le cuesta el desayuno antes de entrenar.',
        tareas: 'Mandar el menú del jueves',
        proxima_reunion: 'en 2 semanas',
      },
    ])
    expect('coach_id' in (estado.inserts[0] as object)).toBe(false)
  })

  it('devuelve la nota que guardó la base, con sus tareas', async () => {
    estado.filaInsertada = filaCruda()
    const resultado = await agregarNotaLlamada('u-1', { fecha: '2026-10-08', conclusiones: 'Algo.' })
    expect(resultado.ok && resultado.nota.tareas).toBe('Mandar el menú del jueves')
  })

  it('hora, tareas y próxima reunión son opcionales: viajan null, no se omiten', async () => {
    estado.filaInsertada = filaCruda({ hora: null, tareas: null, proxima_reunion: null })
    await agregarNotaLlamada('u-1', { fecha: '2026-10-08', conclusiones: 'Llamada corta.' })
    expect(estado.inserts).toEqual([
      {
        usuario_id: 'u-1',
        fecha: '2026-10-08',
        hora: null,
        conclusiones: 'Llamada corta.',
        tareas: null,
        proxima_reunion: null,
      },
    ])
  })

  it('las tareas se recortan; en blanco viajan null', async () => {
    estado.filaInsertada = filaCruda()
    await agregarNotaLlamada('u-1', { fecha: '2026-10-08', conclusiones: 'Algo.', tareas: '  Medir cintura  ' })
    await agregarNotaLlamada('u-1', { fecha: '2026-10-08', conclusiones: 'Algo.', tareas: '   ' })
    expect((estado.inserts[0] as { tareas: unknown }).tareas).toBe('Medir cintura')
    expect((estado.inserts[1] as { tareas: unknown }).tareas).toBeNull()
  })

  it('sin conclusiones, ni siquiera llama a la base', async () => {
    const resultado = await agregarNotaLlamada('u-1', { fecha: '2026-10-08', conclusiones: '   ' })
    expect(resultado).toEqual({ ok: false, error: 'Escribe qué se habló en la llamada.' })
    expect(estado.tablas).toEqual([])
  })

  it('una fecha vacía se rechaza en español, sin tocar la base', async () => {
    const resultado = await agregarNotaLlamada('u-1', { fecha: '', conclusiones: 'Algo.' })
    expect(resultado).toEqual({ ok: false, error: 'Pon la fecha de la llamada.' })
    expect(estado.tablas).toEqual([])
    expect(estado.inserts).toEqual([])
  })

  it('una fecha que no es AAAA-MM-DD tampoco llega a la base', async () => {
    const resultado = await agregarNotaLlamada('u-1', { fecha: '8/10/2026', conclusiones: 'Algo.' })
    expect(resultado).toEqual({ ok: false, error: 'Pon la fecha de la llamada.' })
    expect(estado.inserts).toEqual([])
  })

  it('sin permiso, da el mensaje en español, no el código crudo', async () => {
    estado.errorInsert = { message: 'permission denied', code: '42501' }
    const resultado = await agregarNotaLlamada('u-1', { fecha: '2026-10-08', conclusiones: 'Algo.' })
    expect(resultado).toEqual({ ok: false, error: 'No tienes permiso para anotar llamadas de este asesorado.' })
  })

  it('cualquier otro error de la base da el mensaje genérico en español, NO el crudo de PostgREST', async () => {
    estado.errorInsert = {
      message: 'invalid input syntax for type date: ""',
      code: '22007',
    }
    const resultado = await agregarNotaLlamada('u-1', { fecha: '2026-10-08', conclusiones: 'Algo.' })
    expect(resultado).toEqual({ ok: false, error: 'No se pudo guardar la nota. Vuelve a intentarlo.' })
    expect(JSON.stringify(resultado)).not.toContain('invalid input syntax')
  })

  it('una excepción de red da el mensaje de sin conexión, no «Failed to fetch»', async () => {
    estado.excepcionInsert = true
    const resultado = await agregarNotaLlamada('u-1', { fecha: '2026-10-08', conclusiones: 'Algo.' })
    expect(resultado).toEqual({ ok: false, error: 'Sin conexión: la nota no se guardó. Vuelve a intentarlo.' })
  })

  it('sin modo nube, ni siquiera llama a la base', async () => {
    estado.activo = false
    const resultado = await agregarNotaLlamada('u-1', { fecha: '2026-10-08', conclusiones: 'Algo.' })
    expect(resultado).toEqual({ ok: false, error: 'Sin conexión con la base: esto es un demo.' })
    expect(estado.tablas).toEqual([])
  })
})

describe('fechaDeLlamada', () => {
  it('arma «día de la semana, día, mes, año» a mano', () => {
    expect(fechaDeLlamada('2026-10-08')).toBe('jue 8 oct 2026')
    expect(fechaDeLlamada('2026-01-01')).toBe('jue 1 ene 2026')
  })

  it('cubre los siete días de la semana (la semana del 4 al 10 de oct de 2026)', () => {
    const dias = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10']
    expect(dias.map((d) => fechaDeLlamada(d).slice(0, 3))).toEqual(['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'])
  })

  it('un texto que no es una fecha de verdad vuelve tal cual, sin inventar nada', () => {
    expect(fechaDeLlamada('')).toBe('')
    expect(fechaDeLlamada('pronto')).toBe('pronto')
    expect(fechaDeLlamada('2026-02-31')).toBe('2026-02-31')
  })

  it('no depende de la zona horaria: en Colombia (UTC−5) sigue siendo jueves 8, no miércoles 7', () => {
    const antes = process.env.TZ
    try {
      process.env.TZ = 'America/Bogota'
      // Control positivo: con esta zona, `new Date('2026-10-08')` (UTC) SÍ cae el día anterior.
      // Si esta línea falla, el entorno no deja cambiar la zona y la prueba no prueba nada.
      expect(new Date('2026-10-08').getDate()).toBe(7)
      expect(fechaDeLlamada('2026-10-08')).toBe('jue 8 oct 2026')
      process.env.TZ = 'Pacific/Auckland'
      expect(fechaDeLlamada('2026-10-08')).toBe('jue 8 oct 2026')
    } finally {
      if (antes === undefined) delete process.env.TZ
      else process.env.TZ = antes
    }
  })
})

describe('horaDeLlamada', () => {
  it('corta los segundos que devuelve la base', () => {
    expect(horaDeLlamada('18:30:00')).toBe('18:30')
    expect(horaDeLlamada('07:05:09')).toBe('07:05')
  })

  it('una hora que ya viene HH:MM se queda igual', () => {
    expect(horaDeLlamada('18:30')).toBe('18:30')
  })

  it('un texto que no es una hora vuelve tal cual', () => {
    expect(horaDeLlamada('tarde')).toBe('tarde')
  })
})
