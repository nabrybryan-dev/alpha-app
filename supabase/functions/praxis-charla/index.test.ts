import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_CHARLA_POR_HORA, manejar, vistoCharla, type Dependencias, type Entorno } from './index.ts'

const AHORA = new Date('2026-11-11T20:00:00Z')
const FRASE = '¿cuántas series por músculo a la semana?'
const PIEZA = { id: 'vol-01', respuesta: 'Texto firmado uno', estudios: 'Estudios uno', criterio_de_practica: 'Criterio uno' }

interface Opciones {
  activa?: string
  auth?: boolean
  lector?: string | (() => Promise<Response>)
  deepseek?: unknown | (() => Promise<Response>)
  deepseekClave?: string | undefined
  piezas?: unknown[]
}

function montar(o: Opciones = {}): { d: Dependencias; llamadas: { url: string; cuerpo: string }[] } {
  const llamadas: { url: string; cuerpo: string }[] = []
  const fetchFalso = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url)
    llamadas.push({ url: u, cuerpo: typeof init?.body === 'string' ? init.body : '' })
    if (u.includes('/auth/v1/user')) return o.auth === false ? new Response('{}', { status: 401 }) : new Response(JSON.stringify({ id: 'u1' }))
    if (u.includes('api.anthropic.com')) {
      if (typeof o.lector === 'function') return o.lector()
      return new Response(JSON.stringify({ content: [{ type: 'text', text: o.lector ?? '{"nivel":"NINGUNO","cita":""}' }] }))
    }
    if (u.endsWith('/vector')) return new Response(JSON.stringify({ vector: Array(768).fill(0.1) }))
    if (u.includes('buscar_conceptos_vector')) return new Response(JSON.stringify((o.piezas ?? [PIEZA]).map((p) => ({ id: (p as { id: string }).id, coseno: 0.9 }))))
    if (u.includes('/rest/v1/praxis_conceptos')) return new Response(JSON.stringify(o.piezas ?? [PIEZA]))
    if (u.includes('api.deepseek.com')) {
      if (typeof o.deepseek === 'function') return (o.deepseek as () => Promise<Response>)()
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(o.deepseek ?? { respuesta: 'Redacción del modelo', piezas_usadas: ['vol-01'] }) } }] }))
    }
    return new Response('{}', { status: 404 })
  }) as typeof fetch
  const entorno: Entorno = {
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_ANON_KEY: 'anon',
    PRAXIS_CHARLA_ACTIVA: 'activa' in o ? o.activa : '1',
    DEEPSEEK_API_KEY: 'deepseekClave' in o ? o.deepseekClave : 'sk-d',
    ANTHROPIC_API_KEY: 'sk-a',
    PORTERO_URL: 'https://portero',
    PORTERO_CLAVE: 'c',
    PRAXIS_CHARLA_NOMBRES: undefined,
  }
  return { llamadas, d: { entorno, fetch: fetchFalso, ahora: () => AHORA } }
}

const pedir = (frase: unknown, token: string | null = 'jwt', metodo = 'POST') =>
  new Request('https://f/praxis-charla', { method: metodo, headers: token ? { authorization: `Bearer ${token}` } : {}, body: metodo === 'POST' ? JSON.stringify({ frase }) : undefined })

const aDeepseek = (l: { url: string }[]) => l.filter((x) => x.url.includes('deepseek'))

afterEach(() => {
  vistoCharla.clear()
  vi.restoreAllMocks()
})

describe('praxis-charla: apagada por defecto', () => {
  it('sin la bandera responde 503 y NO llama a nada', async () => {
    for (const activa of [undefined, '', '0', 'true']) {
      const { d, llamadas } = montar({ activa })
      expect((await manejar(pedir(FRASE), d)).status).toBe(503)
      expect(llamadas).toEqual([])
    }
  })
})

