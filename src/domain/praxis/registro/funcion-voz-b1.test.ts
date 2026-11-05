// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manejar, type Dependencias } from '../../../../supabase/functions/praxis-registro/index.ts'
import { reiniciarPausas } from '../../../../supabase/functions/praxis-registro/voz/modelos.ts'
import { PROMPT_LECTOR } from '../../../../supabase/functions/praxis-registro/voz/promptLector.ts'
import { PROMPT_RIESGO } from '../riesgoModelo.ts'

/**
 * ETAPA B1 del criterio firmado CRITERIO-PASO-A-FUNCION-20261104.md (sin red): la función completa con redactor y
 * revisor DE JUGUETE (respuestas fijas). Pasa si en el 100 % de 20 fallos inyectados la persona recibe lo de hoy
 * (la misma propuesta que con la voz apagada: regla de precedencia, no se muestra el concepto) y no hay 5xx. Sin saldo de
 * Anthropic la función YA respondía 502 antes de la voz: ahí se exige lo mismo que hoy y que DeepSeek no se llame.
 * Además: orden de pasos, y ni el registro ni `meta` llevan la frase, la redacción ni los campos.
 * Sin base local (no hay Docker en esta máquina): la base también es simulada. Frases escritas por Claude; el nombre es
 * el del seed ficticio.
 */
const AHORA = new Date('2026-11-04T23:00:00Z')
const PORTERO = 'https://portero.prueba'
const FRASE = '¿cuánto descanso entre series le dejo a Valentina en máquina?'
const CONCEPTO = { id: 'nue-cuanto-descansar', coseno: 0.86 }
const CAMPOS = { respuesta: 'Entre 2 y 3 minutos en multiarticulares; en aislamiento puede ser menos.', de_que_depende: ['objetivo'], estudios: 'Ensayos en hombres entrenados.', criterio_de_practica: 'Es una convención de práctica.' }
const REDACCION = 'De 2 a 3 minutos en multiarticulares, y menos en aislamiento según el objetivo.'
const ENCENDIDA = { PRAXIS_REDACTOR: 'encendido', DEEPSEEK_API_KEY: 'ds-juguete' }

const r = (c: unknown, status = 200) => new Response(JSON.stringify(c), { status })
const red = () => { throw new TypeError('fetch failed') }
const tiempo = () => { throw new DOMException('The operation timed out', 'TimeoutError') }
const deepseek = (contenido: string) => r({ choices: [{ message: { content: contenido } }], usage: { total_tokens: 900 } })
const redaccion = (texto: string) => deepseek(JSON.stringify({ respuesta: texto, hueco: false }))
const lector = (v: unknown) => r({ content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v) }], usage: { input_tokens: 700, output_tokens: 30 } })
const APRUEBA = { contesta_lo_preguntado: 'si', hecho_fuera_de_campos: null }

interface Escenario {
  entorno?: Record<string, string | undefined>
  frase?: string
  deepseek?: () => Response
  lector?: () => Response
  vector?: () => Response
  busqueda?: () => Response
  conceptos?: () => Response
  portero?: unknown
}

function montar(e: Escenario = {}) {
  const llamadas: string[] = []
  const f = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    llamadas.push(u)
    if (/auth\/v1\/user/.test(u)) return r({ id: 'u-voz-1' })
    if (/usuarios_app\?select=nombre/.test(u)) return r([{ nombre: 'Valentina Cruz' }, { nombre: 'Bryan' }])
    if (/rest\/v1\/usuarios_app/.test(u)) return r([{ rol: 'coach' }])
    if (/rest\/v1\/microciclos/.test(u)) return r([])
    if (/rest\/v1\/fichas_respuesta/.test(u)) return r([])
    if (/rest\/v1\/praxis_conceptos/.test(u)) return (e.conceptos ?? (() => r([CAMPOS])))()
    if (/rest\/v1\/rpc\/buscar_conceptos_vector/.test(u)) return (e.busqueda ?? (() => r([CONCEPTO, { id: 'otro', coseno: 0.7 }])))()
    if (/rest\/v1\//.test(u)) return new Response(null, { status: 201 }) // mensajes del equipo, cola de dudas
    if (u === `${PORTERO}/vector`) return (e.vector ?? (() => r({ vector: Array.from({ length: 768 }, () => 0.01) })))()
    if (u === `${PORTERO}/enrutar`) return r(e.portero ?? { decision: 'ninguna', ficha: 'ninguna', tres_primeras: [], quien: 'camilin' })
    if (u.startsWith('https://api.deepseek.com/')) return (e.deepseek ?? (() => redaccion(REDACCION)))()
    if (u.includes('api.anthropic.com')) {
      const c = JSON.parse(String(init?.body ?? '{}')) as { system?: unknown; tools?: unknown }
      if (c.system === PROMPT_LECTOR) return (e.lector ?? (() => lector(APRUEBA)))()
      if (Array.isArray(c.system) && (c.system[0] as { text?: string })?.text === PROMPT_RIESGO) return lector({ nivel: 'NINGUNO', cita: '', por_que: 'prueba' })
      if (c.tools) return r({ content: [{ type: 'tool_use', name: 'registrar', input: { intencion: ['consulta'], entreno: [], comida: null, vida: null, sesion: null, correccion: null, aclaracion: null, clinico: { hay: false, cita: null }, fuera_de_alcance: true } }], usage: { input_tokens: 1800, output_tokens: 200 } })
      return lector('ninguna') // el juez de la cola de dudas
    }
    return r({}, 404)
  })
  const d: Dependencias = {
    entorno: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'sk-juguete', PORTERO_URL: `${PORTERO}/`, PORTERO_CLAVE: 'clave', ...e.entorno },
    fetch: f as unknown as typeof fetch,
    ahora: () => AHORA,
  }
  return { d, llamadas, f }
}

