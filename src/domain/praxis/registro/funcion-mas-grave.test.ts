// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manejar, type Dependencias } from '../../../../supabase/functions/praxis-registro/index.ts'

/**
 * «Gana la lectura más grave» en la Edge Function (3-oct), con el modelo SIMULADO. Se cubren las dos entradas:
 * la ruta `releer_riesgo` (la que usa la pantalla) y la rama de frase marcada de `proponer`. Sin relojes: se
 * afirma por llamadas hechas y por contenido.
 */
const AHORA = new Date('2026-10-03T15:00:00Z')
const SALUD = 'me duele la rodilla izquierda'
const CUIDADO = 'me quiero morir con esta rutina de pierna'
const QUIETA = 'ya no quiero vivir'
const lector = (nivel: string) => ({ content: [{ type: 'text', text: JSON.stringify({ nivel, cita: '', por_que: 'prueba' }) }] })

type Modelo = { cuerpo: unknown; status?: number } | 'cuelga' | 'revienta'

function entorno(modelo: Modelo, interruptor: string | undefined = '1', usuario = 'u-1') {
  const llamadas: { url: string; init?: RequestInit }[] = []
  const avisos: unknown[] = []
  const fetchSim = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    llamadas.push({ url: u, init })
    if (/auth\/v1\/user/.test(u)) return new Response(JSON.stringify({ id: usuario }))
    if (/rest\/v1\/usuarios_app/.test(u)) return new Response(JSON.stringify([{ rol: 'coach' }]))
    if (/rest\/v1\/microciclos/.test(u)) return new Response(JSON.stringify([]))
    if (/rpc\/|avisos/.test(u)) { avisos.push(init?.body); return new Response('{}') }
    if (u.includes('api.anthropic.com')) {
      if (modelo === 'revienta') throw new TypeError('red caída')
      if (modelo === 'cuelga') throw Object.assign(new Error('timeout'), { name: 'TimeoutError' })
      return new Response(JSON.stringify(modelo.cuerpo), { status: modelo.status ?? 200 })
    }
    return new Response('{}', { status: 404 })
  })
  const d: Dependencias = {
    entorno: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'sk-prueba-no-real', ...(interruptor ? { PRAXIS_RIESGO_MAS_GRAVE: interruptor } : {}) },
    fetch: fetchSim as unknown as typeof fetch,
    ahora: () => AHORA,
  }
  const alModelo = () => llamadas.filter((l) => l.url.includes('api.anthropic.com'))
  const alPlan = () => llamadas.filter((l) => /rest\/v1\/microciclos/.test(l.url))
  return { d, alModelo, alPlan, avisos }
}
const releer = (frase: string) =>
  new Request('https://x.supabase.co/functions/v1/praxis-registro', {
    method: 'POST', headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' }, body: JSON.stringify({ accion: 'releer_riesgo', frase }),
  })
const proponer = (frase: string) =>
  new Request('https://x.supabase.co/functions/v1/praxis-registro', {
    method: 'POST', headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' }, body: JSON.stringify({ frase }),
  })

afterEach(() => vi.restoreAllMocks())