describe('praxis-charla: orden de las puertas', () => {
  it('sin sesión o con sesión inválida no toca ningún modelo', async () => {
    const a = montar()
    expect((await manejar(pedir(FRASE, null), a.d)).status).toBe(401)
    expect(a.llamadas).toEqual([])
    const b = montar({ auth: false })
    expect((await manejar(pedir(FRASE), b.d)).status).toBe(401)
    expect(b.llamadas.every((l) => l.url.includes('/auth/v1/user'))).toBe(true)
  })

  it('el límite por persona corta antes de cualquier modelo', async () => {
    const { d, llamadas } = montar()
    vistoCharla.set('u1', Array(MAX_CHARLA_POR_HORA).fill(AHORA.getTime()))
    expect((await manejar(pedir(FRASE), d)).status).toBe(429)
    expect(llamadas.some((l) => l.url.includes('anthropic') || l.url.includes('deepseek'))).toBe(false)
  })

  it('una frase de salud la corta el filtro local: ni lector, ni piezas, ni DeepSeek', async () => {
    const { d, llamadas } = montar()
    const r = await manejar(pedir('me duele la rodilla al bajar en sentadilla'), d)
    expect(await r.json()).toEqual({ salida: 'coach', motivo: 'filtro_local' })
    expect(llamadas.map((l) => l.url).filter((u) => !u.includes('/auth/'))).toEqual([])
  })

  it('el lector dice algo distinto de sin riesgo: coach y DeepSeek NO se llama', async () => {
    const { d, llamadas } = montar({ lector: '{"nivel":"DERIVAR","cita":"x"}' })
    expect(await (await manejar(pedir(FRASE), d)).json()).toEqual({ salida: 'coach', motivo: 'riesgo' })
    expect(aDeepseek(llamadas)).toEqual([])
  })

  it('el lector falla (HTTP 500, ilegible o sin clave): coach y DeepSeek NO se llama', async () => {
    for (const lector of [async () => new Response('{}', { status: 500 }), 'no es json']) {
      const { d, llamadas } = montar({ lector })
      expect((await (await manejar(pedir(FRASE), d)).json()).salida).toBe('coach')
      expect(aDeepseek(llamadas)).toEqual([])
    }
    const sinClave = montar()
    sinClave.d.entorno.ANTHROPIC_API_KEY = undefined
    expect((await (await manejar(pedir(FRASE), sinClave.d)).json()).motivo).toBe('lector_falla')
    expect(aDeepseek(sinClave.llamadas)).toEqual([])
  })

  it('el lector tarda más del tope: coach y DeepSeek NO se llama', async () => {
    vi.useFakeTimers()
    try {
      const { d, llamadas } = montar({ lector: () => new Promise<Response>(() => {}) })
      const p = manejar(pedir(FRASE), d)
      await vi.advanceTimersByTimeAsync(3100)
      expect(await (await p).json()).toEqual({ salida: 'coach', motivo: 'lector_tarda' })
      expect(aDeepseek(llamadas)).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('praxis-charla: el camino feliz y el respaldo', () => {
  it('con sin riesgo: DeepSeek recibe solo frase limpia y piezas, con su clave, y la respuesta sale validada', async () => {
    const { d, llamadas } = montar()
    const r = await manejar(pedir('soy Marcela, ¿cuántas series por músculo a la semana?'), d)
    const j = await r.json()
    expect(j).toEqual({
      salida: 'respuesta',
      respuesta: 'Redacción del modelo',
      piezas_usadas: ['vol-01'],
      piezas: [{ id: 'vol-01', estudios: 'Estudios uno', criterio_de_practica: 'Criterio uno' }],
      origen: 'modelo',
    })
    const ds = aDeepseek(llamadas)
    expect(ds).toHaveLength(1)
    expect(ds[0].url).toBe('https://api.deepseek.com/chat/completions')
    const cuerpo = JSON.parse(ds[0].cuerpo) as { model: string; messages: { content: string }[] }
    expect(cuerpo.model).toBe('deepseek-flash')
    expect(ds[0].cuerpo).not.toMatch(/Marcela|u1|jwt|sk-d/) // control positivo: el nombre sembrado no sale; ni id ni token
    expect(cuerpo.messages[1].content).toContain('[NOMBRE]')
  })

  it('el registro lleva los nombres de los campos y no el texto', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { d } = montar()
    await manejar(pedir('soy Marcela, ¿cuántas series por músculo a la semana?'), d)
    const linea = log.mock.calls.map((c) => c.join(' ')).join('\n')
    expect(linea).toContain('piezas[].estudios')
    expect(linea).toContain('"tapado":["nombre"]')
    expect(linea).not.toMatch(/Marcela|series por músculo|Texto firmado/)
  })

  it('DeepSeek falla, tarda o devuelve basura: la pieza tal cual, nunca vacío', async () => {
    const casos: Opciones[] = [
      { deepseek: async () => new Response('{}', { status: 500 }) },
      { deepseek: async () => { throw new Error('red') } },
      { deepseek: { respuesta: '', piezas_usadas: ['vol-01'] } },
      { deepseek: { respuesta: 'ok', piezas_usadas: ['otra'] } },
      { deepseekClave: undefined },
    ]
    for (const c of casos) {
      const { d } = montar(c)
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const j = await (await manejar(pedir(FRASE), d)).json()
      expect(j.origen).toBe('respaldo')
      expect(j.respuesta).toBe('Texto firmado uno')
      expect(j.piezas[0]).toEqual({ id: 'vol-01', estudios: 'Estudios uno', criterio_de_practica: 'Criterio uno' })
    }
  })

  it('DeepSeek tarda más del tope: respaldo', async () => {
    vi.useFakeTimers()
    try {
      const { d } = montar({ deepseek: () => new Promise<Response>(() => {}) })
      const p = manejar(pedir(FRASE), d)
      await vi.advanceTimersByTimeAsync(4100)
      const j = await (await p).json()
      expect(j.origen).toBe('respaldo')
      expect(j.respuesta).toBe('Texto firmado uno')
    } finally {
      vi.useRealTimers()
    }
  })

  it('sin piezas que contesten no se llama a DeepSeek y la respuesta no es vacía', async () => {
    const { d, llamadas } = montar({ piezas: [] })
    const j = await (await manejar(pedir(FRASE), d)).json()
    expect(aDeepseek(llamadas)).toEqual([])
    expect(j.respuesta.length).toBeGreaterThan(0)
    expect(j.origen).toBe('respaldo')
  })

  it('una pieza sin estudios no pinta el bloque de estudios', async () => {
    const { d } = montar({ piezas: [{ ...PIEZA, estudios: '' }] })
    const j = await (await manejar(pedir(FRASE), d)).json()
    expect(j.piezas[0].estudios).toBeNull()
  })
})
