// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manejar, type Dependencias } from '../../../../supabase/functions/praxis-registro/index.ts'
import { PROMPT_RIESGO } from '../riesgoModelo.ts'

/**
 * El portero de fichas en las consultas del equipo (decisión de Bryan, 25-oct-2026). Garantías:
 *   - consulta + portero «atender» → la respuesta es la ficha, y el coach recibe la nota;
 *   - sin secretos, portero caído, lento o con respuesta rara → la consulta queda EXACTAMENTE como antes;
 *   - charla o registro → no se llama al portero;
 *   - riesgo → deriva y no se llama al portero (la frase no sale de la función hacia él);
 *   - la ficha se lee con el JWT de la persona, y `meta.portero` lleva solo ids.
 */
const AHORA = new Date('2026-10-25T15:00:00Z')
const ANTES = 'Eso lo decide Bryan con tus números. Le paso la pregunta.'
const PORTERO = 'https://portero.prueba'
const lector = (nivel: string) => ({ content: [{ type: 'text', text: JSON.stringify({ nivel, cita: '', por_que: 'prueba' }) }] })
const registrador = (intencion: string[]) => ({
  content: [{ type: 'tool_use', name: 'registrar', input: { intencion, entreno: [], comida: null, vida: null, sesion: null, correccion: null, aclaracion: null, clinico: { hay: false, cita: null }, fuera_de_alcance: true } }],
  usage: { input_tokens: 1800, output_tokens: 220 },
})
const FICHAS = [
  { id: 'cargas-no-llegue-al-rango', titulo: 'No llegué al rango', bandera_salud: false, cuerpo: { respuesta_directa: 'Una vez no obliga a **bajar** peso.', senal_alarma: '' } },
  { id: 'cargas-no-pude-con-el-peso', titulo: 'No pude con el peso', bandera_salud: false, cuerpo: { respuesta_directa: 'Un mal día no borra el progreso.', senal_alarma: '' } },
  { id: 'dolor-rodilla', titulo: 'Dolor de rodilla', bandera_salud: true, cuerpo: { respuesta_directa: 'Para y avisa.', senal_alarma: '' } },
]
const decide = (decision: string, ficha: string, tres: string[] = [ficha]) => ({ decision, ficha, tres_primeras: tres.map((f) => ({ ficha: f })), quien: 'camilin' })

type ComoResponde = unknown | 'http-500' | 'tiempo' | 'basura'

function entorno(o: { intencion?: string[]; portero?: ComoResponde; secretos?: boolean; riesgo?: string } = {}) {
  const llamadas: { url: string; init?: RequestInit }[] = []
  const fetchSim = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    llamadas.push({ url: u, init })
    if (/auth\/v1\/user/.test(u)) return new Response(JSON.stringify({ id: 'u-portero-1' }))
    if (/rest\/v1\/usuarios_app/.test(u)) return new Response(JSON.stringify([{ rol: 'coach' }]))
    if (/rest\/v1\/microciclos/.test(u)) return new Response('[]')
    if (/rest\/v1\/praxis_avisos_coach/.test(u)) return new Response(null, { status: 201 })
    if (/rest\/v1\/fichas_respuesta/.test(u)) {
      const ids = decodeURIComponent(u).match(/id=in\.\(([^)]*)\)/)?.[1].split(',') ?? []
      return new Response(JSON.stringify(FICHAS.filter((f) => ids.includes(f.id))))
    }
    if (u.startsWith(PORTERO)) {
      const p = o.portero ?? decide('atender', 'cargas-no-llegue-al-rango')
      if (p === 'http-500') return new Response('{}', { status: 500 })
      if (p === 'tiempo') throw new DOMException('The operation timed out', 'TimeoutError')
      if (p === 'basura') return new Response('no es json')
      return new Response(JSON.stringify(p))
    }
    if (u.includes('api.anthropic.com')) {
      const cuerpo = JSON.parse(String(init?.body ?? '{}')) as { system?: { text: string }[] }
      if (cuerpo.system?.[0]?.text === PROMPT_RIESGO) return new Response(JSON.stringify(lector(o.riesgo ?? 'NINGUNO')))
      return new Response(JSON.stringify(registrador(o.intencion ?? ['consulta'])))
    }
    return new Response('{}', { status: 404 })
  })
  const d: Dependencias = {
    entorno: {
      SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'sk-prueba-no-real',
      ...(o.secretos === false ? {} : { PORTERO_URL: `${PORTERO}/`, PORTERO_CLAVE: 'clave-de-prueba' }),
    },
    fetch: fetchSim as unknown as typeof fetch,
    ahora: () => AHORA,
  }
  const alPortero = () => llamadas.filter((l) => l.url.startsWith(PORTERO))
  return { d, llamadas, alPortero }
}

