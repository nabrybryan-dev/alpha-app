// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manejar, type Dependencias } from '../../../../supabase/functions/praxis-registro/index.ts'
import { PROMPT_RIESGO } from '../riesgoModelo.ts'

/**
 * La cola de dudas del taller (Fase B, pieza 1; decisión de Bryan, 28-oct-2026). Garantías:
 *   - portero `ninguna` («arriba») o `aclarar` → la frase COMPLETA del equipo se inserta con la ficha del juez;
 *   - portero `atender` → no se inserta;
 *   - un asesorado → no se inserta (ni se llama al juez);
 *   - si el juez o el insert fallan, la respuesta a la persona sale igual y queda una línea `praxis-registro: cola`;
 *   - el insert va con el JWT de la persona, nunca con otra llave.
 */
const AHORA = new Date('2026-10-29T15:00:00Z')
const PORTERO = 'https://portero.prueba'
const FRASE = 'si no llego al rango de reps le bajo al peso?'
const lector = { content: [{ type: 'text', text: JSON.stringify({ nivel: 'NINGUNO', cita: '', por_que: 'prueba' }) }] }
const registrador = {
  content: [{ type: 'tool_use', name: 'registrar', input: { intencion: ['consulta'], entreno: [], comida: null, vida: null, sesion: null, correccion: null, aclaracion: null, clinico: { hay: false, cita: null }, fuera_de_alcance: true } }],
  usage: { input_tokens: 1800, output_tokens: 220 },
}
const FICHAS = [
  { id: 'cargas-no-llegue-al-rango', titulo: 'No llegué al rango', bandera_salud: false, cuerpo: { respuesta_directa: 'Una vez no obliga a bajar peso.', senal_alarma: '' } },
  { id: 'cargas-no-pude-con-el-peso', titulo: 'No pude con el peso', bandera_salud: false, cuerpo: { respuesta_directa: 'Un mal día no borra el progreso.', senal_alarma: '' } },
]
const decide = (decision: string, ficha: string, tres: string[] = [ficha]) => ({ decision, ficha, tres_primeras: tres.map((f) => ({ ficha: f })), quien: 'camilin' })

interface Opciones {
  rol?: string
  portero?: unknown
  /** Qué dice el juez: texto de Haiku, 'http-500' o 'tiempo'. */
  juez?: string
  /** Estado HTTP del insert en la cola. */
  insert?: number
}

function entorno(o: Opciones = {}) {
  const llamadas: { url: string; init?: RequestInit }[] = []
  const fetchSim = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    llamadas.push({ url: u, init })
    if (/auth\/v1\/user/.test(u)) return new Response(JSON.stringify({ id: 'u-cola-1' }))
    if (/rest\/v1\/usuarios_app/.test(u)) return new Response(JSON.stringify([{ rol: o.rol ?? 'coach' }]))
    if (/rest\/v1\/microciclos/.test(u)) return new Response('[]')
    if (/rest\/v1\/praxis_avisos_coach/.test(u)) return new Response(null, { status: 201 })
    if (/rest\/v1\/praxis_cola_dudas/.test(u)) return new Response(null, { status: o.insert ?? 201 })
    if (/rest\/v1\/fichas_respuesta/.test(u)) {
      const ids = decodeURIComponent(u).match(/id=in\.\(([^)]*)\)/)?.[1].split(',')
      return new Response(JSON.stringify(ids ? FICHAS.filter((f) => ids.includes(f.id)) : FICHAS))
    }
    if (u.startsWith(PORTERO)) return new Response(JSON.stringify(o.portero ?? decide('ninguna', 'cargas-no-llegue-al-rango')))
    if (u.includes('api.anthropic.com')) {
      const cuerpo = JSON.parse(String(init?.body ?? '{}')) as { system?: { text: string }[]; tools?: unknown }
      if (cuerpo.system?.[0]?.text === PROMPT_RIESGO) return new Response(JSON.stringify(lector))
      if (cuerpo.tools) return new Response(JSON.stringify(registrador))
      // El juez: no lleva herramientas.
      if (o.juez === 'http-500') return new Response('{}', { status: 500 })
      if (o.juez === 'tiempo') throw new DOMException('The operation timed out', 'TimeoutError')
      return new Response(JSON.stringify({ content: [{ type: 'text', text: o.juez ?? 'cargas-no-llegue-al-rango' }] }))
    }
    return new Response('{}', { status: 404 })
  })
  const d: Dependencias = {
    entorno: {
      SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'sk-prueba-no-real',
      PORTERO_URL: `${PORTERO}/`, PORTERO_CLAVE: 'clave-de-prueba',
    },
    fetch: fetchSim as unknown as typeof fetch,
    ahora: () => AHORA,
  }
  const cuerpoDe = (l: { init?: RequestInit }) => JSON.parse(String(l.init?.body ?? '{}')) as { system?: { text: string }[]; tools?: unknown }
  const inserts = () => llamadas.filter((l) => /rest\/v1\/praxis_cola_dudas/.test(l.url) && l.init?.method === 'POST')
  const alJuez = () => llamadas.filter((l) => l.url.includes('api.anthropic.com') && !cuerpoDe(l).tools && cuerpoDe(l).system?.[0]?.text !== PROMPT_RIESGO)
  return { d, llamadas, inserts, alJuez }
}