describe('releer_riesgo: el modelo solo SUBE la marca', () => {
  it('el filtro marca salud y el modelo se consulta (no se tapa)', async () => {
    const e = entorno({ cuerpo: lector('NINGUNO') })
    const r = await manejar(releer(SALUD), e.d)
    expect(e.alModelo()).toHaveLength(1)
    expect(r.status).toBe(200)
  })

  it('salud + modelo en urgencia → Quieta con la línea de VIDA', async () => {
    const e = entorno({ cuerpo: lector('URGENTE_FISICO') })
    const c = await (await manejar(releer(SALUD), e.d)).json()
    expect(c.marca).toEqual({ tipo: 'quieta', linea: 'vida' })
    expect(c.origen).toBe('modelo')
  })

  it('la Quieta lleva la línea de lo que leyó el MODELO, no la del filtro', async () => {
    const pareja = await (await manejar(releer(SALUD), entorno({ cuerpo: lector('RIESGO_VIOLENCIA') }).d)).json()
    expect(pareja.marca).toEqual({ tipo: 'quieta', linea: 'pareja' })
    const nino = await (await manejar(releer(CUIDADO), entorno({ cuerpo: lector('RIESGO_MENOR') }).d)).json()
    expect(nino.marca).toEqual({ tipo: 'quieta', linea: 'nino' })
  })

  it('salud + modelo cuidado → cuidado', async () => {
    const c = await (await manejar(releer(SALUD), entorno({ cuerpo: lector('AMBIGUO_VIDA') }).d)).json()
    expect(c.marca).toEqual({ tipo: 'cuidado' })
  })

  it('el modelo NO baja una marca: cuidado del filtro + NINGUNO o salud → sigue cuidado', async () => {
    for (const nivel of ['NINGUNO', 'DERIVAR', 'PREGUNTAR_ANTES_DE_ENTRENAR']) {
      const c = await (await manejar(releer(CUIDADO), entorno({ cuerpo: lector(nivel) }).d)).json()
      expect(c.marca).toEqual({ tipo: 'cuidado' })
      expect(c.origen).toBe('filtro')
    }
    const s = await (await manejar(releer(SALUD), entorno({ cuerpo: lector('NINGUNO') }).d)).json()
    expect(s.marca.tipo).toBe('salud')
  })

  it('con el filtro en Quieta NO se espera ni se llama al modelo', async () => {
    const e = entorno({ cuerpo: lector('NINGUNO') })
    const c = await (await manejar(releer(QUIETA), e.d)).json()
    expect(e.alModelo()).toHaveLength(0)
    expect(c.marca).toEqual({ tipo: 'quieta', linea: 'vida' })
    expect(c.consultado).toBe(false)
  })

  it('a prueba de fallos: el modelo falla, se corta por tiempo, revienta o es ilegible → queda la marca del filtro', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const casos: Modelo[] = [
      { cuerpo: { type: 'error' }, status: 500 },
      'cuelga',
      'revienta',
      { cuerpo: { content: [{ type: 'text', text: 'no sé' }] } },
      { cuerpo: { content: [{ type: 'text', text: JSON.stringify({ nivel: 'INVENTADO' }) }] } },
    ]
    for (const m of casos) {
      const r = await manejar(releer(SALUD), entorno(m).d)
      expect(r.status).toBe(200)
      const c = await r.json()
      expect(c.marca.tipo).toBe('salud')
      expect(c.origen).toBe('filtro')
    }
  })

  it('sin el interruptor (sin consentimiento) la frase NO se envía al modelo y sale la marca del filtro', async () => {
    const e = entorno({ cuerpo: lector('URGENTE_FISICO') }, '')
    const c = await (await manejar(releer(SALUD), e.d)).json()
    expect(e.alModelo()).toHaveLength(0)
    expect(c.marca.tipo).toBe('salud')
    const e0 = entorno({ cuerpo: lector('URGENTE_FISICO') }, '0')
    await manejar(releer(SALUD), e0.d)
    expect(e0.alModelo()).toHaveLength(0)
  })

  it('una frase que el filtro NO marca no se manda al modelo por esta puerta', async () => {
    const e = entorno({ cuerpo: lector('URGENTE_FISICO') })
    const c = await (await manejar(releer('hice 4 series de sentadilla con 60'), e.d)).json()
    expect(e.alModelo()).toHaveLength(0)
    expect(c.marca).toBeNull()
  })

  it('no lee el plan, no deja aviso al coach y la petición al lector es la medida (frase sola, sin herramientas)', async () => {
    const e = entorno({ cuerpo: lector('NINGUNO') })
    await manejar(releer(SALUD), e.d)
    expect(e.alPlan()).toHaveLength(0)
    expect(e.avisos).toHaveLength(0)
    const cuerpo = JSON.parse(String(e.alModelo()[0].init?.body))
    expect(cuerpo.tools).toBeUndefined()
    expect(cuerpo.messages).toEqual([{ role: 'user', content: SALUD }])
  })

  it('exige la misma sesión: sin token, 401, y el modelo no se llama', async () => {
    const e = entorno({ cuerpo: lector('URGENTE_FISICO') })
    const r = await manejar(new Request('https://x.supabase.co/functions/v1/praxis-registro', { method: 'POST', body: JSON.stringify({ accion: 'releer_riesgo', frase: SALUD }) }), e.d)
    expect(r.status).toBe(401)
    expect(e.alModelo()).toHaveLength(0)
  })

  it('pasado el límite por hora no se consulta y se queda la marca del filtro (nunca un 429 que la quite)', async () => {
    // otra persona: el contador por hora vive en el módulo y no debe contaminar a las demás pruebas
    const e = entorno({ cuerpo: lector('URGENTE_FISICO') }, '1', 'u-del-limite')
    let ultimo: { marca: { tipo: string } } | null = null
    for (let i = 0; i < 70; i++) ultimo = await (await manejar(releer(SALUD), e.d)).json()
    expect(ultimo?.marca.tipo).toBe('salud')
    expect(e.alModelo().length).toBeLessThan(70)
  })
})

describe('proponer con una frase marcada que llegó al servidor', () => {
  it('con el interruptor, salud + modelo en urgencia → derivación Quieta con la línea del modelo', async () => {
    const e = entorno({ cuerpo: lector('RIESGO_VIDA') })
    const c = await (await manejar(proponer(SALUD), e.d)).json()
    expect(c.propuesta.accion).toBe('derivar')
    expect(c.propuesta.riesgo).toEqual({ tipo: 'quieta', linea: 'vida' })
    expect(c.meta.lector_riesgo).toBe('RIESGO_VIDA')
  })
  it('el modelo falla → la derivación del filtro, como hoy', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const c = await (await manejar(proponer(SALUD), entorno({ cuerpo: {}, status: 500 }).d)).json()
    expect(c.propuesta.accion).toBe('derivar')
    expect(c.propuesta.riesgo).toBeUndefined()
    expect(c.meta.lector_riesgo).toBeUndefined()
  })
  it('sin interruptor, como hoy: el modelo no ve la frase marcada', async () => {
    const e = entorno({ cuerpo: lector('RIESGO_VIDA') }, '')
    const c = await (await manejar(proponer(SALUD), e.d)).json()
    expect(e.alModelo()).toHaveLength(0)
    expect(c.propuesta.riesgo).toBeUndefined()
  })
  it('filtro en Quieta: no se consulta al modelo', async () => {
    const e = entorno({ cuerpo: lector('NINGUNO') })
    const c = await (await manejar(proponer(QUIETA), e.d)).json()
    expect(e.alModelo()).toHaveLength(0)
    expect(c.propuesta.riesgo).toEqual({ tipo: 'quieta', linea: 'vida' })
  })
})
