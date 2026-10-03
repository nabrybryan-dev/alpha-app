// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_TOKENS_REGISTRO, llamarHaikuIngreso, manejar, type Dependencias,
} from '../../../../supabase/functions/praxis-registro/index.ts'
import type { MicrocicloJson } from './contexto.ts'
import { PROMPT_SISTEMA } from './prompt.ts'
import { PROMPT_RIESGO } from '../riesgoModelo.ts'
import { PROMPT_SISTEMA_INGRESO } from '../ingreso/extraer.ts'
import {
  MINIMO_CACHEABLE_HAIKU_4_5, bloqueDeSistema, tokensAproximados,
} from '../prefijoCacheable.ts'

/**
 * La caché del prefijo solo se pide donde existe: Haiku 4.5 exige 4.096 tokens y solo el
 * registrador (herramienta + sistema) los pasa. El lector de riesgo y el ingreso, por debajo,
 * no llevan `cache_control`. Y el registro de tiempos sigue sin la frase de la persona.
 */
const AHORA = new Date('2026-10-02T15:00:00Z')
const micro: MicrocicloJson = {
  id: 'm-1', numero: 12, cadenciaDias: 7, fechaInicio: '2026-09-28',
  sesiones: [{ id: 'S1', nombre: 'PIERNA', dia: 'LUNES', ejercicios: [{ id: 'pa1', nombre: 'SENTADILLA TRASERA', sets: 4, rango: '8-12', unidadCarga: 'kg', series: [] }] }],
}
const registrador = { content: [{ type: 'tool_use', name: 'registrar', input: { intencion: ['charla'], entreno: [], comida: null, vida: null, sesion: null, correccion: null, aclaracion: null, clinico: { hay: false, cita: null }, fuera_de_alcance: true } }], usage: { input_tokens: 1800, output_tokens: 220 } }
const lector = { content: [{ type: 'text', text: JSON.stringify({ nivel: 'NINGUNO', cita: '', por_que: 'prueba' }) }] }

function entorno() {
  const llamadas: { url: string; init?: RequestInit }[] = []
  const fetchSim = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    llamadas.push({ url: u, init })
    if (/auth\/v1\/user/.test(u)) return new Response(JSON.stringify({ id: 'u-1' }))
    if (/rest\/v1\/usuarios_app/.test(u)) return new Response(JSON.stringify([{ rol: 'coach' }]))
    if (/rest\/v1\/microciclos/.test(u)) return new Response(JSON.stringify([{ id: 'm-1', numero: 12, estado: 'activo', datos: micro }]))
    if (u.includes('api.anthropic.com')) {
      return new Response(JSON.stringify(String(init?.body ?? '').includes('"tools"') ? registrador : lector))
    }
    return new Response('{}', { status: 404 })
  })
  const d: Dependencias = {
    entorno: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'sk-prueba-no-real' },
    fetch: fetchSim as unknown as typeof fetch,
    ahora: () => AHORA,
  }
  const cuerpos = (soloRegistrador: boolean) =>
    llamadas
      .filter((l) => l.url.includes('api.anthropic.com') && String(l.init?.body ?? '').includes('"tools"') === soloRegistrador)
      .map((l) => JSON.parse(String(l.init?.body)))
  return { d, cuerpos }
}
const post = (frase: string) =>
  new Request('https://x.supabase.co/functions/v1/praxis-registro', {
    method: 'POST', headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' }, body: JSON.stringify({ frase }),
  })

afterEach(() => vi.restoreAllMocks())