const enviar = async (e: ReturnType<typeof entorno>) => {
  const r = await manejar(new Request('https://x.supabase.co/functions/v1/praxis-registro', {
    method: 'POST', headers: { authorization: 'Bearer jwt-de-la-persona', 'content-type': 'application/json' }, body: JSON.stringify({ frase: FRASE }),
  }), e.d)
  return { status: r.status, json: (await r.json()) as { propuesta?: { respuesta?: string; motivo?: string }; meta?: Record<string, unknown> } }
}
const lineasCola = (log: { mock: { calls: unknown[][] } }) => log.mock.calls.filter((c) => c[0] === 'praxis-registro: cola')

afterEach(() => vi.restoreAllMocks())

describe('praxis-registro: cola de dudas del equipo', () => {
  it.each([
    ['ninguna', 'coach', decide('ninguna', 'cargas-no-llegue-al-rango'), 'arriba'],
    ['aclarar', 'coach', decide('aclarar', 'cargas-no-llegue-al-rango', ['cargas-no-llegue-al-rango', 'cargas-no-pude-con-el-peso']), 'aclarar'],
    ['ninguna', 'nutricionista', decide('ninguna', 'cargas-no-llegue-al-rango'), 'arriba'],
  ])('portero %s (%s) → inserta la frase completa con la ficha del juez', async (_d, rol, portero, origen) => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const e = entorno({ rol, portero })
    await enviar(e)
    expect(e.inserts()).toHaveLength(1)
    const ins = e.inserts()[0]
    const fila = JSON.parse(String(ins.init?.body))
    expect(fila).toMatchObject({ usuario_id: 'u-cola-1', frase: FRASE, origen, ficha_juez: 'cargas-no-llegue-al-rango' })
    expect(fila.modelo_juez).toMatch(/haiku/i)
    expect(fila.portero_fichas.decision).toBe(portero.decision)
    // Con el JWT de la persona, nunca otra llave.
    const h = ins.init?.headers as Record<string, string>
    expect(h.authorization).toBe('Bearer jwt-de-la-persona')
    expect(h.apikey).toBe('anon')
    expect(lineasCola(log).map((c) => c[1])).toEqual([`ok_${origen}`])
    // El log nunca lleva la frase.
    for (const c of log.mock.calls) expect(JSON.stringify(c)).not.toContain('rango de reps')
  })

  it('el juez dice «ninguna» → inserta con ficha_juez null y el modelo anotado', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const e = entorno({ juez: 'ninguna' })
    await enviar(e)
    const fila = JSON.parse(String(e.inserts()[0].init?.body))
    expect(fila.ficha_juez).toBeNull()
    expect(fila.modelo_juez).toMatch(/haiku/i)
  })

  it('un id que no está en el catálogo se descarta (ficha_juez null y modelo null)', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const e = entorno({ juez: 'ficha-inventada' })
    await enviar(e)
    const fila = JSON.parse(String(e.inserts()[0].init?.body))
    expect(fila.ficha_juez).toBeNull()
    expect(fila.modelo_juez).toBeNull()
  })

  it('portero atender → NO inserta ni llama al juez', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const e = entorno({ portero: decide('atender', 'cargas-no-llegue-al-rango') })
    const { json } = await enviar(e)
    expect(json.propuesta?.respuesta).toBe('Una vez no obliga a bajar peso.')
    expect(e.inserts()).toHaveLength(0)
    expect(e.alJuez()).toHaveLength(0)
  })

  it('asesorado → no se inserta nada ni se llama al juez', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const e = entorno({ rol: 'asesorado' })
    const { status } = await enviar(e)
    expect(status).toBe(403) // Praxis sigue cerrada a asesorados
    expect(e.inserts()).toHaveLength(0)
    expect(e.alJuez()).toHaveLength(0)
  })

  it.each([
    ['el juez responde HTTP 500', { juez: 'http-500' }],
    ['el juez se agota', { juez: 'tiempo' }],
    ['el insert responde 403 (RLS)', { insert: 403 }],
  ])('%s → la respuesta a la persona sale igual y queda una línea de cola', async (_caso, o) => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const e = entorno(o)
    const { status, json } = await enviar(e)
    expect(status).toBe(200)
    expect(json.propuesta?.respuesta).toBe('Eso lo decide Bryan con tus números. Le paso la pregunta.')
    expect(json.meta?.portero_resultado).toBe('ninguna')
    expect(lineasCola(log).length).toBeGreaterThan(0)
    for (const c of log.mock.calls) expect(JSON.stringify(c)).not.toContain('rango de reps')
  })
})
