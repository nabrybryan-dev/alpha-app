// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manejar, type Dependencias } from '../../../../supabase/functions/praxis-registro/index.ts'

/**
 * Praxis se abre por ROL del equipo O por PUESTO (Bryan, 23-oct-2026). La cuenta personal de Bryan es `asesorado`
 * con la capacidad `puesto_de_coach` (migración 0106), y la función la rechazaba porque solo miraba el rol.
 *   - asesorado CON puesto entra; asesorado SIN puesto sigue en 403 (Praxis cerrada a asesorados);
 *   - si el puesto no se puede leer (error, red, respuesta rara) se cierra, como con un rol desconocido;
 *   - coach y nutricionista siguen entrando sin tener la capacidad;
 *   - el puesto se lee con el JWT de la persona (RLS), nunca con otra llave, y por su propio id;
 *   - ninguna frase llega a Anthropic si la puerta está cerrada.
 */
const AHORA = new Date('2026-10-29T15:00:00Z')
const YO = '11111111-1111-4111-8111-111111111111'
const b64u = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwtDe = (sub: string) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub, role: 'authenticated' })}.firma`
const registrador = { content: [{ type: 'tool_use', name: 'registrar', input: { intencion: ['charla'], entreno: [], comida: null, vida: null, sesion: null, correccion: null, aclaracion: null, clinico: { hay: false, cita: null }, fuera_de_alcance: true } }], usage: { input_tokens: 1800, output_tokens: 220 } }
const lector = { content: [{ type: 'text', text: JSON.stringify({ nivel: 'NINGUNO', cita: '', por_que: 'prueba' }) }] }

type Puesto = 'si' | 'no' | 'error-500' | 'cae' | 'basura'

function entorno(rol: string | null, puesto: Puesto) {
  const llamadas: { url: string; init?: RequestInit }[] = []
  const fetchSim = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    llamadas.push({ url: u, init })
    if (/auth\/v1\/user/.test(u)) return new Response(JSON.stringify({ id: YO }))
    if (/rest\/v1\/usuarios_app/.test(u)) return rol === null ? new Response('{}', { status: 404 }) : new Response(JSON.stringify([{ rol }]))
    if (/rest\/v1\/capacidades_staff/.test(u)) {
      if (puesto === 'cae') throw new Error('red caída')
      if (puesto === 'error-500') return new Response('{}', { status: 500 })
      if (puesto === 'basura') return new Response(JSON.stringify({ no: 'es una lista' }))
      return new Response(JSON.stringify(puesto === 'si' ? [{ capacidad: 'puesto_de_coach' }] : []))
    }
    if (/rest\/v1\/microciclos/.test(u)) return new Response('[]')
    if (u.includes('api.anthropic.com')) return String(init?.body ?? '').includes('"tools"') ? new Response(JSON.stringify(registrador)) : new Response(JSON.stringify(lector))
    return new Response('{}', { status: 404 })
  })
  const d: Dependencias = {
    entorno: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'sk-prueba-no-real' },
    fetch: fetchSim as unknown as typeof fetch,
    ahora: () => AHORA,
  }
  return { d, llamadas, aAnthropic: () => llamadas.filter((l) => l.url.includes('api.anthropic.com')) }
}
const post = (token: string) =>
  new Request('https://x.supabase.co/functions/v1/praxis-registro', {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ frase: 'hice 4 series de sentadilla con 60' }),
  })

afterEach(() => { vi.restoreAllMocks() })

describe('el puesto de coach abre Praxis aunque el rol sea asesorado', () => {
  it('asesorado CON puesto_de_coach entra (200) y el modelo se llama', async () => {
    const e = entorno('asesorado', 'si')
    const r = await manejar(post(jwtDe(YO)), e.d)
    expect(r.status).toBe(200)
    expect(e.aAnthropic().length).toBeGreaterThan(0)
  })

  it('asesorado SIN puesto: 403 y 0 llamadas a Anthropic', async () => {
    const e = entorno('asesorado', 'no')
    const r = await manejar(post(jwtDe(YO)), e.d)
    expect(r.status).toBe(403)
    expect(e.aAnthropic()).toHaveLength(0)
  })

  it.each(['error-500', 'cae', 'basura'] as Puesto[])('puesto ilegible (%s): se cierra, 403 y 0 llamadas', async (p) => {
    const e = entorno('asesorado', p)
    const r = await manejar(post(jwtDe(YO)), e.d)
    expect(r.status).toBe(403)
    expect(e.aAnthropic()).toHaveLength(0)
  })

  it.each(['coach', 'nutricionista'])('%s sigue entrando sin la capacidad, aun con el puesto ilegible', async (rol) => {
    for (const p of ['no', 'cae'] as Puesto[]) {
      const e = entorno(rol, p)
      expect((await manejar(post(jwtDe(YO)), e.d)).status, `${rol}/${p}`).toBe(200)
    }
  })

  it('el puesto no abre nada si el rol no se pudo leer (rol desconocido sigue cerrando)', async () => {
    const e = entorno(null, 'si')
    expect((await manejar(post(jwtDe(YO)), e.d)).status).toBe(403)
    expect(e.aAnthropic()).toHaveLength(0)
  })

  it('el puesto se lee con el JWT de la persona (RLS), por su propio id y la capacidad exacta', async () => {
    const token = jwtDe(YO)
    const e = entorno('asesorado', 'si')
    await manejar(post(token), e.d)
    const l = e.llamadas.find((x) => x.url.includes('rest/v1/capacidades_staff'))!
    expect(l.url).toContain(`usuario_id=eq.${YO}`)
    expect(l.url).toContain('capacidad=eq.puesto_de_coach')
    const h = l.init!.headers as Record<string, string>
    expect(h.authorization).toBe(`Bearer ${token}`)
    expect(h.apikey).toBe('anon')
  })
})
