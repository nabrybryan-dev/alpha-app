// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manejar, type Dependencias } from '../../../../supabase/functions/praxis-registro/index.ts'
import type { MicrocicloJson } from './contexto.ts'
import { PROMPT_RIESGO } from '../riesgoModelo.ts'

/**
 * El lector de riesgo con modelo dentro de la Edge Function: cada frase que el diccionario deja
 * pasar la lee también Haiku con el prompt medido, y gana la lectura más grave. Si esa lectura
 * falla, la función NO sigue sin cribado.
 */
const AHORA = new Date('2026-10-02T15:00:00Z')
const micro: MicrocicloJson = {
  id: 'm-1', numero: 12, cadenciaDias: 7, fechaInicio: '2026-09-28',
  sesiones: [{ id: 'S1', nombre: 'PIERNA', dia: 'LUNES', ejercicios: [{ id: 'pa1', nombre: 'SENTADILLA TRASERA', sets: 4, rango: '8-12', unidadCarga: 'kg', series: [] }] }],
}
const registrador = { content: [{ type: 'tool_use', name: 'registrar', input: { intencion: ['charla'], entreno: [], comida: null, vida: null, sesion: null, correccion: null, aclaracion: null, clinico: { hay: false, cita: null }, fuera_de_alcance: true } }], usage: { input_tokens: 1800, output_tokens: 220 } }
const lector = (nivel: string) => ({ content: [{ type: 'text', text: JSON.stringify({ nivel, cita: '', por_que: 'prueba' }) }] })

function entorno(riesgo: { cuerpo: unknown; status?: number }) {
  const llamadas: { url: string; init?: RequestInit }[] = []
  const fetchSim = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    llamadas.push({ url: u, init })
    if (/auth\/v1\/user/.test(u)) return new Response(JSON.stringify({ id: 'u-1' }))
    if (/rest\/v1\/usuarios_app/.test(u)) return new Response(JSON.stringify([{ rol: 'coach' }]))
    if (/rest\/v1\/microciclos/.test(u)) return new Response(JSON.stringify([{ id: 'm-1', numero: 12, estado: 'activo', datos: micro }]))
    if (u.includes('api.anthropic.com')) {
      const esRegistrador = String(init?.body ?? '').includes('"tools"')
      return esRegistrador
        ? new Response(JSON.stringify(registrador))
        : new Response(JSON.stringify(riesgo.cuerpo), { status: riesgo.status ?? 200 })
    }
    return new Response('{}', { status: 404 })
  })
  const d: Dependencias = {
    entorno: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'sk-prueba-no-real' },
    fetch: fetchSim as unknown as typeof fetch,
    ahora: () => AHORA,
  }
  const alLector = () => llamadas.filter((l) => l.url.includes('api.anthropic.com') && !String(l.init?.body ?? '').includes('"tools"'))
  return { d, llamadas, alLector }
}
const post = (frase: string) =>
  new Request('https://x.supabase.co/functions/v1/praxis-registro', {
    method: 'POST', headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' }, body: JSON.stringify({ frase }),
  })

afterEach(() => vi.restoreAllMocks())

