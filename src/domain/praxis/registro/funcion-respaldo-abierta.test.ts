// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * El día que Praxis se abra a asesorados, el respaldo sin modelo NO se abre con ella: sin el lector de riesgo, un
 * asesorado sigue recibiendo el 502 y su frase no sale hacia el portero. Aquí se simula esa apertura.
 */
vi.mock('../acceso.ts', () => ({ puedeVerPraxis: () => true, esStaff: () => false, PRAXIS_ABIERTA_A_ASESORADOS: true }))

const { manejar } = await import('../../../../supabase/functions/praxis-registro/index.ts')

afterEach(() => vi.restoreAllMocks())

describe('praxis-registro: respaldo sin modelo con Praxis abierta', () => {
  it('un asesorado recibe el 502 y su frase no llega al portero', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const urls: string[] = []
    const fetchSim = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url)
      urls.push(u)
      if (/auth\/v1\/user/.test(u)) return new Response(JSON.stringify({ id: 'u-1' }))
      if (/rest\/v1\/usuarios_app/.test(u)) return new Response(JSON.stringify([{ rol: 'asesorado' }]))
      if (/rest\/v1\//.test(u)) return new Response('[]')
      return new Response(JSON.stringify({ error: { message: 'Your credit balance is too low' } }), { status: 400 })
    })
    const r = await manejar(new Request('https://x.supabase.co/functions/v1/praxis-registro', {
      method: 'POST', headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' }, body: JSON.stringify({ frase: 'si no llego al rango le bajo al peso?' }),
    }), {
      entorno: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'sk-prueba-no-real', PORTERO_URL: 'https://portero.prueba', PORTERO_CLAVE: 'clave' },
      fetch: fetchSim as unknown as typeof fetch,
      ahora: () => new Date('2026-10-31T15:00:00Z'),
    })
    expect(r.status).toBe(502)
    expect(urls.some((u) => u.startsWith('https://portero.prueba'))).toBe(false)
  })
})
