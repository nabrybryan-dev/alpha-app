// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manejar, type Dependencias } from '../../../../supabase/functions/praxis-registro/index.ts'
import { PROMPT_RIESGO } from '../riesgoModelo.ts'

/**
 * Claude no responde: sin saldo o caído (decisión de Bryan, 31-oct-2026). Solo para el equipo, y solo una frase que
 * pasó el diccionario, se puede contestar con una ficha sin bandera de salud. Lo demás sigue siendo el 502.
 */
const PORTERO = 'https://portero.prueba'
const SIN_SALDO = { type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low' } }
const FICHAS = [
  { id: 'cargas-no-llegue-al-rango', titulo: 'No llegué al rango', bandera_salud: false, cuerpo: { respuesta_directa: 'Una vez no obliga a bajar peso.', senal_alarma: '' } },
  { id: 'dolor-rodilla', titulo: 'Dolor de rodilla', bandera_salud: true, cuerpo: { respuesta_directa: 'Para y avisa.', senal_alarma: '' } },
]
const decide = (decision: string, ficha: string) => ({ decision, ficha, tres_primeras: [{ ficha }], quien: 'camilin' })

const PLAN = [{ id: 'm-1', numero: 12, estado: 'activo', datos: { cadenciaDias: 7, fechaInicio: '2026-09-28', sesiones: [{ id: 'S1', nombre: 'PIERNA', dia: 'LUNES', ejercicios: [{ id: 'pa1', nombre: 'SENTADILLA TRASERA', sets: 4, rango: '8-12', unidadCarga: 'kg', series: [] }] }] } }]

interface Caso { portero?: unknown; rol?: string; puesto?: boolean; lector?: 'sin_saldo' | string; registrador?: 'sin_saldo' | 'bien'; conPlan?: boolean }

function entorno(o: Caso = {}) {
  const urls: string[] = []
  const fetchSim = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    urls.push(u)
    if (/auth\/v1\/user/.test(u)) return new Response(JSON.stringify({ id: 'u-1' }))
    if (/rest\/v1\/usuarios_app/.test(u)) return new Response(JSON.stringify([{ rol: o.rol ?? 'coach' }]))
    if (/rest\/v1\/capacidades_staff/.test(u)) return new Response(JSON.stringify(o.puesto ? [{ capacidad: 'puesto_de_coach' }] : []))
    if (/rest\/v1\/microciclos/.test(u)) return new Response(JSON.stringify(o.conPlan ? PLAN : []))
    if (/rest\/v1\/praxis_avisos_coach/.test(u)) return new Response(null, { status: 201 })
    if (/rest\/v1\/praxis_cola_dudas/.test(u)) return new Response(null, { status: 201 })
    if (/rest\/v1\/fichas_respuesta/.test(u)) {
      const ids = decodeURIComponent(u).match(/id=in\.\(([^)]*)\)/)?.[1].split(',') ?? []
      return new Response(JSON.stringify(FICHAS.filter((f) => ids.includes(f.id))))
    }
    if (u.startsWith(PORTERO)) return new Response(JSON.stringify(o.portero ?? decide('atender', 'cargas-no-llegue-al-rango')))
    if (u.includes('api.anthropic.com')) {
      const cuerpo = JSON.parse(String(init?.body ?? '{}')) as { system?: { text: string }[] }
      const esLector = cuerpo.system?.[0]?.text === PROMPT_RIESGO
      if (esLector && o.lector && o.lector !== 'sin_saldo') return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ nivel: o.lector, cita: '' }) }] }))
      if (!esLector && o.registrador === 'bien') return new Response(JSON.stringify({ content: [{ type: 'tool_use', name: 'registrar', input: { intencion: ['consulta'], entreno: [], comida: null, vida: null, sesion: null, correccion: null, aclaracion: null, clinico: { hay: false, cita: null }, fuera_de_alcance: true } }], usage: { input_tokens: 1, output_tokens: 1 } }))
      return new Response(JSON.stringify(SIN_SALDO), { status: 400 })
    }
    return new Response('{}', { status: 404 })
  })
  const d: Dependencias = {
    entorno: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'sk-prueba-no-real', PORTERO_URL: PORTERO, PORTERO_CLAVE: 'clave' },
    fetch: fetchSim as unknown as typeof fetch,
    ahora: () => new Date(o.conPlan ? '2026-09-28T23:40:00Z' : '2026-10-31T15:00:00Z'),
  }
  return { d, urls, alPortero: () => urls.filter((u) => u.startsWith(PORTERO)) }
}

