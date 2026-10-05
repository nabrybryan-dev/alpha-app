// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manejar, subDelJwt, type Dependencias } from '../../../../supabase/functions/praxis-registro/index.ts'
import type { MicrocicloJson } from './contexto.ts'

/**
 * Menos espera antes de llamar al modelo (Bryan, 2-oct: «Praxis se queda cargando»). Medido en
 * producción, la sesión (Auth 662–789 ms), el rol (hasta 1 091) y el plan (hasta 358) corrían uno
 * tras otro. Ahora las tres lecturas arrancan a la vez. Lo que NO cambia, y aquí se prueba:
 *
 *   REGLA DURA  ninguna frase llega a Anthropic (registrador ni lector de riesgo) antes de que
 *               Auth Y el rol hayan pasado. Un asesorado no puede mandar su texto al modelo
 *               mientras Praxis está cerrada (revisión del PR #331, A2).
 *   El `sub` del token solo adelanta las lecturas: la respuesta sigue dependiendo de que
 *   `/auth/v1/user` diga que sí y devuelva ESE mismo id.
 */
const AHORA = new Date('2026-10-02T15:00:00Z')
const YO = '11111111-1111-4111-8111-111111111111'
const OTRA = '22222222-2222-4222-8222-222222222222'
const micro: MicrocicloJson = {
  id: 'm-1', numero: 12, cadenciaDias: 7, fechaInicio: '2026-09-28',
  sesiones: [{ id: 'S1', nombre: 'PIERNA', dia: 'LUNES', ejercicios: [{ id: 'pa1', nombre: 'SENTADILLA TRASERA', sets: 4, rango: '8-12', unidadCarga: 'kg', series: [] }] }],
}
const registrador = { content: [{ type: 'tool_use', name: 'registrar', input: { intencion: ['charla'], entreno: [], comida: null, vida: null, sesion: null, correccion: null, aclaracion: null, clinico: { hay: false, cita: null }, fuera_de_alcance: true } }], usage: { input_tokens: 1800, output_tokens: 220 } }
const lector = { content: [{ type: 'text', text: JSON.stringify({ nivel: 'NINGUNO', cita: '', por_que: 'prueba' }) }] }

