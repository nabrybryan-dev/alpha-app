import { afterEach, describe, expect, it, vi } from 'vitest'
import { ROTULO_PROVISIONAL } from '../../../src/domain/praxis/charla/provisional.ts'
import { SIN_PIEZA_PROVISIONAL } from '../../../src/domain/praxis/charla/salidaCharla.ts'
import { MAX_CHARLA_POR_HORA, TOPE_DEEPSEEK_MS, manejar, vistoCharla, type Dependencias, type Entorno } from './index.ts'

const AHORA = new Date('2026-11-11T20:00:00Z')
const FRASE = '¿cuántas series por músculo a la semana?'
const PIEZA = { id: 'vol-01', respuesta: 'Texto firmado uno', estudios: 'Estudios uno', criterio_de_practica: 'Criterio uno' }

interface Opciones {
  activa?: string
  auth?: boolean
  lector?: string | (() => Promise<Response>)
  deepseek?: unknown | (() => Promise<Response>)
  deepseekClave?: string | undefined
  /** Cuerpo completo de la respuesta de DeepSeek (para probar finish_reason y contenido vacío). */
  deepseekCrudo?: unknown
  piezas?: unknown[]
  provisional?: string | undefined
  textoProvisional?: string | (() => Promise<Response>)
  /** Cola de huecos: bandera, clave de servicio y comportamiento de la tabla falsa. */
  encolar?: string
  claveServicio?: string
  tabla?: { tema_clave: string; frase_limpia: string; conteo: number; primera_vez: string; estado: string } | null
  tablaFalla?: 'lectura' | 'escritura' | 'red' | 'tarda'
}