const frase = (f: string) =>
  new Request('https://x.supabase.co/functions/v1/praxis-registro', {
    method: 'POST', headers: { authorization: 'Bearer jwt-de-la-persona', 'content-type': 'application/json' }, body: JSON.stringify({ frase: f }),
  })
const enviar = async (e: ReturnType<typeof entorno>, f = 'si no llego al rango de reps le bajo al peso?') => {
  const r = await manejar(frase(f), e.d)
  return (await r.json()) as { propuesta: { respuesta?: string; motivo?: string; notas_coach: string[]; accion: string }; meta: Record<string, unknown> }
}

afterEach(() => vi.restoreAllMocks())

describe('praxis-registro: portero de fichas en las consultas', () => {
  it('atender → contesta con la ficha, nota al coach y meta solo con ids', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const e = entorno()
    const j = await enviar(e)
    expect(j.propuesta.respuesta).toBe('Una vez no obliga a bajar peso.')
    expect(j.propuesta.motivo).toBe('consulta')
    expect(j.propuesta.notas_coach.some((n) => n.includes('cargas-no-llegue-al-rango'))).toBe(true)
    expect(j.meta.portero).toEqual(['cargas-no-llegue-al-rango'])
    const [p] = e.alPortero()
    expect(p.url).toBe(`${PORTERO}/enrutar`)
    expect((p.init?.headers as Record<string, string>)['x-clave']).toBe('clave-de-prueba')
    const ficha = e.llamadas.find((l) => /fichas_respuesta/.test(l.url))!
    expect((ficha.init?.headers as Record<string, string>).authorization).toBe('Bearer jwt-de-la-persona')
  })

  it('aclarar → ofrece las opciones contestables, sin la de salud', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const j = await enviar(entorno({ portero: decide('aclarar', 'cargas-no-llegue-al-rango', ['cargas-no-llegue-al-rango', 'dolor-rodilla', 'cargas-no-pude-con-el-peso']) }))
    expect(j.propuesta.respuesta).toContain('1) No llegué al rango\n2) No pude con el peso')
    expect(j.propuesta.respuesta).not.toContain('rodilla')
  })

  it.each([
    ['ninguna', decide('ninguna', 'cargas-no-llegue-al-rango'), 'ninguna'],
    ['ficha de salud', decide('atender', 'dolor-rodilla'), 'sin_ficha_contestable'],
    ['ficha no publicada', decide('atender', 'ficha-que-no-existe'), 'sin_ficha_contestable'],
    ['HTTP 500', 'http-500', 'http_500'],
    ['tiempo agotado', 'tiempo', 'error_TimeoutError'],
    ['respuesta que no es JSON', 'basura', 'ilegible'],
  ])('%s → la consulta queda como antes, pero el resultado NO es silencioso', async (_caso, portero, resultado) => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const j = await enviar(entorno({ portero }))
    expect(j.propuesta.respuesta).toBe(ANTES)
    expect(j.meta.portero).toBeUndefined()
    expect(j.meta.portero_resultado).toBe(resultado)
    expect(log.mock.calls.filter((c) => c[0] === 'praxis-registro: portero').map((c) => c[1])).toEqual([resultado])
    for (const c of [...err.mock.calls, ...log.mock.calls]) expect(JSON.stringify(c)).not.toContain('rango de reps')
  })

  it('atender y aclarar también quedan registrados, sin la frase', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const j = await enviar(entorno())
    expect(j.meta.portero_resultado).toBe('atender')
    expect(log.mock.calls.some((c) => c[0] === 'praxis-registro: portero' && c[1] === 'atender')).toBe(true)
    for (const c of log.mock.calls) expect(JSON.stringify(c)).not.toContain('rango de reps')
  })

  it('sin secretos → no llama al portero, queda como antes y lo registra', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const e = entorno({ secretos: false })
    const j = await enviar(e)
    expect(j.propuesta.respuesta).toBe(ANTES)
    expect(j.meta.portero_resultado).toBe('sin_secretos')
    expect(e.alPortero()).toHaveLength(0)
  })

  it('charla → no llama al portero', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const e = entorno({ intencion: ['charla'] })
    await enviar(e, 'qué opinas del partido de anoche')
    expect(e.alPortero()).toHaveLength(0)
  })

  it('riesgo del lector con modelo → deriva y la frase no va al portero', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const e = entorno({ riesgo: 'DERIVAR' })
    const j = await enviar(e)
    expect(j.propuesta.accion).toBe('derivar')
    expect(e.alPortero()).toHaveLength(0)
  })
})
