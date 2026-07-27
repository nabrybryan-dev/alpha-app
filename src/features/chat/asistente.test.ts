import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pedirRespuestaAlpha } from './asistente'

const sesion = { access_token: 'tok', url: 'https://x.supabase.co' }

describe('pedirRespuestaAlpha', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('manda el mensaje con el token en la cabecera', async () => {
    const fetchSimulado = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ respuesta: 'Baja hasta la paralela.', via: 'ficha' }),
    })
    vi.stubGlobal('fetch', fetchSimulado)

    const r = await pedirRespuestaAlpha('hasta donde bajo', sesion)

    expect(r).toBe('Baja hasta la paralela.')
    const [url, init] = fetchSimulado.mock.calls[0]
    expect(url).toContain('/functions/v1/responder-chat')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body as string)).toEqual({ mensaje: 'hasta donde bajo' })
  })

  it('NO manda el usuario_id: lo decide el servidor', async () => {
    const fetchSimulado = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ respuesta: 'x', via: 'ficha' }),
    })
    vi.stubGlobal('fetch', fetchSimulado)
    await pedirRespuestaAlpha('hola', sesion)
    expect(fetchSimulado.mock.calls[0][1].body).not.toContain('usuario_id')
  })

  it('devuelve null si la funcion falla, sin lanzar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await expect(pedirRespuestaAlpha('hola', sesion)).resolves.toBeNull()
  })

  it('devuelve null si no hay red, sin lanzar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')))
    await expect(pedirRespuestaAlpha('hola', sesion)).resolves.toBeNull()
  })

  it('devuelve null sin sesion', async () => {
    await expect(pedirRespuestaAlpha('hola', null)).resolves.toBeNull()
  })
})
