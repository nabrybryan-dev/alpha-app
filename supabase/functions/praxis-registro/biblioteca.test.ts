import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { observarBiblioteca } from './biblioteca'

const FRASE = 'cuánto descanso entre series'
const vector = Array.from({ length: 768 }, () => 0.01)
const entorno = { PORTERO_URL: 'https://portero.test/', PORTERO_CLAVE: 'clave', SUPABASE_URL: 'https://base.test', SUPABASE_ANON_KEY: 'anon' }
const respuesta = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status })

let registro: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  registro = vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => {
  registro.mockRestore()
})

describe('la biblioteca mira y no toca la respuesta', () => {
  it('pide el vector con la clave y busca con el JWT de la persona', async () => {
    const f = vi.fn(async (ruta: string | URL | Request) =>
      String(ruta).endsWith('/vector') ? respuesta({ vector }) : respuesta([{ id: 'nue-cerca-del-fallo', coseno: 0.8312 }]),
    )
    expect(await observarBiblioteca({ entorno, fetch: f as unknown as typeof fetch }, 'jwt', FRASE)).toBe('encontro')
    const [urlVector, pideVector] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(urlVector).toBe('https://portero.test/vector')
    expect((pideVector.headers as Record<string, string>)['x-clave']).toBe('clave')
    const [urlBusca, pideBusca] = f.mock.calls[1] as unknown as [string, RequestInit]
    expect(urlBusca).toBe('https://base.test/rest/v1/rpc/buscar_conceptos_vector')
    expect((pideBusca.headers as Record<string, string>).authorization).toBe('Bearer jwt')
  })

  it('el registro lleva ids y cosenos, nunca la frase', async () => {
    const f = vi.fn(async (ruta: string | URL | Request) =>
      String(ruta).endsWith('/vector') ? respuesta({ vector }) : respuesta([{ id: 'a', coseno: 0.8 }]),
    )
    await observarBiblioteca({ entorno, fetch: f as unknown as typeof fetch }, 'jwt', FRASE)
    const escrito = JSON.stringify(registro.mock.calls)
    expect(escrito).toContain('a:0.800')
    expect(escrito).not.toContain('descanso')
  })

  it.each([
    ['sin secretos, no llama a nadie', { ...entorno, PORTERO_URL: undefined }, null, 'sin_secretos'],
    ['el servicio no responde bien', entorno, respuesta({}, 404), 'vector_http_404'],
    ['un vector de otra forma no se busca', entorno, respuesta({ vector: [1, 2] }), 'vector_ilegible'],
  ])('%s', async (_n, ent, primera, esperado) => {
    const f = vi.fn(async () => primera as Response)
    expect(await observarBiblioteca({ entorno: ent, fetch: f as unknown as typeof fetch }, 'jwt', FRASE)).toBe(esperado)
    expect(f.mock.calls.length).toBe(primera ? 1 : 0)
  })

  it('un fallo de red no revienta', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('caída')
    })
    expect(await observarBiblioteca({ entorno, fetch: f as unknown as typeof fetch }, 'jwt', FRASE)).toBe('error_TypeError')
  })

  it('la búsqueda rechazada queda anotada', async () => {
    const f = vi.fn(async (ruta: string | URL | Request) => (String(ruta).endsWith('/vector') ? respuesta({ vector }) : respuesta({}, 401)))
    expect(await observarBiblioteca({ entorno, fetch: f as unknown as typeof fetch }, 'jwt', FRASE)).toBe('busqueda_http_401')
  })
})