describe('bloqueDeSistema', () => {
  const largo = 'a'.repeat(Math.ceil(MINIMO_CACHEABLE_HAIKU_4_5 * 3.5))
  it('con el prefijo en el mínimo o por encima pide caché', () => {
    expect(tokensAproximados(largo)).toBeGreaterThanOrEqual(MINIMO_CACHEABLE_HAIKU_4_5)
    expect(bloqueDeSistema(largo)).toEqual({ type: 'text', text: largo, cache_control: { type: 'ephemeral' } })
  })
  it('por debajo del mínimo no lleva cache_control', () => {
    const corto = largo.slice(0, largo.length - 10)
    expect(bloqueDeSistema(corto)).toEqual({ type: 'text', text: corto })
    expect('cache_control' in bloqueDeSistema('hola')).toBe(false)
  })
  it('las herramientas del prefijo cuentan para llegar al mínimo', () => {
    const mitad = 'a'.repeat(Math.ceil((MINIMO_CACHEABLE_HAIKU_4_5 * 3.5) / 2))
    expect(bloqueDeSistema(mitad).cache_control).toBeUndefined()
    expect(bloqueDeSistema(mitad, mitad).cache_control).toEqual({ type: 'ephemeral' })
  })
})

describe('qué petición lleva cache_control', () => {
  it('los prompts reales: solo el del registrador (con su herramienta) pasa el mínimo', () => {
    expect(tokensAproximados(PROMPT_SISTEMA)).toBeGreaterThan(MINIMO_CACHEABLE_HAIKU_4_5)
    expect(tokensAproximados(PROMPT_RIESGO)).toBeLessThan(MINIMO_CACHEABLE_HAIKU_4_5)
    expect(tokensAproximados(PROMPT_SISTEMA_INGRESO)).toBeLessThan(MINIMO_CACHEABLE_HAIKU_4_5)
  })

  it('el registrador pide caché del prefijo y su techo de salida es el medido', async () => {
    const e = entorno()
    await manejar(post('hice 4 series de sentadilla'), e.d)
    const [c] = e.cuerpos(true)
    expect(c.system).toEqual([{ type: 'text', text: PROMPT_SISTEMA, cache_control: { type: 'ephemeral' } }])
    expect(c.max_tokens).toBe(MAX_TOKENS_REGISTRO)
    expect(MAX_TOKENS_REGISTRO).toBe(800)
    expect(c.temperature).toBe(0)
    expect(c.tool_choice).toEqual({ type: 'tool', name: 'registrar' })
  })

  it('el lector de riesgo no lleva cache_control: su prompt no llega al mínimo', async () => {
    const e = entorno()
    await manejar(post('hice 4 series de sentadilla'), e.d)
    const [c] = e.cuerpos(false)
    expect(c.system).toEqual([{ type: 'text', text: PROMPT_RIESGO }])
    expect(JSON.stringify(c)).not.toContain('cache_control')
    expect(c.max_tokens).toBe(200)
  })

  it('el ingreso no lleva cache_control: su prompt no llega al mínimo', async () => {
    const llamadas: string[] = []
    const d: Dependencias = {
      entorno: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'sk-prueba-no-real' },
      fetch: (async (_u: RequestInfo | URL, init?: RequestInit) => {
        llamadas.push(String(init?.body))
        return new Response(JSON.stringify({ content: [{ type: 'text', text: '{}' }], usage: {} }))
      }) as unknown as typeof fetch,
      ahora: () => AHORA,
    }
    await llamarHaikuIngreso(d, 'sobre_ti', 'me llamo Ana')
    expect(llamadas).toHaveLength(1)
    const c = JSON.parse(llamadas[0])
    expect(c.system).toEqual([{ type: 'text', text: PROMPT_SISTEMA_INGRESO }])
    expect(llamadas[0]).not.toContain('cache_control')
  })
})

describe('el registro de tiempos', () => {
  it('sigue sin la frase de la persona (ni en el log ni en tiempos_ms)', async () => {
    const frase = 'frase-secreta-zxq hice 4 series'
    const espias = [vi.spyOn(console, 'log'), vi.spyOn(console, 'info'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')]
    espias.forEach((s) => s.mockImplementation(() => {}))
    const e = entorno()
    const c = await (await manejar(post(frase), e.d)).json()
    expect(Object.keys(c.meta.tiempos_ms).sort()).toEqual(['plan', 'registro', 'riesgo', 'total'])
    expect(JSON.stringify(c.meta)).not.toContain('frase-secreta-zxq')
    const log = espias.map((s) => JSON.stringify(s.mock.calls)).join('\n')
    expect(log).toContain('tiempos')
    expect(log).not.toContain('frase-secreta-zxq')
  })
})