async function enviar(e: Escenario = {}) {
  const m = montar(e)
  const res = await manejar(new Request('https://x.supabase.co/functions/v1/praxis-registro', {
    method: 'POST', headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' }, body: JSON.stringify({ frase: e.frase ?? FRASE }),
  }), m.d)
  const cuerpo = (await res.json()) as { propuesta: { respuesta?: string; notas_coach: string[] }; meta: { voz?: Record<string, unknown> } }
  return { status: res.status, ...cuerpo, ...m }
}

let registro: ReturnType<typeof vi.spyOn>[]
beforeEach(() => {
  reiniciarPausas()
  registro = [vi.spyOn(console, 'log').mockImplementation(() => {}), vi.spyOn(console, 'error').mockImplementation(() => {})]
})
afterEach(() => vi.restoreAllMocks())

const loDeHoy = async (frase = FRASE) => (await enviar({ frase })).propuesta

describe('B1: controles del instrumento', () => {
  it('con la voz encendida y todo bien, la persona recibe la redacción aprobada (el instrumento VE el cambio)', async () => {
    const hoy = await loDeHoy()
    const x = await enviar({ entorno: ENCENDIDA })
    expect(x.status).toBe(200)
    expect(x.propuesta.respuesta).toBe(REDACCION)
    expect(x.propuesta).not.toEqual(hoy)
    expect(x.meta.voz).toMatchObject({ mostrado: 'redaccion', redactor_estado: 'ok', lector_estado: 'aprobo' })
  })
  it('en sombra corre todo y la persona recibe lo de hoy', async () => {
    const x = await enviar({ entorno: { ...ENCENDIDA, PRAXIS_REDACTOR: 'sombra' } })
    expect(x.propuesta).toEqual(await loDeHoy())
    expect(x.meta.voz).toMatchObject({ lector_estado: 'aprobo', mostrado: 'lo_de_hoy' })
  })
  it('gana la ficha: si el portero atiende, no se lee el concepto ni se llama a DeepSeek', async () => {
    const x = await enviar({ entorno: ENCENDIDA, portero: { decision: 'atender', ficha: 'f-1', tres_primeras: [{ ficha: 'f-1' }], quien: 'camilin' } })
    expect(x.llamadas.some((u) => /praxis_conceptos|api\.deepseek/.test(u))).toBe(false)
    expect(x.meta.voz).toMatchObject({ omitido: 'ficha_gana' })
  })
  it('sin saldo de Anthropic (respaldo sin modelo) la voz ni corre: no se gasta DeepSeek sin revisor', async () => {
    const sinSaldo = async (entorno: Record<string, string | undefined>) => {
      const m = montar({ entorno })
      const base = m.d.fetch
      m.d.fetch = (async (url: RequestInfo | URL, init?: RequestInit) =>
        String(url).includes('api.anthropic.com') && JSON.parse(String(init?.body ?? '{}')).tools
          ? r({ error: { message: 'Your credit balance is too low' } }, 400)
          : base(url, init)) as typeof fetch
      const res = await manejar(new Request('https://x.supabase.co/functions/v1/praxis-registro', {
        method: 'POST', headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' }, body: JSON.stringify({ frase: FRASE }),
      }), m.d)
      return { status: res.status, cuerpo: await res.json(), llamadas: m.llamadas }
    }
    const hoy = await sinSaldo({})
    const conVoz = await sinSaldo(ENCENDIDA)
    expect(conVoz.status).toBe(hoy.status) // hoy, sin saldo y sin ficha, la función ya responde 502 «se me enredó»
    expect(conVoz.cuerpo).toEqual(hoy.cuerpo)
    expect(conVoz.llamadas.some((u) => u.includes('api.deepseek.com'))).toBe(false)
  })
  it('orden de pasos: portero y biblioteca → concepto → nombres → redactor → lector', async () => {
    const { llamadas } = await enviar({ entorno: ENCENDIDA })
    const i = (re: RegExp) => llamadas.findIndex((u) => re.test(u))
    const pasos = [i(/\/enrutar$/), i(/praxis_conceptos/), i(/usuarios_app\?select=nombre/), i(/api\.deepseek/), llamadas.lastIndexOf('https://api.anthropic.com/v1/messages')]
    expect(pasos.every((p) => p >= 0)).toBe(true)
    expect([...pasos].sort((a, b) => a - b)).toEqual(pasos)
  })
  it('el registro y meta no llevan la frase, la redacción, los campos ni el nombre; a DeepSeek no le llega el nombre', async () => {
    const x = await enviar({ entorno: ENCENDIDA })
    const lineas = JSON.stringify(registro.map((s) => s.mock.calls)) + JSON.stringify(x.meta)
    for (const t of [FRASE, REDACCION, CAMPOS.respuesta, CAMPOS.estudios, 'Valentina']) expect(lineas).not.toContain(t)
    const alRedactor = x.f.mock.calls.find((c) => String(c[0]).includes('deepseek'))
    expect(String((alRedactor?.[1] as RequestInit).body)).not.toContain('Valentina')
  })
})