const enviar = async (e: ReturnType<typeof entorno>, f = 'si no llego al rango le bajo al peso?') => {
  const r = await manejar(new Request('https://x.supabase.co/functions/v1/praxis-registro', {
    method: 'POST', headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' }, body: JSON.stringify({ frase: f }),
  }), e.d)
  return { status: r.status, j: (await r.json()) as { propuesta?: { respuesta?: string; motivo?: string; accion?: string }; tarjeta?: { tipo?: string; mensaje?: string }; meta?: Record<string, unknown>; reintentable?: boolean } }
}

afterEach(() => vi.restoreAllMocks())
const callar = () => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  return vi.spyOn(console, 'error').mockImplementation(() => {})
}

describe('praxis-registro: Claude sin saldo', () => {
  it('el equipo recibe la ficha del portero, y queda dicho que no pasó por el modelo', async () => {
    callar()
    const { status, j } = await enviar(entorno())
    expect(status).toBe(200)
    expect(j.tarjeta).toMatchObject({ tipo: 'informativa', mensaje: 'Una vez no obliga a bajar peso.' })
    expect(j.propuesta?.motivo).toBe('consulta')
    expect(j.meta).toMatchObject({ modelo: null, respaldo: 'sin_modelo', portero: ['cargas-no-llegue-al-rango'] })
  })

  it('el puesto de coach también cuenta como equipo', async () => {
    callar()
    expect((await enviar(entorno({ rol: 'asesorado', puesto: true }))).status).toBe(200)
  })

  it('un asesorado sigue sin entrar y su frase no llega al portero', async () => {
    callar()
    const e = entorno({ rol: 'asesorado' })
    expect((await enviar(e)).status).toBe(403)
    expect(e.alPortero()).toHaveLength(0)
  })

  it.each([
    ['ficha con bandera de salud', decide('atender', 'dolor-rodilla')],
    ['el portero no halla ficha', decide('ninguna', 'cargas-no-llegue-al-rango')],
    ['ficha no publicada', decide('atender', 'no-existe')],
  ])('%s → sigue el 502: no se inventa nada', async (_caso, portero) => {
    callar()
    const { status, j } = await enviar(entorno({ portero }))
    expect(status).toBe(502)
    expect(j.reintentable).toBe(true)
  })

  it('el diccionario sigue primero: una frase de riesgo no llega al portero', async () => {
    callar()
    const e = entorno()
    const { j } = await enviar(e, 'ya no quiero vivir')
    expect(j.propuesta?.accion).toBe('derivar')
    expect(e.alPortero()).toHaveLength(0)
  })

  it('si el lector responde y marca riesgo, gana el lector aunque falte el registrador', async () => {
    callar()
    const e = entorno({ lector: 'DERIVAR', registrador: 'sin_saldo' })
    const { j } = await enviar(e)
    expect(j.propuesta?.accion).toBe('derivar')
    expect(e.alPortero()).toHaveLength(0)
  })

  it('si solo falla el registrador, también contesta con la ficha', async () => {
    callar()
    const { status, j } = await enviar(entorno({ lector: 'NINGUNO', registrador: 'sin_saldo' }))
    expect(status).toBe(200)
    expect(j.meta).toMatchObject({ respaldo: 'sin_modelo' })
  })

  it('una serie para anotar no se contesta con una ficha: sigue el 502 y no llega al portero', async () => {
    callar()
    const e = entorno({ conPlan: true })
    const { status } = await enviar(e, 'sentadilla 40 por 12')
    expect(status).toBe(502)
    expect(e.alPortero()).toHaveLength(0)
  })

  it('el registro no lleva la frase', async () => {
    const error = callar()
    await enviar(entorno(), 'si no llego al rango le bajo al peso?')
    const log = vi.mocked(console.log)
    for (const c of [...log.mock.calls, ...error.mock.calls]) expect(JSON.stringify(c)).not.toContain('le bajo al peso')
  })
})
