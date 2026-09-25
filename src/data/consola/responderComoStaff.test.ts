import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface FilaError {
  code?: string
  message: string
}

const estado = {
  activo: true,
  error: null as FilaError | null,
  llamadas: [] as { nombre: string; parametros: Record<string, unknown> }[],
}

function cliente() {
  return {
    rpc: (nombre: string, parametros: Record<string, unknown>) => {
      estado.llamadas.push({ nombre, parametros })
      return Promise.resolve({ data: null, error: estado.error })
    },
  }
}

vi.mock('../supabase', () => ({
  get modoNube() {
    return estado.activo
  },
  supabase: () => cliente(),
}))

const { responderComoStaff } = await import('./responderComoStaff')

beforeEach(() => {
  estado.activo = true
  estado.error = null
  estado.llamadas = []
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('responderComoStaff', () => {
  it('en modo demo no llama a la base', async () => {
    estado.activo = false
    const resultado = await responderComoStaff('q-1', { texto: 'bien' })
    expect(resultado).toEqual({ ok: false, error: 'Sin conexión con la base: esto es un demo.' })
    expect(estado.llamadas).toEqual([])
  })

  it('llama a la RPC responder_como_staff con exactamente cuestionario_id y respuesta', async () => {
    await responderComoStaff('q-42', { texto: 'dijo que sí pudo entrenar' })
    expect(estado.llamadas).toEqual([
      {
        nombre: 'responder_como_staff',
        parametros: { cuestionario_id: 'q-42', respuesta: { texto: 'dijo que sí pudo entrenar' } },
      },
    ])
  })

  it('nunca manda un actor: la RPC lo saca de auth.uid() en el servidor', async () => {
    await responderComoStaff('q-42', { texto: 'x', _respondido_por: 'alguien-falso' })
    const parametros = estado.llamadas[0].parametros
    expect(parametros).toEqual({ cuestionario_id: 'q-42', respuesta: { texto: 'x', _respondido_por: 'alguien-falso' } })
    expect(Object.keys(parametros)).toEqual(['cuestionario_id', 'respuesta'])
  })

  it('éxito: { ok: true }', async () => {
    await expect(responderComoStaff('q-1', {})).resolves.toEqual({ ok: true })
  })

  it('42501 (sin la capacidad) se traduce a un mensaje legible', async () => {
    estado.error = { code: '42501', message: 'denied' }
    await expect(responderComoStaff('q-1', {})).resolves.toEqual({
      ok: false,
      error: 'No tienes permiso para responder por el asesorado.',
    })
  })

  it('P0002 (cuestionario sin un único destinatario) se traduce a un mensaje legible', async () => {
    estado.error = { code: 'P0002', message: 'no rows' }
    const resultado = await responderComoStaff('q-1', {})
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.error).toMatch(/asignado a más de una persona/)
  })
})
