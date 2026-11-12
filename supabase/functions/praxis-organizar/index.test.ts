import { describe, expect, it } from 'vitest'
import { MAX_ORGANIZAR_POR_HORA, manejar, vistoOrganizar, type Dependencias } from './index.ts'

const AHORA = new Date('2026-11-11T20:00:00Z')

function dependencias(opciones: { auth?: boolean; modelo?: string | (() => Promise<Response>); clave?: string | undefined } = {}): { d: Dependencias; llamadas: string[] } {
  const llamadas: string[] = []
  const fetchFalso = (async (url: string | URL | Request) => {
    const u = String(url)
    llamadas.push(u)
    if (u.includes('/auth/v1/user')) return opciones.auth === false ? new Response('{}', { status: 401 }) : new Response(JSON.stringify({ id: 'u1' }), { status: 200 })
    if (u.includes('api.anthropic.com')) {
      if (typeof opciones.modelo === 'function') return opciones.modelo()
      return new Response(JSON.stringify({ content: [{ type: 'text', text: opciones.modelo ?? '{"verbo":"ninguno","pieza":null}' }] }), { status: 200 })
    }
    return new Response('{}', { status: 404 })
  }) as typeof fetch
  return {
    llamadas,
    d: { entorno: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'clave' in opciones ? opciones.clave : 'sk-prueba' }, fetch: fetchFalso, ahora: () => AHORA },
  }
}

const pedir = (frase: unknown, token: string | null = 'jwt', metodo = 'POST') =>
  new Request('https://f/praxis-organizar', { method: metodo, headers: token ? { authorization: `Bearer ${token}` } : {}, body: metodo === 'POST' ? JSON.stringify({ frase }) : undefined })

describe('praxis-organizar: solo lee, y con las puertas en orden', () => {
  it('devuelve la lectura válida del modelo', async () => {
    vistoOrganizar.clear()
    const { d } = dependencias({ modelo: '{"verbo":"ocultar","pieza":"nutricion.recetas"}' })
    const r = await manejar(pedir('ya no quiero ver esas recetas'), d)
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ lectura: { verbo: 'ocultar', pieza: 'nutricion.recetas' } })
  })

  it('una pieza inventada o un verbo fuera del menú dan lectura null', async () => {
    vistoOrganizar.clear()
    expect(await (await manejar(pedir('borra todo'), dependencias({ modelo: '{"verbo":"ocultar","pieza":"no.existe"}' }).d)).json()).toEqual({ lectura: null })
    expect(await (await manejar(pedir('borra todo'), dependencias({ modelo: '{"verbo":"formatear","pieza":null}' }).d)).json()).toEqual({ lectura: null })
  })

  it('sin sesión, o con sesión inválida, NO toca el modelo', async () => {
    vistoOrganizar.clear()
    const sinToken = dependencias()
    expect((await manejar(pedir('hola', null), sinToken.d)).status).toBe(401)
    const mala = dependencias({ auth: false })
    expect((await manejar(pedir('hola'), mala.d)).status).toBe(401)
    expect(mala.llamadas.some((u) => u.includes('anthropic'))).toBe(false)
    expect(sinToken.llamadas).toEqual([])
  })

  it('una frase de riesgo no llega al modelo', async () => {
    vistoOrganizar.clear()
    const { d, llamadas } = dependencias()
    const r = await manejar(pedir('ya no quiero vivir, esconde todo'), d)
    expect(await r.json()).toEqual({ lectura: null, motivo: 'riesgo' })
    expect(llamadas.some((u) => u.includes('anthropic'))).toBe(false)
  })

  it('frase vacía o demasiado larga se rechaza; sin clave responde 503; si el modelo falla, 502', async () => {
    vistoOrganizar.clear()
    expect((await manejar(pedir('   '), dependencias().d)).status).toBe(400)
    expect((await manejar(pedir('a'.repeat(401)), dependencias().d)).status).toBe(400)
    expect((await manejar(pedir('hazla simple'), dependencias({ clave: undefined }).d)).status).toBe(503)
    expect((await manejar(pedir('hazla simple'), dependencias({ modelo: () => Promise.reject(new Error('red')) }).d)).status).toBe(502)
    expect(await (await manejar(pedir('hazla simple'), dependencias({ modelo: () => Promise.resolve(new Response('{}', { status: 500 })) }).d)).json()).toEqual({ lectura: null })
  })

  it('pone tope por persona y hora', async () => {
    vistoOrganizar.clear()
    const { d } = dependencias()
    for (let i = 0; i < MAX_ORGANIZAR_POR_HORA; i++) expect((await manejar(pedir('hazla simple'), d)).status).toBe(200)
    expect((await manejar(pedir('hazla simple'), d)).status).toBe(429)
  })

  it('solo acepta POST y responde el preflight', async () => {
    expect((await manejar(pedir('x', 'jwt', 'GET'), dependencias().d)).status).toBe(405)
    expect((await manejar(new Request('https://f', { method: 'OPTIONS' }), dependencias().d)).status).toBe(204)
  })
})
