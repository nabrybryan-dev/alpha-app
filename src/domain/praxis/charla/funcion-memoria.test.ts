// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { manejar, type Dependencias } from '../../../../supabase/functions/praxis-registro/index.ts'

/**
 * El servidor guarda la charla (0166, aplicada el 7-nov-2026) SOLO con el interruptor PRAXIS_GUARDAR_CHARLA=1:
 * con service_role (la tabla no deja insertar a nadie más), con el usuario de la SESIÓN y sin romper nunca la respuesta.
 * El modelo y la base son dobles.
 */
const AHORA = new Date('2026-10-03T23:40:00Z')
const ID = '3f2b8c1e-9a4d-4b7e-8c21-5d6e7f809a1b'
const registrador = (input: Record<string, unknown>) => ({ content: [{ type: 'tool_use', name: 'registrar', input }], usage: { input_tokens: 10, output_tokens: 5 } })
const charla = (texto: string) => registrador({ intencion: ['charla'], fuera_de_alcance: true, respuesta_charla: texto })
const lector = () => ({ content: [{ type: 'text', text: JSON.stringify({ nivel: 'NINGUNO', cita: '', por_que: 'prueba' }) }] })

function entorno(extra: Partial<Dependencias['entorno']> = {}, estadoInsert = 201) {
  const llamadas: { url: string; init?: RequestInit }[] = []
  const fetchSim = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    llamadas.push({ url: u, init })
    if (/auth\/v1\/user/.test(u)) return new Response(JSON.stringify({ id: 'u-1' }))
    if (/rest\/v1\/usuarios_app/.test(u)) return new Response(JSON.stringify([{ rol: 'coach' }]))
    if (/rest\/v1\/microciclos/.test(u)) return new Response(JSON.stringify([]))
    if (/rest\/v1\/praxis_charla_turnos/.test(u)) return new Response(null, { status: estadoInsert })
    if (u.includes('api.anthropic.com')) return new Response(JSON.stringify(String(init?.body ?? '').includes('"tools"') ? charla('Qué bueno. ¿Y el entreno?') : lector()))
    return new Response('{}', { status: 404 })
  })
  const d: Dependencias = {
    entorno: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'sk-prueba-no-real', ...extra },
    fetch: fetchSim as unknown as typeof fetch,
    ahora: () => AHORA,
  }
  const turnos = () => llamadas.filter((l) => /rest\/v1\/praxis_charla_turnos/.test(l.url))
  return { d, turnos }
}
const ENCENDIDO = { PRAXIS_GUARDAR_CHARLA: '1', SUPABASE_SERVICE_ROLE_KEY: 'service-prueba' }
const pedir = async (e: ReturnType<typeof entorno>, cuerpo: Record<string, unknown>) => {
  const r = await manejar(new Request('https://x.supabase.co/functions/v1/praxis-registro', {
    method: 'POST', headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
  }), e.d)
  return { status: r.status, cuerpo: (await r.json()) as { charla?: { texto: string } } }
}
const MARCA = { charla_id: ID, turno: 2 }

describe('servidor · memoria de la charla', () => {
  it('encendida: guarda la frase y la respuesta con service_role y el usuario de la sesión', async () => {
    const e = entorno(ENCENDIDO)
    const r = await pedir(e, { frase: 'hoy me fue muy bien', memoria_charla: { ...MARCA, usuario_id: 'otro' } })
    expect(r.status).toBe(200)
    expect(r.cuerpo.charla?.texto).toBe('Qué bueno. ¿Y el entreno?')
    const [t, ...resto] = e.turnos()
    expect(resto).toEqual([])
    expect(t.init?.method).toBe('POST')
    expect(t.url).toContain('on_conflict=usuario_id,charla_id,n')
    const h = t.init?.headers as Record<string, string>
    expect(h.authorization).toBe('Bearer service-prueba')
    expect(h.apikey).toBe('service-prueba')
    expect(h.prefer).toContain('resolution=ignore-duplicates')
    const filas = JSON.parse(String(t.init?.body)) as { usuario_id: string; n: number; rol: string; texto: string }[]
    expect(filas.map((f) => [f.usuario_id, f.n, f.rol, f.texto])).toEqual([
      ['u-1', 4, 'persona', 'hoy me fue muy bien'],
      ['u-1', 5, 'praxis', 'Qué bueno. ¿Y el entreno?'],
    ])
  })

  it('apagada (por omisión), sin clave de servicio o sin marca de charla: no escribe nada', async () => {
    for (const [extra, cuerpo] of [
      [{}, { frase: 'hoy me fue muy bien', memoria_charla: MARCA }],
      [{ PRAXIS_GUARDAR_CHARLA: '1' }, { frase: 'hoy me fue muy bien', memoria_charla: MARCA }],
      [ENCENDIDO, { frase: 'hoy me fue muy bien' }],
    ] as const) {
      const e = entorno(extra)
      expect((await pedir(e, cuerpo)).status).toBe(200)
      expect(e.turnos(), JSON.stringify(extra)).toEqual([])
    }
  })

  it('si la base falla, la persona recibe su respuesta igual', async () => {
    const e = entorno(ENCENDIDO, 500)
    const r = await pedir(e, { frase: 'hoy me fue muy bien', memoria_charla: MARCA })
    expect(r.status).toBe(200)
    expect(r.cuerpo.charla?.texto).toBe('Qué bueno. ¿Y el entreno?')
    expect(e.turnos()).toHaveLength(1)
  })

  it('una frase que el filtro deriva se guarda marcada como clínica y con aviso al coach', async () => {
    const e = entorno(ENCENDIDO)
    const r = await pedir(e, { frase: 'me duele mucho la rodilla', memoria_charla: MARCA })
    expect(r.status).toBe(200)
    const filas = JSON.parse(String(e.turnos()[0]?.init?.body ?? '[]')) as { rol: string; marcado_clinico: boolean; aviso_coach: boolean }[]
    expect(filas.length).toBeGreaterThan(0)
    expect(filas[0].rol).toBe('persona')
    expect(filas.every((f) => f.marcado_clinico && f.aviso_coach)).toBe(true)
  })
})
