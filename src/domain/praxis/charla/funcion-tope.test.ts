// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { MAX_POR_HORA, manejar, type Dependencias } from '../../../../supabase/functions/praxis-registro/index.ts'

/** El tope por persona y hora (Bryan, 3-oct-2026): 60. Archivo aparte porque la cuenta vive en memoria del módulo. */
const AHORA = new Date('2026-10-03T23:40:00Z')
const registrador = { content: [{ type: 'tool_use', name: 'registrar', input: { intencion: ['charla'], respuesta_charla: 'Bien.' } }], usage: {} }
const lector = { content: [{ type: 'text', text: JSON.stringify({ nivel: 'NINGUNO', cita: '', por_que: 'p' }) }] }
const d: Dependencias = {
  entorno: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'sk-prueba-no-real' },
  fetch: vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    if (/auth\/v1\/user/.test(u)) return new Response(JSON.stringify({ id: 'u-tope' }))
    if (/usuarios_app/.test(u)) return new Response(JSON.stringify([{ rol: 'coach' }]))
    if (/microciclos/.test(u)) return new Response('[]')
    if (u.includes('api.anthropic.com')) return new Response(JSON.stringify(String(init?.body).includes('"tools"') ? registrador : lector))
    return new Response('{}', { status: 404 })
  }) as unknown as typeof fetch,
  ahora: () => AHORA,
}
const enviar = () => manejar(new Request('https://x.supabase.co/functions/v1/praxis-registro', {
  method: 'POST', headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' }, body: JSON.stringify({ frase: 'qué más' }),
}), d)

describe('tope de mensajes por hora', () => {
  it('es 60 (no 30)', () => { expect(MAX_POR_HORA).toBe(60) })
  it('los primeros 60 pasan y el 61 recibe 429', async () => {
    for (let i = 1; i <= 60; i++) expect((await enviar()).status, `mensaje ${i}`).toBe(200)
    expect((await enviar()).status).toBe(429)
  }, 60_000)
})