// Los 20 fallos inyectados. Cada uno: 200, y EXACTAMENTE la propuesta de hoy.
const FALLOS: [string, Escenario, Record<string, unknown>][] = [
  ['1 interruptor ausente', { entorno: { DEEPSEEK_API_KEY: 'ds' } }, {}],
  ['2 interruptor con valor raro', { entorno: { ...ENCENDIDA, PRAXIS_REDACTOR: 'si' } }, {}],
  ['3 sin clave de DeepSeek', { entorno: { PRAXIS_REDACTOR: 'encendido' } }, { omitido: 'apagado' }],
  ['4 red cortada hacia DeepSeek', { entorno: ENCENDIDA, deepseek: red }, { redactor_estado: 'error_TypeError' }],
  ['5 DeepSeek tarda de más', { entorno: ENCENDIDA, deepseek: tiempo }, { redactor_estado: 'timeout' }],
  ['6 DeepSeek error 500', { entorno: ENCENDIDA, deepseek: () => r({}, 500) }, { redactor_estado: 'http_500' }],
  ['7 DeepSeek sin saldo (402)', { entorno: ENCENDIDA, deepseek: () => r({ error: { message: 'Insufficient Balance' } }, 402) }, { redactor_estado: 'sin_saldo' }],
  ['8 DeepSeek vacío', { entorno: ENCENDIDA, deepseek: () => deepseek('') }, { redactor_estado: 'vacio' }],
  ['9 DeepSeek JSON roto', { entorno: ENCENDIDA, deepseek: () => deepseek('{respuesta: rota') }, { redactor_estado: 'json_invalido' }],
  ['10 redacción con voseo', { entorno: ENCENDIDA, deepseek: () => redaccion('Vos podés dejar 2 minutos.') }, { redactor_estado: 'guarda_voseo' }],
  ['11 redacción con cifra inventada', { entorno: ENCENDIDA, deepseek: () => redaccion('Unos 5 minutos en multiarticulares.') }, { redactor_estado: 'guarda_cifra_fuera' }],
  ['12 revisor caído (529)', { entorno: ENCENDIDA, lector: () => r({}, 529) }, { lector_estado: 'http_529' }],
  ['13 revisor sin saldo', { entorno: ENCENDIDA, lector: () => r({ error: { message: 'Your credit balance is too low' } }, 400) }, { lector_estado: 'sin_saldo' }],
  ['14 revisor tarda de más', { entorno: ENCENDIDA, lector: tiempo }, { lector_estado: 'timeout' }],
  ['15 revisor rechaza', { entorno: ENCENDIDA, lector: () => lector({ contesta_lo_preguntado: 'no', hecho_fuera_de_campos: null }) }, { lector_estado: 'rechazo', motivo_rechazo: 'otro_tipo' }],
  ['16 revisor con JSON roto', { entorno: ENCENDIDA, lector: () => lector('apruebo') }, { lector_estado: 'json_invalido' }],
  ['17 biblioteca caída', { entorno: ENCENDIDA, vector: () => r({}, 500) }, { omitido: 'sin_concepto' }],
  ['18 concepto bajo el corte', { entorno: ENCENDIDA, busqueda: () => r([{ id: CONCEPTO.id, coseno: 0.8 }]) }, { omitido: 'bajo_corte' }],
  ['19 el concepto no se puede leer de la base', { entorno: ENCENDIDA, conceptos: () => r({ message: 'x' }, 500) }, { omitido: 'sin_concepto' }],
  ['20 pregunta de tipo «cómo»', { entorno: ENCENDIDA, frase: '¿cómo armo el descanso entre series en máquina?' }, { omitido: 'como' }],
]

describe('B1: 20 fallos inyectados → lo de hoy y sin 5xx', () => {
  it.each(FALLOS)('%s', async (_n, escenario, estado) => {
    const hoy = await loDeHoy(escenario.frase)
    const x = await enviar(escenario)
    expect(x.status).toBe(200)
    expect(x.propuesta).toEqual(hoy)
    if (Object.keys(estado).length) expect(x.meta.voz).toMatchObject({ ...estado, mostrado: 'lo_de_hoy' })
    else expect(x.meta.voz).toBeUndefined() // apagada: ni corre ni deja rastro
  })
})
