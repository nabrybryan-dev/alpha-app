// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manejar, type Dependencias } from '../../../../supabase/functions/praxis-registro/index.ts'
import { PROMPT_RIESGO } from '../riesgoModelo.ts'

/**
 * El enrutador de la Praxis única en SOMBRA dentro de `praxis-registro` (F1, 4-nov-2026). Garantías:
 *   - cada respuesta de `proponer` lleva `meta.decision` con lo que diría el enrutador por reglas;
 *   - ni `meta.decision` ni la línea `praxis-registro: decision_sombra` llevan la frase ni la persona;
 *   - la sombra no cambia lo que la función contesta (mismo estado, misma propuesta, mismo 502 sin saldo).
 * Frases ficticias.
 */
const AHORA = new Date('2026-11-04T15:00:00Z')
const FRASE = 'cuanto descanso entre series de sentadilla'
const registrador = {
  content: [{ type: 'tool_use', name: 'registrar', input: { intencion: ['consulta'], entreno: [], comida: null, vida: null, sesion: null, correccion: null, aclaracion: null, clinico: { hay: false, cita: null }, fuera_de_alcance: true } }],
  usage: { input_tokens: 1800, output_tokens: 220 },
}

function entorno(o: { riesgo?: 'NINGUNO' | 'ALTO'; sinSaldo?: boolean } = {}): Dependencias {
  const lector = { content: [{ type: 'text', text: JSON.stringify(o.riesgo === 'ALTO' ? { nivel: 'RIESGO_VIDA', cita: 'sentadilla', por_que: 'prueba' } : { nivel: 'NINGUNO', cita: '', por_que: 'prueba' }) }] }
  const fetchSim = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    if (/auth\/v1\/user/.test(u)) return new Response(JSON.stringify({ id: 'u-eq-1' }))
    if (/rest\/v1\/usuarios_app/.test(u)) return new Response(JSON.stringify([{ rol: 'coach' }]))
    if (/rest\/v1\/microciclos/.test(u)) return new Response('[]')
    if (/rest\/v1\/(praxis_avisos_coach|praxis_mensajes_equipo|praxis_cola_dudas)/.test(u)) return new Response(null, { status: 201 })
    if (/rest\/v1\/fichas_respuesta/.test(u)) return new Response('[]')
    if (u.startsWith('https://portero.prueba')) return new Response(JSON.stringify({ decision: 'atender', ficha: 'x', tres_primeras: [], quien: 'camilin' }))
    if (u.includes('api.anthropic.com') && o.sinSaldo) {
      return new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low' } }), { status: 400 })
    }
    if (u.includes('api.anthropic.com')) {
      const cuerpo = JSON.parse(String(init?.body ?? '{}')) as { system?: { text: string }[] }
      return new Response(JSON.stringify(cuerpo.system?.[0]?.text === PROMPT_RIESGO ? lector : registrador))
    }
    return new Response('{}', { status: 404 })
  })
  return {
    entorno: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'sk-prueba-no-real', PORTERO_URL: 'https://portero.prueba/', PORTERO_CLAVE: 'clave-de-prueba' },
    fetch: fetchSim as unknown as typeof fetch,
    ahora: () => AHORA,
  }
}

async function enviar(d: Dependencias, frase = FRASE) {
  const r = await manejar(new Request('https://x.supabase.co/functions/v1/praxis-registro', {
    method: 'POST', headers: { authorization: 'Bearer jwt-de-la-persona', 'content-type': 'application/json' }, body: JSON.stringify({ frase }),
  }), d)
  return { status: r.status, cuerpo: (await r.json()) as { meta?: { decision?: Record<string, unknown> }; propuesta?: unknown } }
}
const lineasSombra = (log: { mock: { calls: unknown[][] } }) => log.mock.calls.filter((c) => c[0] === 'praxis-registro: decision_sombra')

afterEach(() => vi.restoreAllMocks())

describe('praxis-registro: decisión del enrutador en sombra', () => {
  it('una consulta del equipo lleva la decisión en meta: pasa al portero con su tipo', async () => {
    const r = await enviar(entorno())
    expect(r.status).toBe(200)
    expect(r.cuerpo.meta?.decision).toEqual({ ruta: null, paso: 6, origen: 'reglas', pasaA: 'portero', tipo: 'cantidad', campos_por_tipo: { tipo: 'cantidad', campos: ['respuesta'] } })
  })

  it('ni meta.decision ni la línea del registro llevan la frase o la persona', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const r = await enviar(entorno())
    expect(lineasSombra(log)).toHaveLength(1)
    const sombra = JSON.stringify([r.cuerpo.meta?.decision, lineasSombra(log)])
    expect(sombra).not.toContain('sentadilla')
    expect(sombra).not.toContain('u-eq-1')
  })

  it('una frase que el filtro de riesgo detiene lleva seguridad/riesgo en la sombra', async () => {
    const r = await enviar(entorno(), 'solo quiero lastimarme')
    expect(r.cuerpo.meta?.decision).toMatchObject({ ruta: 'seguridad', subnivel: 'riesgo', paso: 1 })
  })

  it('cuando el riesgo lo ve solo el modelo, la sombra dice lo que vieron las reglas (y eso es lo que hay que medir)', async () => {
    const r = await enviar(entorno({ riesgo: 'ALTO' }))
    expect(r.cuerpo.propuesta).toMatchObject({ accion: 'derivar' })
    expect(r.cuerpo.meta?.decision).toMatchObject({ ruta: null, pasaA: 'portero' })
  })

  it('sin saldo, la función sigue contestando lo mismo que antes (502) y la sombra queda en el registro', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const r = await enviar(entorno({ sinSaldo: true }))
    expect(r.status).toBe(502)
    expect(lineasSombra(log)).toHaveLength(1)
  })
})
