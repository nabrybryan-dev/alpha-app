// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manejar, type Dependencias } from '../../../../supabase/functions/praxis-registro/index.ts'
import { FRASE_MENSAJE_MAX } from '../../../../supabase/functions/praxis-registro/mensajesEquipo.ts'
import { PROMPT_RIESGO } from '../riesgoModelo.ts'

/**
 * Los mensajes del equipo a Praxis (migración 0159, decisión de Bryan, 3-nov-2026). Sirven para juntar frases reales
 * que Bryan o Manuela etiqueten por clase de intención (CRITERIO-CAPA-INTENCION-20261103). Garantías:
 *   - una persona del equipo (coach, nutricionista o el puesto de coach) → la frase COMPLETA se inserta con el JWT de la persona;
 *   - un asesorado → no se inserta nada (de asesorados no se guarda hasta P8);
 *   - si el insert falla, la respuesta a la persona sale igual y queda una línea `praxis-registro: mensaje_equipo` sin la frase;
 *   - una frase que el filtro de riesgo detiene NO se guarda (esa señal va por el aviso al coach, no por esta tabla);
 *   - lo que se guarda es la intención que ya etiquetó el registrador; esto no añade ninguna llamada a un modelo.
 */
const AHORA = new Date('2026-11-03T15:00:00Z')
const FRASE = 'cuanto descanso entre series de sentadilla'
const lectorNinguno = { content: [{ type: 'text', text: JSON.stringify({ nivel: 'NINGUNO', cita: '', por_que: 'prueba' }) }] }
const registrador = {
  content: [{ type: 'tool_use', name: 'registrar', input: { intencion: ['consulta'], entreno: [], comida: null, vida: null, sesion: null, correccion: null, aclaracion: null, clinico: { hay: false, cita: null }, fuera_de_alcance: true } }],
  usage: { input_tokens: 1800, output_tokens: 220 },
}

interface Opciones { rol?: string; insert?: number; riesgo?: 'NINGUNO' | 'ALTO' }

function entorno(o: Opciones = {}) {
  const llamadas: { url: string; init?: RequestInit }[] = []
  const lector = o.riesgo === 'ALTO'
    ? { content: [{ type: 'text', text: JSON.stringify({ nivel: 'ALTO', cita: 'prueba', por_que: 'prueba' }) }] }
    : lectorNinguno
  const fetchSim = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    llamadas.push({ url: u, init })
    if (/auth\/v1\/user/.test(u)) return new Response(JSON.stringify({ id: 'u-eq-1' }))
    if (/rest\/v1\/usuarios_app/.test(u)) return new Response(JSON.stringify([{ rol: o.rol ?? 'coach' }]))
    if (/rest\/v1\/microciclos/.test(u)) return new Response('[]')
    if (/rest\/v1\/praxis_avisos_coach/.test(u)) return new Response(null, { status: 201 })
    if (/rest\/v1\/praxis_mensajes_equipo/.test(u)) return new Response(null, { status: o.insert ?? 201 })
    if (/rest\/v1\/praxis_cola_dudas/.test(u)) return new Response(null, { status: 201 })
    if (/rest\/v1\/fichas_respuesta/.test(u)) return new Response('[]')
    if (u.startsWith('https://portero.prueba')) return new Response(JSON.stringify({ decision: 'atender', ficha: 'x', tres_primeras: [], quien: 'camilin' }))
    if (u.includes('api.anthropic.com')) {
      const cuerpo = JSON.parse(String(init?.body ?? '{}')) as { system?: { text: string }[]; tools?: unknown }
      if (cuerpo.system?.[0]?.text === PROMPT_RIESGO) return new Response(JSON.stringify(lector))
      return new Response(JSON.stringify(registrador))
    }
    return new Response('{}', { status: 404 })
  })
  const d: Dependencias = {
    entorno: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'sk-prueba-no-real', PORTERO_URL: 'https://portero.prueba/', PORTERO_CLAVE: 'clave-de-prueba' },
    fetch: fetchSim as unknown as typeof fetch,
    ahora: () => AHORA,
  }
  const inserts = () => llamadas.filter((l) => /rest\/v1\/praxis_mensajes_equipo/.test(l.url) && l.init?.method === 'POST')
  return { d, inserts }
}

const enviar = async (e: ReturnType<typeof entorno>, frase = FRASE) => {
  const r = await manejar(new Request('https://x.supabase.co/functions/v1/praxis-registro', {
    method: 'POST', headers: { authorization: 'Bearer jwt-de-la-persona', 'content-type': 'application/json' }, body: JSON.stringify({ frase }),
  }), e.d)
  return { status: r.status }
}
const lineas = (log: { mock: { calls: unknown[][] } }) => log.mock.calls.filter((c) => c[0] === 'praxis-registro: mensaje_equipo')

afterEach(() => vi.restoreAllMocks())

describe('praxis-registro: mensajes del equipo', () => {
  it.each(['coach', 'nutricionista'])('guarda la frase completa de %s con su JWT y la intención del registrador', async (rol) => {
    const e = entorno({ rol })
    const r = await enviar(e)
    expect(r.status).toBe(200)
    expect(e.inserts()).toHaveLength(1)
    const ins = e.inserts()[0]
    expect((ins.init?.headers as Record<string, string>).authorization).toBe('Bearer jwt-de-la-persona')
    expect(ins.init?.signal).toBeDefined() // con tiempo máximo: una base lenta no retrasa la respuesta a la persona
    expect(JSON.parse(String(ins.init?.body))).toEqual({ usuario_id: 'u-eq-1', frase: FRASE, intencion_registrador: ['consulta'] })
  })

  it('de un asesorado no guarda nada', async () => {
    const e = entorno({ rol: 'asesorado' })
    await enviar(e)
    expect(e.inserts()).toHaveLength(0)
  })

  it('si el insert falla, la respuesta sale igual y la línea del log no lleva la frase', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const e = entorno({ insert: 500 })
    const r = await enviar(e)
    expect(r.status).toBe(200)
    expect(lineas(log).length).toBeGreaterThan(0)
    expect(JSON.stringify(log.mock.calls)).not.toContain(FRASE)
  })

  it('una frase del largo máximo que acepta la función se guarda entera', async () => {
    const e = entorno()
    const r = await enviar(e, 'a'.repeat(FRASE_MENSAJE_MAX))
    expect(r.status).toBe(200)
    const guardada = JSON.parse(String(e.inserts()[0].init?.body)).frase as string
    expect(guardada.length).toBe(FRASE_MENSAJE_MAX)
  })

  it('una frase demasiado larga la rechaza la función antes de guardar nada', async () => {
    const e = entorno()
    const r = await enviar(e, 'a'.repeat(FRASE_MENSAJE_MAX + 1))
    expect(r.status).toBe(400)
    expect(e.inserts()).toHaveLength(0)
  })

  it('una frase que el filtro de riesgo detiene no se guarda aquí', async () => {
    const e = entorno({ riesgo: 'ALTO' })
    await enviar(e)
    expect(e.inserts()).toHaveLength(0)
  })
})