function montar(o: Opciones = {}): { d: Dependencias; llamadas: { url: string; cuerpo: string }[] } {
  const llamadas: { url: string; cuerpo: string }[] = []
  const fetchFalso = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url)
    llamadas.push({ url: u, cuerpo: typeof init?.body === 'string' ? init.body : '' })
    if (u.includes('/rest/v1/praxis_huecos')) {
      if (o.tablaFalla === 'red') throw new Error('sin red')
      if (o.tablaFalla === 'tarda') return new Promise<Response>(() => {}) // nunca responde
      if (init?.method === 'POST') return o.tablaFalla === 'escritura' ? new Response('{}', { status: 500 }) : new Response(null, { status: 201 })
      return o.tablaFalla === 'lectura' ? new Response('{}', { status: 500 }) : new Response(JSON.stringify(o.tabla ? [o.tabla] : []))
    }
    if (u.includes('/auth/v1/user')) return o.auth === false ? new Response('{}', { status: 401 }) : new Response(JSON.stringify({ id: 'u1' }))
    if (u.includes('api.anthropic.com')) {
      if (typeof o.lector === 'function') return o.lector()
      return new Response(JSON.stringify({ content: [{ type: 'text', text: o.lector ?? '{"nivel":"NINGUNO","cita":""}' }] }))
    }
    if (u.endsWith('/vector')) return new Response(JSON.stringify({ vector: Array(768).fill(0.1) }))
    if (u.includes('buscar_conceptos_vector')) return new Response(JSON.stringify((o.piezas ?? [PIEZA]).map((p) => ({ id: (p as { id: string }).id, coseno: 0.9 }))))
    if (u.includes('/rest/v1/praxis_conceptos')) return new Response(JSON.stringify(o.piezas ?? [PIEZA]))
    if (u.includes('api.deepseek.com')) {
      if (o.textoProvisional !== undefined) {
        if (typeof o.textoProvisional === 'function') return o.textoProvisional()
        return new Response(JSON.stringify({ choices: [{ message: { content: o.textoProvisional } }] }))
      }
      if (o.deepseekCrudo !== undefined) return new Response(JSON.stringify(o.deepseekCrudo))
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
    PRAXIS_CHARLA_PROVISIONAL: o.provisional,
    PRAXIS_HUECOS_ENCOLAR: o.encolar,
    SUPABASE_SERVICE_ROLE_KEY: 'claveServicio' in o ? o.claveServicio : 'srv-secreta',
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

  it('el cuerpo a DeepSeek lleva thinking disabled (si no, deepseek-flash gasta los max_tokens razonando y vuelve vacío)', async () => {
    const { d, llamadas } = montar()
    await manejar(pedir(FRASE), d)
    const cuerpo = JSON.parse(aDeepseek(llamadas)[0].cuerpo) as { thinking?: unknown }
    expect(cuerpo.thinking).toEqual({ type: 'disabled' })
  })

  it('finish_reason «length»: respaldo, aunque el contenido cortado fuera un JSON válido', async () => {
    const valido = JSON.stringify({ respuesta: 'Redacción del modelo', piezas_usadas: ['vol-01'] })
    const { d } = montar({ deepseekCrudo: { choices: [{ finish_reason: 'length', message: { content: valido } }] } })
    const j = await (await manejar(pedir(FRASE), d)).json()
    expect(j.origen).toBe('respaldo')
    expect(j.respuesta).toBe('Texto firmado uno')
  })

  it('contenido vacío (el razonamiento se comió los tokens): respaldo', async () => {
    for (const content of ['', null, '   ']) {
      const { d } = montar({ deepseekCrudo: { choices: [{ finish_reason: 'stop', message: { content } }] } })
      const j = await (await manejar(pedir(FRASE), d)).json()
      expect(j.origen).toBe('respaldo')
      expect(j.respuesta).toBe('Texto firmado uno')
    }
  })

  it('control positivo: finish_reason «stop» con JSON válido sigue saliendo del modelo', async () => {
    const valido = JSON.stringify({ respuesta: 'Redacción del modelo', piezas_usadas: ['vol-01'] })
    const { d } = montar({ deepseekCrudo: { choices: [{ finish_reason: 'stop', message: { content: valido } }] } })
    expect((await (await manejar(pedir(FRASE), d)).json()).origen).toBe('modelo')
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

  // ---- H4 (informe del custodio): la frase limpia es la que va a la búsqueda de piezas y a DeepSeek ----
  it('H4: el cuerpo enviado a /vector y a DeepSeek no contiene el nombre sembrado (el lector sí recibe la frase cruda: es H3)', async () => {
    const { d, llamadas } = montar()
    await manejar(pedir('entreno con Tiburcio Zambrano, ¿cuántas series por músculo a la semana?'), d)
    const vector = llamadas.find((l) => l.url.endsWith('/vector'))
    expect(vector?.cuerpo).toBeTruthy()
    expect(vector!.cuerpo).not.toMatch(/Tiburcio|Zambrano/)
    expect(vector!.cuerpo).toContain('[…]')
    expect(aDeepseek(llamadas)[0].cuerpo).not.toMatch(/Tiburcio|Zambrano/)
    const lector = llamadas.find((l) => l.url.includes('anthropic'))
    expect(lector!.cuerpo).toContain('Tiburcio') // H3 (abogado): el lector sigue con la frase cruda, a propósito
  })

  it('vocabulario: un nombre en minúscula y un barrio no llegan a /vector ni a DeepSeek; el lector sí recibe la cruda', async () => {
    const { d, llamadas } = montar()
    await manejar(pedir('entreno con zulema en el barrio las acacias, ¿cuántas series por músculo a la semana?'), d)
    const vector = llamadas.find((l) => l.url.endsWith('/vector'))
    expect(vector!.cuerpo).not.toMatch(/zulema|acacias/i)
    expect(vector!.cuerpo).toContain('series')
    expect(aDeepseek(llamadas)[0].cuerpo).not.toMatch(/zulema|acacias/i)
    expect(llamadas.find((l) => l.url.includes('anthropic'))!.cuerpo).toContain('zulema')
  })

  it('H2: la frase pasa de 200 caracteres se rechaza con 400 antes de cualquier modelo', async () => {
    const ok = montar()
    expect((await manejar(pedir('a'.repeat(200)), ok.d)).status).toBe(200)
    const largo = montar()
    expect((await manejar(pedir('a'.repeat(201)), largo.d)).status).toBe(400)
    expect(largo.llamadas.every((l) => l.url.includes('/auth/v1/user'))).toBe(true)
  })
})

describe('praxis-charla: respuesta provisional (segunda bandera PRAXIS_CHARLA_PROVISIONAL, apagada por defecto)', () => {
  const LIMPIA = 'El volumen es el trabajo total sobre un músculo en la semana.'

  it('bandera apagada: comportamiento actual (frase fija, sin llamar a DeepSeek) y devuelve el hueco', async () => {
    for (const provisional of [undefined, '', '0', 'true']) {
      const { d, llamadas } = montar({ piezas: [], provisional, textoProvisional: LIMPIA })
      const j = await (await manejar(pedir(FRASE), d)).json()
      expect(aDeepseek(llamadas)).toEqual([])
      expect(j.origen).toBe('respaldo')
      expect(j.respuesta).toBe(SIN_PIEZA_PROVISIONAL)
      expect(j.hueco.temaClave.length).toBeGreaterThan(0)
      expect(Object.keys(j.hueco).sort()).toEqual(['frase', 'temaClave'])
    }
  })

  it('D12: bandera APAGADA y salud en la frase: al coach, sin hueco y sin DeepSeek (la revisión de salud no depende de la bandera)', async () => {
    const frases = [
      'tengo un pinchazo en el codo cuando hago dominadas',
      'agujetas fuertes en el cuello y hombro, es grave?',
      'tomo medicacion para la tension, puedo entrenar piernas?',
      'me salio una hinchazon en la rodilla despues de sentadilla',
    ]
    for (const provisional of [undefined, '', '0', 'true']) {
      for (const frase of frases) {
        const { d, llamadas } = montar({ piezas: [], provisional, textoProvisional: LIMPIA })
        const j = await (await manejar(pedir(frase), d)).json()
        expect(j.salida, frase).toBe('coach')
        expect(j.hueco, frase).toBeUndefined()
        expect(aDeepseek(llamadas), frase).toEqual([])
      }
    }
  })

  it('bandera puesta y el lector dice riesgo: NO se llama a DeepSeek y no hay hueco', async () => {
    const { d, llamadas } = montar({ piezas: [], provisional: '1', textoProvisional: LIMPIA, lector: '{"nivel":"ALTO","cita":"x"}' })
    const j = await (await manejar(pedir(FRASE), d)).json()
    expect(j.salida).toBe('coach')
    expect(aDeepseek(llamadas)).toEqual([])
    expect(j.hueco).toBeUndefined()
  })

  it('salud en la frase: al coach SIN llamar a DeepSeek y sin hueco (la frase de un síntoma no se guarda)', async () => {
    const frases = [
      'tengo un pinchazo en el codo cuando hago dominadas',
      'agujetas fuertes en el cuello y hombro, es grave?',
      'tomo medicacion para la tension, puedo entrenar piernas?',
      'me da hormigueo en la mano al hacer press',
      'me salio una hinchazon en la rodilla despues de sentadilla',
      'si tengo una molestia en el hombro, sigo con las series?',
    ]
    for (const frase of frases) {
      const { d, llamadas } = montar({ piezas: [], provisional: '1', textoProvisional: LIMPIA })
      const j = await (await manejar(pedir(frase), d)).json()
      expect(j.salida, frase).toBe('coach')
      expect(aDeepseek(llamadas), frase).toEqual([])
      expect(j.hueco, frase).toBeUndefined()
    }
  })

  it('salud en la frase que SOLO ve el léxico de la charla (el lector la da por «sin riesgo»): motivo provisional_salud_en_frase', async () => {
    const { d, llamadas } = montar({ piezas: [], provisional: '1', textoProvisional: LIMPIA })
    const j = await (await manejar(pedir('agujetas fuertes en el cuello y hombro, es grave?'), d)).json()
    expect(j.motivo).toBe('provisional_salud_en_frase')
    expect(aDeepseek(llamadas)).toEqual([])
  })

  it('control positivo: una pregunta de entrenamiento sin síntoma sigue llegando a DeepSeek', async () => {
    const { d, llamadas } = montar({ piezas: [], provisional: '1', textoProvisional: LIMPIA })
    const j = await (await manejar(pedir('¿cuántas series por semana para el pecho?'), d)).json()
    expect(aDeepseek(llamadas)).toHaveLength(1)
    expect(j.origen).toBe('provisional')
  })

  it('bandera puesta y salida con cifra: al coach, sin el texto del modelo, con hueco', async () => {
    const { d } = montar({ piezas: [], provisional: '1', textoProvisional: 'Suele subir un 40 % con el tiempo.' })
    const r = await (await manejar(pedir(FRASE), d)).text()
    const j = JSON.parse(r)
    expect(j.salida).toBe('coach')
    expect(j.motivo).toBe('provisional_cifras')
    expect(r).not.toContain('40')
    expect(j.hueco.temaClave.length).toBeGreaterThan(0)
  })

  it('bandera puesta y salida limpia: provisional con rótulo, origen y exclusión; DeepSeek recibe solo frase limpia y max_tokens 200', async () => {
    const { d, llamadas } = montar({ piezas: [], provisional: '1', textoProvisional: LIMPIA })
    const j = await (await manejar(pedir('Soy zulema, ¿cuántas series por semana para el pecho?'), d)).json()
    expect(j).toMatchObject({ salida: 'respuesta', origen: 'provisional', excluirEntrenamiento: true, piezas: [], piezas_usadas: [] })
    expect(j.respuesta.startsWith(ROTULO_PROVISIONAL)).toBe(true)
    expect(j.respuesta).toContain(LIMPIA)
    expect(j.hueco.temaClave.length).toBeGreaterThan(0)
    const env = aDeepseek(llamadas)
    expect(env).toHaveLength(1)
    expect(JSON.parse(env[0].cuerpo).max_tokens).toBe(200)
    expect(env[0].cuerpo.toLowerCase()).not.toContain('zulema')
    expect(JSON.stringify(j).toLowerCase()).not.toContain('zulema')
  })

  it('bandera puesta y DeepSeek cae, falla o no hay clave: al coach, sin texto del modelo', async () => {
    const caidas: Opciones[] = [
      { textoProvisional: async () => new Response('x', { status: 500 }) },
      {
        textoProvisional: async () => {
          throw new Error('red')
        },
      },
      { textoProvisional: LIMPIA, deepseekClave: undefined },
    ]
    for (const c of caidas) {
      const { d } = montar({ piezas: [], provisional: '1', ...c })
      const j = await (await manejar(pedir(FRASE), d)).json()
      expect(j.salida).toBe('coach')
      expect(String(j.motivo)).toMatch(/^provisional_/)
      expect(j.respuesta).toBeUndefined()
      expect(j.hueco.temaClave.length).toBeGreaterThan(0)
    }
  })

  it('bandera puesta y DeepSeek tarda más del tope: al coach', async () => {
    vi.useFakeTimers()
    try {
      const { d } = montar({ piezas: [], provisional: '1', textoProvisional: () => new Promise<Response>(() => {}) })
      const p = manejar(pedir(FRASE), d)
      await vi.advanceTimersByTimeAsync(TOPE_DEEPSEEK_MS + 100)
      const j = await (await p).json()
      expect(j.salida).toBe('coach')
      expect(j.motivo).toBe('provisional_deepseek_tarda')
    } finally {
      vi.useRealTimers()
    }
  })

  it('con piezas, la bandera no cambia nada: sale el flujo normal y no hay respuesta provisional', async () => {
    const { d } = montar({ provisional: '1', textoProvisional: LIMPIA, deepseek: undefined })
    const j = await (await manejar(pedir(FRASE), d)).json()
    expect(j.origen).not.toBe('provisional')
  })
})

describe('praxis-charla: cola de huecos (bandera PRAXIS_HUECOS_ENCOLAR, apagada por defecto)', () => {
  const sinPieza = { piezas: [] as unknown[] }
  const aHuecos = (l: { url: string }[]) => l.filter((x) => x.url.includes('/rest/v1/praxis_huecos'))

  it('bandera apagada (ausente, vacía, 0, true): no se toca la tabla y la respuesta es la de siempre', async () => {
    for (const encolar of [undefined, '', '0', 'true']) {
      const { d, llamadas } = montar({ ...sinPieza, encolar })
      const r = await manejar(pedir(FRASE), d)
      expect(r.status).toBe(200)
      expect(((await r.json()) as { hueco?: unknown }).hueco).toBeDefined()
      expect(aHuecos(llamadas)).toEqual([])
    }
  })

  it('bandera puesta y sin pieza: lee el tema y escribe una fila nueva con conteo 1 y la clave de servicio', async () => {
    const { d, llamadas } = montar({ ...sinPieza, encolar: '1', tabla: null })
    const r = await manejar(pedir(FRASE), d)
    const cuerpo = (await r.json()) as { hueco: { temaClave: string; frase: string } }
    const h = aHuecos(llamadas)
    expect(h.map((x) => x.cuerpo === '' ? 'GET' : 'POST')).toEqual(['GET', 'POST'])
    const fila = JSON.parse(h[1].cuerpo)
    expect(fila).toMatchObject({ tema_clave: cuerpo.hueco.temaClave, frase_limpia: cuerpo.hueco.frase, conteo: 1, estado: 'nuevo' })
    expect(h[1].url).toContain('on_conflict=tema_clave')
  })

  it('el tema ya existe: el conteo sube en uno', async () => {
    const { d, llamadas } = montar({ ...sinPieza, encolar: '1' })
    const primero = await manejar(pedir(FRASE), montar({ ...sinPieza }).d)
    const { hueco } = (await primero.json()) as { hueco: { temaClave: string; frase: string } }
    const m2 = montar({ ...sinPieza, encolar: '1', tabla: { tema_clave: hueco.temaClave, frase_limpia: hueco.frase, conteo: 4, primera_vez: '2026-11-01T00:00:00.000Z', estado: 'agrupado' } })
    await manejar(pedir(FRASE), m2.d)
    const post = aHuecos(m2.llamadas).find((x) => x.cuerpo !== '')!
    expect(JSON.parse(post.cuerpo)).toMatchObject({ conteo: 5, primera_vez: '2026-11-01T00:00:00.000Z', estado: 'agrupado' })
    expect(llamadas).toEqual([])
    void d
  })

  it('privacidad: la fila y la llamada no llevan id de persona, token, ni la frase cruda; la clave de servicio va solo en la cabecera', async () => {
    const cruda = '¿cuántas series por semana? soy Juan Pérez, escríbeme a juan@correo.com'
    const m = montar({ ...sinPieza, encolar: '1' })
    await manejar(pedir(cruda, 'jwt-del-usuario'), m.d)
    const h = aHuecos(m.llamadas)
    expect(h.length).toBeGreaterThan(0)
    for (const x of h) {
      expect(x.url + x.cuerpo).not.toMatch(/bu1b|jwt-del-usuario|srv-secreta|juan|p[eé]rez|correo.com|@/i)
    }
    const fila = JSON.parse(h.find((x) => x.cuerpo !== '')!.cuerpo)
    expect(Object.keys(fila).sort()).toEqual(['conteo', 'estado', 'frase_limpia', 'primera_vez', 'tema_clave', 'ultima_vez'])
  })

  it('salud en la frase (sin hueco): no se encola nada', async () => {
    const { d, llamadas } = montar({ ...sinPieza, encolar: '1', provisional: '1' })
    const r = await manejar(pedir('me duele la rodilla cuando hago sentadilla'), d)
    expect(((await r.json()) as { salida: string }).salida).toBe('coach')
    expect(aHuecos(llamadas)).toEqual([])
  })

  it('con piezas no hay hueco y no se encola', async () => {
    const { d, llamadas } = montar({ encolar: '1' })
    await manejar(pedir(FRASE), d)
    expect(aHuecos(llamadas)).toEqual([])
  })

  it('sin clave de servicio no se intenta nada', async () => {
    const { d, llamadas } = montar({ ...sinPieza, encolar: '1', claveServicio: undefined })
    expect((await manejar(pedir(FRASE), d)).status).toBe(200)
    expect(aHuecos(llamadas)).toEqual([])
  })

  it('falla cerrado: si el encolado falla (lectura, escritura, red o tarda), la respuesta al usuario es idéntica a la de la bandera apagada', async () => {
    const base = montar({ ...sinPieza })
    const esperado = await (await manejar(pedir(FRASE), base.d)).json()
    for (const tablaFalla of ['lectura', 'escritura', 'red', 'tarda'] as const) {
      const m = montar({ ...sinPieza, encolar: '1', tablaFalla })
      vistoCharla.clear()
      const r = await manejar(pedir(FRASE), m.d)
      expect(r.status).toBe(200)
      expect(await r.json()).toEqual(esperado)
    }
  }, 15000)

  it('también con la rama provisional: la respuesta no cambia y el hueco se encola', async () => {
    const sin = montar({ ...sinPieza, provisional: '1', textoProvisional: 'Depende de tu nivel y de tu tiempo; tu coach lo ajusta contigo.' })
    const esperado = await (await manejar(pedir(FRASE), sin.d)).json()
    const con = montar({ ...sinPieza, provisional: '1', textoProvisional: 'Depende de tu nivel y de tu tiempo; tu coach lo ajusta contigo.', encolar: '1' })
    vistoCharla.clear()
    expect(await (await manejar(pedir(FRASE), con.d)).json()).toEqual(esperado)
    expect(aHuecos(con.llamadas).length).toBe(2)
  })
})