describe('el modelo lee lo que el diccionario deja pasar', () => {
  it('si el modelo ve riesgo de vida, Praxis se detiene con la línea de vida aunque el diccionario no lo viera', async () => {
    const e = entorno({ cuerpo: lector('RIESGO_VIDA') })
    const r = await manejar(post('hoy ni ganas, esta lluvia me tiene mal'), e.d)
    const cuerpo = await r.json()
    expect(r.status).toBe(200)
    expect(cuerpo.propuesta.accion).toBe('derivar')
    expect(cuerpo.propuesta.riesgo).toEqual({ tipo: 'quieta', linea: 'vida' })
    expect(cuerpo.meta.lector_riesgo).toBe('RIESGO_VIDA')
    expect(cuerpo.meta.aviso_bryan).toBe(true)
  })
  it('violencia → la línea de pareja; un menor → la del ICBF', async () => {
    const v = await (await manejar(post('frase'), entorno({ cuerpo: lector('RIESGO_VIOLENCIA') }).d)).json()
    expect(v.propuesta.riesgo).toEqual({ tipo: 'quieta', linea: 'pareja' })
    const m = await (await manejar(post('frase'), entorno({ cuerpo: lector('RIESGO_MENOR') }).d)).json()
    expect(m.propuesta.riesgo).toEqual({ tipo: 'quieta', linea: 'nino' })
  })
  it('«antes de entrenar» va por salud y nunca por la pregunta de riesgo de vida', async () => {
    const c = await (await manejar(post('se me cayó la mancuerna en el pie'), entorno({ cuerpo: lector('PREGUNTAR_ANTES_DE_ENTRENAR') }).d)).json()
    expect(c.propuesta.accion).toBe('derivar')
    expect(c.propuesta.riesgo).toBeUndefined()
    expect(c.propuesta.filtro).toBe('sintoma')
  })
  it('si el modelo dice NINGUNO, sigue el registro normal', async () => {
    const c = await (await manejar(post('hice 4 series de sentadilla con 60'), entorno({ cuerpo: lector('NINGUNO') }).d)).json()
    expect(c.meta.derivada).toBe(false)
    expect(c.meta.lector_riesgo).toBeUndefined()
  })
})

describe('sin lectura de riesgo no se sigue', () => {
  it('una respuesta ilegible del lector → 502 «inténtalo de nuevo», nunca NINGUNO', async () => {
    const r = await manejar(post('hice 4 series'), entorno({ cuerpo: { content: [{ type: 'text', text: 'no sé' }] } }).d)
    expect(r.status).toBe(502)
    expect((await r.json()).reintentable).toBe(true)
  })
  it('si Anthropic falla en el lector → 502, y el log no lleva la frase', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const frase = 'me siento rara hoy con todo'
    const r = await manejar(post(frase), entorno({ cuerpo: { type: 'error', error: { message: `fallo con ${frase}` } }, status: 500 }).d)
    expect(r.status).toBe(502)
    expect(JSON.stringify(log.mock.calls)).not.toContain(frase)
  })
})

describe('la petición al lector es la que se midió', () => {
  it('lleva el prompt medido, sin herramientas, temperatura 0 y la frase sola', async () => {
    const e = entorno({ cuerpo: lector('NINGUNO') })
    await manejar(post('hice 4 series'), e.d)
    const llamadas = e.alLector()
    expect(llamadas).toHaveLength(1)
    const cuerpo = JSON.parse(String(llamadas[0].init?.body))
    expect(cuerpo.system[0].text).toBe(PROMPT_RIESGO)
    expect(cuerpo.tools).toBeUndefined()
    expect(cuerpo.temperature).toBe(0)
    expect(cuerpo.messages).toEqual([{ role: 'user', content: 'hice 4 series' }])
  })
  it('una frase que el diccionario ya detiene no gasta la llamada del lector', async () => {
    const e = entorno({ cuerpo: lector('NINGUNO') })
    const c = await (await manejar(post('ya no quiero vivir'), e.d)).json()
    expect(c.propuesta.riesgo).toEqual({ tipo: 'quieta', linea: 'vida' })
    expect(e.alLector()).toHaveLength(0)
  })
})

describe('el cronómetro de cada mensaje (Bryan, 2-oct: «se queda cargando»)', () => {
  it('anota cuánto tardó cada paso y lo deja en el registro sin la frase de la persona', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const frase = 'hice 4 series de peso muerto con 80'
    const c = await (await manejar(post(frase), entorno({ cuerpo: lector('NINGUNO') }).d)).json()
    expect(Object.keys(c.meta.tiempos_ms).sort()).toEqual(['plan', 'registro', 'riesgo', 'total'])
    const lineas = JSON.stringify(log.mock.calls)
    expect(lineas).toContain('praxis-registro: tiempos')
    expect(lineas).toContain('praxis-registro: tiempos-sesion')
    expect(lineas).not.toContain(frase)
  })
})
