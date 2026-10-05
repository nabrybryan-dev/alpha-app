import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface FilaError {
  code?: string
  message: string
}

const estado = {
  activo: true,
  filas: [] as unknown[],
  errorLectura: null as FilaError | null,
  errorRpc: null as FilaError | null,
  llamadas: [] as { nombre: string; parametros: Record<string, unknown> }[],
  tablas: [] as string[],
}

function cliente() {
  return {
    from: (tabla: string) => {
      estado.tablas.push(tabla)
      const b = {
        select: () => b,
        order: () => b,
        limit: () => Promise.resolve({ data: estado.errorLectura ? null : estado.filas, error: estado.errorLectura }),
      }
      return b
    },
    rpc: (nombre: string, parametros: Record<string, unknown>) => {
      estado.llamadas.push({ nombre, parametros })
      return Promise.resolve({ data: null, error: estado.errorRpc })
    },
  }
}

vi.mock('../supabase', () => ({
  get modoNube() {
    return estado.activo
  },
  supabase: () => cliente(),
}))

const { respuestasDelCoach, responderPreguntaCoach } = await import('./respuestasCoach')

const entrada = {
  idPregunta: 'cp-0123456789abcdef', usuarioId: 'u-1', paso: 2, texto: '¿Cuánto?', respuesta: ' B · 25 ',
}

beforeEach(() => {
  estado.activo = true
  estado.filas = []
  estado.errorLectura = null
  estado.errorRpc = null
  estado.llamadas = []
  estado.tablas = []
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('respuestasDelCoach', () => {
  it('lee de respuestas_coach_cadena y acomoda las columnas', async () => {
    estado.filas = [{
      id_pregunta: 'cp-0123456789abcdef', usuario_id: 'u-1', paso: 2, texto: 't', respuesta: 'r',
      respondido_por: 'c-1', quien: 'Bryan', respondido_en: '2026-10-03T10:00:00Z',
    }]
    const r = await respuestasDelCoach()
    expect(estado.tablas).toEqual(['respuestas_coach_cadena'])
    expect(r).toEqual({
      ok: true,
      datos: [{
        idPregunta: 'cp-0123456789abcdef', usuarioId: 'u-1', paso: 2, texto: 't', respuesta: 'r',
        respondidoPor: 'c-1', quien: 'Bryan', respondidoEn: '2026-10-03T10:00:00Z',
      }],
    })
  })

  it('sin la migración (42P01 o PGRST205) dice sinTabla', async () => {
    estado.errorLectura = { code: 'PGRST205', message: 'no existe' }
    expect(await respuestasDelCoach()).toMatchObject({ ok: false, sinTabla: true })
    estado.errorLectura = { code: '42P01', message: 'no existe' }
    expect(await respuestasDelCoach()).toMatchObject({ ok: false, sinTabla: true })
  })

  it('otro fallo NO se disfraza de «sin respuestas» ni de falta de migración', async () => {
    estado.errorLectura = { code: '500', message: 'caída' }
    expect(await respuestasDelCoach()).toEqual({ ok: false, error: 'caída', sinTabla: false })
  })

  it('en modo demo es un vacío confirmado y no llama a la base', async () => {
    estado.activo = false
    expect(await respuestasDelCoach()).toEqual({ ok: true, datos: [] })
    expect(estado.tablas).toEqual([])
  })
})

describe('responderPreguntaCoach', () => {
  it('llama a la RPC responder_pregunta_coach, sin mandar actor, con la respuesta recortada', async () => {
    const r = await responderPreguntaCoach(entrada)
    expect(r).toEqual({ ok: true })
    expect(estado.llamadas).toEqual([{
      nombre: 'responder_pregunta_coach',
      parametros: {
        p_id_pregunta: 'cp-0123456789abcdef', p_usuario_id: 'u-1', p_paso: 2, p_texto: '¿Cuánto?',
        p_respuesta: 'B · 25',
      },
    }])
  })

  it('una respuesta vacía no llega a la base', async () => {
    const r = await responderPreguntaCoach({ ...entrada, respuesta: '   ' })
    expect(r.ok).toBe(false)
    expect(estado.llamadas).toEqual([])
  })

  it('sin la migración (PGRST202) lo dice y marca sinMigracion', async () => {
    estado.errorRpc = { code: 'PGRST202', message: 'no function' }
    expect(await responderPreguntaCoach(entrada)).toMatchObject({ ok: false, sinMigracion: true })
  })

  it('sin permiso (42501) lo dice con palabras', async () => {
    estado.errorRpc = { code: '42501', message: 'x' }
    const r = await responderPreguntaCoach(entrada)
    expect(r).toMatchObject({ ok: false, sinMigracion: false })
    expect(!r.ok && r.error).toMatch(/solo el coach o la nutricionista/)
  })

  it('en modo demo no simula el éxito', async () => {
    estado.activo = false
    expect((await responderPreguntaCoach(entrada)).ok).toBe(false)
    expect(estado.llamadas).toEqual([])
  })
})
