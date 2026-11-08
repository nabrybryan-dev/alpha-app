// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manejar, type Dependencias } from '../../../../supabase/functions/praxis-registro/index.ts'
import { PROMPT_RIESGO } from '../riesgoModelo.ts'

/**
 * (Copia del molde para el paso de mensajes largos en sombra.) El enrutador de la Praxis única en SOMBRA dentro de `praxis-registro` (F1, 4-nov-2026). Garantías:
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

// Frases inventadas, escritas por IA: solo prueba.
const LARGA = 'anoche dormi mal, solo seis horas, y hoy ando estresada con el trabajo, ademas la comida de ayer fue regular y el entrenamiento estuvo pesado, nada especial para contar'
const LARGA_RIESGO = 'esta semana todo me ha salido mal en el trabajo y en la casa, ya no aguanto mas y solo quiero lastimarme, no se con quien hablar de esto la verdad'

afterEach(() => vi.restoreAllMocks())

describe('praxis-registro: mensaje largo en sombra', () => {
  it('un mensaje largo deja en meta.decision.largo las áreas y los conteos esperados', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const r = await enviar(entorno(), LARGA)
    expect(r.status).toBe(200)
    const largo = r.cuerpo.meta?.decision?.largo as { riesgo: boolean; areas: string[]; descartadas: number; dudosas: number }
    expect(largo.riesgo).toBe(false)
    expect(largo.areas).toEqual(['alimentacion', 'calidadSueno', 'estres'])
    expect(largo.descartadas).toBe(1) // «pesado» no está en la tabla
    expect(largo.dudosas).toBe(0)
    expect(Object.keys(largo).sort()).toEqual(['areas', 'descartadas', 'dudosas', 'riesgo'])
  })

  it('un área dicha dos veces con valores distintos cuenta como dudosa y no como propuesta', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const r = await enviar(entorno(), 'el lunes dormi muy mal pero el martes dormi muy bien, ahora estoy bastante tranquila, aunque estoy muy estresada con la mudanza de la casa nueva')
    expect(r.cuerpo.meta?.decision?.largo).toEqual({ riesgo: false, areas: [], descartadas: 0, dudosas: 2 })
  })

  it('un mensaje corto no deja nada de esto', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const r = await enviar(entorno(), 'dormi seis horas y estoy estresada')
    expect(r.cuerpo.meta?.decision).toBeDefined()
    expect(r.cuerpo.meta?.decision).not.toHaveProperty('largo')
  })

  it('justo en el umbral (20 palabras) entra; con 19 no', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const palabras = (n: number) => ['estoy', 'estresada', ...Array.from({ length: n - 2 }, () => 'hoy')].join(' ')
    expect((await enviar(entorno(), palabras(20))).cuerpo.meta?.decision).toHaveProperty('largo')
    expect((await enviar(entorno(), palabras(19))).cuerpo.meta?.decision).not.toHaveProperty('largo')
  })

  it('un mensaje largo con riesgo marca riesgo y no lista áreas', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const r = await enviar(entorno(), LARGA_RIESGO)
    expect(r.cuerpo.meta?.decision?.largo).toEqual({ riesgo: true, areas: [], descartadas: 0, dudosas: 0 })
    expect(r.cuerpo.propuesta).toMatchObject({ accion: 'derivar' })
  })

  it('ni la meta ni la línea de consola llevan la frase, citas, valores ni la persona', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const r = await enviar(entorno(), LARGA)
    const lineas = lineasSombra(log)
    expect(lineas).toHaveLength(1)
    const sombra = JSON.stringify([r.cuerpo.meta?.decision, lineas])
    expect(sombra).toContain('calidadSueno')
    for (const prohibido of ['anoche', 'estresada', 'trabajo', 'seis', 'comida', 'pesado', 'u-eq-1']) expect(sombra).not.toContain(prohibido)
    expect(sombra).not.toMatch(/"(valor|cita|motivo)"/)
  })

  it('la propuesta y el estado son los de siempre: igual que con un mensaje corto de la misma intención', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const larga = await enviar(entorno(), LARGA)
    const corta = await enviar(entorno(), 'dormi seis horas')
    expect(larga.status).toBe(corta.status)
    expect(larga.cuerpo.propuesta).toEqual(corta.cuerpo.propuesta)
  })

  it('sin saldo en el modelo, la función sigue en 502 y la sombra larga queda en el registro', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const r = await enviar(entorno({ sinSaldo: true }), LARGA)
    expect(r.status).toBe(502)
    expect(lineasSombra(log)[0]?.[1]).toContain('"largo"')
  })
})
