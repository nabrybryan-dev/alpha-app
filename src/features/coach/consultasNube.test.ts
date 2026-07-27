import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FilaConsulta } from './consultasNube'

/**
 * Supabase falso: solo lo que usa el módulo (select encadenado y update).
 *
 * `nube` es mutable para que cada test decida qué devuelve la base sin volver
 * a montar el mock del módulo.
 */
interface Resultado {
  data: unknown[] | null
  error: { message: string } | null
}

const VACIO: Resultado = { data: [], error: null }

const nube = {
  /** Respuesta de lectura por tabla. */
  tablas: {} as Record<string, Resultado>,
  escritura: VACIO as Resultado,
  /** Campos y fila del último update. */
  ultimoUpdate: undefined as Record<string, unknown> | undefined,
  ultimoId: undefined as string | undefined,
}

function cliente() {
  return {
    from(tabla: string) {
      let esUpdate = false
      const resolver = async (): Promise<Resultado> =>
        esUpdate ? nube.escritura : (nube.tablas[tabla] ?? VACIO)
      const b = {
        select: () => b,
        order: () => b,
        limit: () => b,
        eq: (_columna: string, valor: string) => {
          nube.ultimoId = valor
          return b
        },
        update: (campos: Record<string, unknown>) => {
          esUpdate = true
          nube.ultimoUpdate = campos
          return b
        },
        then: (ok: (r: Resultado) => unknown, mal?: (e: unknown) => unknown) =>
          resolver().then(ok, mal),
      }
      return b
    },
  }
}

vi.mock('../../data/supabase', () => ({ modoNube: true, supabase: () => cliente() }))

// El import va después del mock a propósito: `vi.mock` se iza, pero leerlo en
// este orden deja claro que el módulo siempre ve el Supabase falso.
const { aConsulta, leerConsultas, marcarCorregida, marcarRevisada } = await import('./consultasNube')

function fila(p: Partial<FilaConsulta> = {}): FilaConsulta {
  return {
    id: 'c1',
    usuario_id: 'u1',
    mensaje: 'Me duele la rodilla al bajar en sentadilla',
    ficha_id: 'f-agujetas',
    similitud: 0.62,
    via: 'ficha',
    bandera_roja: true,
    revisado: false,
    corregido: false,
    creado_en: '2026-07-26T10:00:00Z',
    ...p,
  }
}

describe('aConsulta', () => {
  it('traduce la fila de Supabase al modelo de la app', () => {
    expect(aConsulta(fila())).toEqual({
      id: 'c1',
      usuarioId: 'u1',
      mensaje: 'Me duele la rodilla al bajar en sentadilla',
      fichaId: 'f-agujetas',
      similitud: 0.62,
      via: 'ficha',
      banderaRoja: true,
      revisado: false,
      corregido: false,
      creadoEn: '2026-07-26T10:00:00Z',
    })
  })

  it('una via que no reconoce cae en escalado: mejor verla de mas que perderla', () => {
    expect(aConsulta(fila({ via: 'via_que_aun_no_existe' })).via).toBe('escalado')
  })

  it('mantiene las cuatro vias conocidas', () => {
    for (const via of ['ficha', 'ficha_tentativa', 'ia_vivo', 'escalado']) {
      expect(aConsulta(fila({ via })).via).toBe(via)
    }
  })

  it('sin ficha ni similitud no inventa valores', () => {
    const c = aConsulta(fila({ ficha_id: null, similitud: null }))
    expect(c.fichaId).toBeNull()
    expect(c.similitud).toBeNull()
  })

  it('la similitud llega como texto desde numeric y se guarda como numero', () => {
    // PostgREST serializa `numeric` como cadena: sin el Number(), la vista
    // haria `Math.round('0.62' * 100)` y el porcentaje quedaria al azar.
    const c = aConsulta(fila({ similitud: '0.62' as unknown as number }))
    expect(c.similitud).toBe(0.62)
  })
})

describe('leerConsultas', () => {
  beforeEach(() => {
    nube.tablas = {
      consultas_chat: { data: [fila()], error: null },
      usuarios_app: { data: [{ id: 'u1', nombre: 'Daniela Rivera' }], error: null },
      fichas_respuesta: { data: [{ id: 'f-agujetas', titulo: 'Agujetas' }], error: null },
    }
    nube.escritura = VACIO
    nube.ultimoUpdate = undefined
    nube.ultimoId = undefined
  })

  it('trae las consultas con el nombre del asesorado y el titulo de la ficha', async () => {
    const datos = await leerConsultas()
    expect(datos.consultas).toHaveLength(1)
    expect(datos.consultas[0].id).toBe('c1')
    expect(datos.nombres.u1).toBe('Daniela Rivera')
    expect(datos.titulos['f-agujetas']).toBe('Agujetas')
  })

  it('si fallan los nombres y los titulos, las preguntas se siguen viendo', async () => {
    // Van en consultas aparte justo para esto: un adorno caido no puede tumbar
    // la cola entera.
    nube.tablas.usuarios_app = { data: null, error: { message: 'sin permisos' } }
    nube.tablas.fichas_respuesta = { data: null, error: { message: 'sin permisos' } }

    const datos = await leerConsultas()
    expect(datos.consultas).toHaveLength(1)
    expect(datos.nombres).toEqual({})
    expect(datos.titulos).toEqual({})
  })

  it('si falla la lectura principal, lanza con el mensaje de Supabase', async () => {
    nube.tablas.consultas_chat = { data: null, error: { message: 'conexión perdida' } }
    await expect(leerConsultas()).rejects.toThrow('conexión perdida')
  })

  it('sin consultas devuelve listas vacias, no revienta', async () => {
    nube.tablas.consultas_chat = { data: null, error: null }
    const datos = await leerConsultas()
    expect(datos.consultas).toEqual([])
  })
})

describe('marcarRevisada / marcarCorregida', () => {
  beforeEach(() => {
    nube.tablas = {}
    nube.escritura = { data: [fila({ revisado: true, corregido: true })], error: null }
    nube.ultimoUpdate = undefined
    nube.ultimoId = undefined
  })

  it('marcarRevisada toca solo revisado, y solo esa fila', async () => {
    nube.escritura = { data: [fila({ revisado: true })], error: null }
    const c = await marcarRevisada('c1')

    expect(nube.ultimoUpdate).toEqual({ revisado: true })
    expect(nube.ultimoId).toBe('c1')
    expect(c.revisado).toBe(true)
    expect(c.corregido).toBe(false)
  })

  it('marcarCorregida implica revisada: corregirla es haberla visto', async () => {
    const c = await marcarCorregida('c1')

    expect(nube.ultimoUpdate).toEqual({ revisado: true, corregido: true })
    expect(c.revisado).toBe(true)
    expect(c.corregido).toBe(true)
  })

  it('devuelve lo que confirmo Supabase, no lo que se pidio', async () => {
    nube.escritura = { data: [fila({ revisado: true, via: 'escalado' })], error: null }
    const c = await marcarCorregida('c1')
    expect(c.via).toBe('escalado')
  })

  it('si Supabase no devuelve la fila, lanza: un UPDATE que RLS descarta da cero filas', async () => {
    nube.escritura = { data: [], error: null }
    await expect(marcarRevisada('c1')).rejects.toThrow(/no confirmó el cambio/)
  })

  it('si el update devuelve error, lanza ese mensaje', async () => {
    nube.escritura = { data: null, error: { message: 'permiso denegado' } }
    await expect(marcarCorregida('c1')).rejects.toThrow('permiso denegado')
  })
})