const b64u = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
/** Un JWT con la forma de verdad (la firma no se mira aquí: la mira el gateway). */
const jwtDe = (sub: string) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub, role: 'authenticated' })}.firma`

interface Opciones {
  /** Lo que contesta Auth: un id, un número (el status de error) o 'cae' (la red se cae). */
  auth?: string | number | 'cae'
  rol?: string | null
  plan?: 'ok' | 'cae'
  /** Retraso de cada lectura, en ms de reloj. */
  tarda?: { auth?: number; rol?: number; plan?: number }
  /** Cómo se espera: con setTimeout (por defecto) o con promesas que la prueba suelta a mano. */
  manual?: boolean
}
interface Llamada { url: string; init?: RequestInit; t: number }

function entorno(o: Opciones = {}) {
  const llamadas: Llamada[] = []
  const eventos: string[] = []
  const pendientes: { quien: string; soltar: () => void }[] = []
  const t0 = Date.now()
  const esperar = (quien: 'auth' | 'rol' | 'plan') => {
    const ms = o.tarda?.[quien] ?? 0
    if (o.manual) return new Promise<void>((res) => { pendientes.push({ quien, soltar: res }) })
    return ms ? new Promise<void>((res) => setTimeout(res, ms)) : Promise.resolve()
  }
  const fetchSim = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    llamadas.push({ url: u, init, t: Date.now() - t0 })
    if (/auth\/v1\/user/.test(u)) {
      await esperar('auth')
      eventos.push('auth:fin')
      if (o.auth === 'cae') throw new Error('red caída')
      if (typeof o.auth === 'number') return new Response('{}', { status: o.auth })
      return new Response(JSON.stringify({ id: o.auth ?? YO }))
    }
    if (/rest\/v1\/usuarios_app/.test(u)) {
      await esperar('rol')
      eventos.push('rol:fin')
      return o.rol === null ? new Response('{}', { status: 404 }) : new Response(JSON.stringify([{ rol: o.rol ?? 'coach' }]))
    }
    if (/rest\/v1\/microciclos/.test(u)) {
      await esperar('plan')
      eventos.push('plan:fin')
      if (o.plan === 'cae') throw new Error('red caída')
      return new Response(JSON.stringify([{ id: 'm-1', numero: 12, estado: 'activo', datos: micro }]))
    }
    if (u.includes('api.anthropic.com')) {
      eventos.push('anthropic:inicio')
      return String(init?.body ?? '').includes('"tools"') ? new Response(JSON.stringify(registrador)) : new Response(JSON.stringify(lector))
    }
    return new Response('{}', { status: 404 })
  })
  const d: Dependencias = {
    entorno: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'sk-prueba-no-real' },
    fetch: fetchSim as unknown as typeof fetch,
    ahora: () => AHORA,
  }
  const aAnthropic = () => llamadas.filter((l) => l.url.includes('api.anthropic.com'))
  return { d, llamadas, eventos, pendientes, aAnthropic }
}
const post = (token: string, cuerpo: unknown = { frase: 'hice 4 series de sentadilla con 60' }) =>
  new Request('https://x.supabase.co/functions/v1/praxis-registro', {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
  })
const vaciar = () => new Promise<void>((res) => setTimeout(res, 0))

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('REGLA DURA · ninguna frase llega a Anthropic antes de que Auth Y el rol pasen', () => {
  it('(a) si Auth falla, Anthropic recibe 0 llamadas', async () => {
    for (const auth of [401, 500, 'cae'] as const) {
      const e = entorno({ auth })
      const r = await manejar(post(jwtDe(YO)), e.d)
      expect(r.status, String(auth)).toBe(401)
      expect(e.aAnthropic(), String(auth)).toHaveLength(0)
    }
  })

  it('(b) con rol asesorado, Anthropic recibe 0 llamadas (y 403)', async () => {
    const e = entorno({ rol: 'asesorado' })
    const r = await manejar(post(jwtDe(YO)), e.d)
    expect(r.status).toBe(403)
    expect(e.aAnthropic()).toHaveLength(0)
  })

  it('(b2) si no se puede leer el rol, se cierra igual: 403 y 0 llamadas', async () => {
    const e = entorno({ rol: null })
    const r = await manejar(post(jwtDe(YO)), e.d)
    expect(r.status).toBe(403)
    expect(e.aAnthropic()).toHaveLength(0)
  })

  it('(c) si el id de Auth no es el sub del token, 401 y 0 llamadas, aunque el rol sea de coach', async () => {
    const e = entorno({ auth: OTRA, rol: 'coach' })
    const r = await manejar(post(jwtDe(YO)), e.d)
    expect(r.status).toBe(401)
    expect(e.aAnthropic()).toHaveLength(0)
  })

  it('(c2) tampoco guarda nada por /guardar en ninguno de esos casos', async () => {
    for (const o of [{ auth: 401 }, { rol: 'asesorado' }, { auth: OTRA }] as Opciones[]) {
      const e = entorno(o)
      const r = await manejar(new Request('https://x.supabase.co/functions/v1/praxis-registro/guardar', {
        method: 'POST', headers: { authorization: `Bearer ${jwtDe(YO)}`, 'content-type': 'application/json' },
        body: JSON.stringify({ registros: [{ campo: 'adherencia', fecha: '2026-09-28', estado: 'si', confianza: 'alta' }] }),
      }), e.d)
      expect([401, 403]).toContain(r.status)
      expect(e.llamadas.filter((l) => l.init?.method === 'POST')).toHaveLength(0)
    }
  })

  it('si todo pasa, el modelo se llama DESPUÉS de que terminen Auth y el rol, nunca antes', async () => {
    const e = entorno({ tarda: { auth: 30, rol: 20, plan: 5 } })
    const r = await manejar(post(jwtDe(YO)), e.d)
    expect(r.status).toBe(200)
    const primera = e.eventos.indexOf('anthropic:inicio')
    expect(primera).toBeGreaterThan(-1)
    expect(e.eventos.indexOf('auth:fin')).toBeLessThan(primera)
    expect(e.eventos.indexOf('rol:fin')).toBeLessThan(primera)
  })

  it('un token que no se puede leer espera a Auth, como antes, y también cierra la puerta', async () => {
    for (const token of ['jwt-de-la-persona', 'a.b.c', `${b64u({ alg: 'x' })}.${b64u({ sub: 'u-1' })}.f`]) {
      const malo = entorno({ auth: 401 })
      expect((await manejar(post(token), malo.d)).status, token).toBe(401)
      expect(malo.llamadas.some((l) => l.url.includes('rest/v1/')), token).toBe(false) // sin sub no se adelanta nada
      expect(malo.aAnthropic()).toHaveLength(0)
      const asesorado = entorno({ rol: 'asesorado', auth: 'u-1' })
      expect((await manejar(post(token), asesorado.d)).status, token).toBe(403)
      expect(asesorado.aAnthropic()).toHaveLength(0)
      const bueno = entorno({ auth: 'u-1' })
      expect((await manejar(post(token), bueno.d)).status, token).toBe(200)
    }
  })
})

describe('las tres lecturas arrancan a la vez', () => {
  it('(d) Auth, rol y plan se piden antes de que termine la primera', async () => {
    const e = entorno({ manual: true })
    const respuesta = manejar(post(jwtDe(YO)), e.d)
    await vaciar()
    const urls = e.llamadas.map((l) => l.url)
    expect(urls.some((u) => u.includes('auth/v1/user'))).toBe(true)
    expect(urls.some((u) => u.includes('rest/v1/usuarios_app'))).toBe(true)
    expect(urls.some((u) => u.includes('rest/v1/microciclos'))).toBe(true)
    expect(e.eventos).toEqual([]) // y ninguna ha terminado
    expect(e.aAnthropic()).toHaveLength(0)
    e.pendientes.splice(0).forEach((p) => p.soltar())
    expect((await respuesta).status).toBe(200)
  })

  it('(d2) con los retrasos medidos en producción, la primera llamada al modelo sale a los 700 ms, no a los 1 400', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const e = entorno({ tarda: { auth: 700, rol: 400, plan: 300 } })
    const respuesta = manejar(post(jwtDe(YO)), e.d)
    await vi.advanceTimersByTimeAsync(2000)
    expect((await respuesta).status).toBe(200)
    const primera = e.aAnthropic()[0]
    expect(primera.t).toBe(700) // lo que tarda lo más lento de los tres
    // Antes: 700 (Auth) + 400 (rol) = 1 100 ms para llegar al modelo, y el plan después de eso.
  })

  it('el rol y el plan se piden con el JWT de la persona y por el sub del token', async () => {
    const e = entorno()
    const token = jwtDe(YO)
    await manejar(post(token), e.d)
    const rol = e.llamadas.find((l) => l.url.includes('rest/v1/usuarios_app'))!
    const plan = e.llamadas.find((l) => l.url.includes('rest/v1/microciclos'))!
    expect(rol.url).toContain(`id=eq.${YO}`)
    expect(plan.url).toContain(`usuario_id=eq.${YO}`)
    expect((rol.init!.headers as Record<string, string>).authorization).toBe(`Bearer ${token}`)
    expect((plan.init!.headers as Record<string, string>).authorization).toBe(`Bearer ${token}`)
  })

  it('si Auth se cae antes de que el plan termine y el plan también falla, no queda una promesa suelta', async () => {
    const sueltas: unknown[] = []
    const alSuelta = (m: unknown) => { sueltas.push(m) }
    process.on('unhandledRejection', alSuelta)
    try {
      const e = entorno({ auth: 401, plan: 'cae', tarda: { plan: 15 } })
      expect((await manejar(post(jwtDe(YO)), e.d)).status).toBe(401)
      await new Promise((res) => setTimeout(res, 60))
      expect(sueltas).toEqual([])
    } finally { process.off('unhandledRejection', alSuelta) }
  })

  it('se mantienen los cronómetros: tiempos-sesion con auth, rol y plan, y tiempos con riesgo, registro y total', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const e = entorno({ tarda: { auth: 10, rol: 5, plan: 5 } })
    const c = await (await manejar(post(jwtDe(YO)), e.d)).json()
    expect(Object.keys(c.meta.tiempos_ms).sort()).toEqual(['plan', 'registro', 'riesgo', 'total'])
    const sesion = log.mock.calls.map((x) => String(x[0]) + ' ' + String(x[1])).find((l) => l.includes('tiempos-sesion'))!
    const t = JSON.parse(sesion.slice(sesion.indexOf('{')))
    expect(Object.keys(t).sort()).toEqual(['auth', 'plan', 'rol'])
  })

  it('el filtro de riesgo sigue antes del modelo: una frase de vida no llama a nadie', async () => {
    const e = entorno()
    const c = await (await manejar(post(jwtDe(YO), { frase: 'ya no quiero vivir' }), e.d)).json()
    expect(c.propuesta.riesgo).toEqual({ tipo: 'quieta', linea: 'vida' })
    expect(e.aAnthropic()).toHaveLength(0)
  })
})

describe('subDelJwt', () => {
  it('lee el sub de un token con la forma de verdad', () => {
    expect(subDelJwt(jwtDe(YO))).toBe(YO)
  })
  it('lo que no es un token legible con un uuid no vale', () => {
    for (const t of ['', 'jwt', 'a.b', 'a.b.c', `${b64u({})}.${b64u({})}.f`, `x.${b64u({ sub: 'u-1' })}.f`, `x.${b64u({ sub: 5 })}.f`, `x.${b64u({ sub: `${YO}&select=*` })}.f`, 'x.@@@.f']) {
      expect(subDelJwt(t), t).toBeNull()
    }
  })
})
