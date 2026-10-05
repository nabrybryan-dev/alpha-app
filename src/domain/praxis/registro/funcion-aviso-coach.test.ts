// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manejar, type Dependencias } from '../../../../supabase/functions/praxis-registro/index.ts'
import { PROMPT_RIESGO } from '../riesgoModelo.ts'
import { PROMPT_SISTEMA_INGRESO } from '../ingreso/extraer.ts'

/**
 * El aviso al coach (migración 0108): cuando Praxis detecta una señal de riesgo, la función deja UNA fila
 * con quién, por dónde llegó y el tipo de señal, con el JWT de la persona. Garantías que no pueden
 * romperse en silencio:
 *
 *   - hay riesgo (diccionario, lector con modelo, o ingreso) → exactamente 1 insert, con los tres campos;
 *   - NUNCA lleva la frase: ni en el cuerpo, ni en las cabeceras, ni en el log;
 *   - sin riesgo → 0 inserts;
 *   - si el insert falla (tabla sin migrar, red, tiempo) la respuesta a la persona es LA MISMA y se anota
 *     «aviso no guardado» sin datos personales.
 */
const AHORA = new Date('2026-10-03T15:00:00Z')
const USUARIO = 'u-aviso-1'
const lector = (nivel: string) => ({ content: [{ type: 'text', text: JSON.stringify({ nivel, cita: '', por_que: 'prueba' }) }] })
const registrador = { content: [{ type: 'tool_use', name: 'registrar', input: { intencion: ['charla'], entreno: [], comida: null, vida: null, sesion: null, correccion: null, aclaracion: null, clinico: { hay: false, cita: null }, fuera_de_alcance: true } }], usage: { input_tokens: 1800, output_tokens: 220 } }
const extraccion = (campos: Record<string, unknown>, salud: unknown[] = []) => ({
  content: [{ type: 'text', text: JSON.stringify({ campos, salud }) }],
  usage: { input_tokens: 900, output_tokens: 80 },
})

type ComoFallaElAviso = 'bien' | 'http-500' | 'tabla-sin-migrar' | 'red' | 'tiempo'

interface Opciones {
  riesgo?: unknown
  ingreso?: unknown
  aviso?: ComoFallaElAviso
}

function entorno(o: Opciones = {}) {
  const llamadas: { url: string; init?: RequestInit }[] = []
  const fetchSim = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    llamadas.push({ url: u, init })
    if (/auth\/v1\/user/.test(u)) return new Response(JSON.stringify({ id: USUARIO }))
    if (/rest\/v1\/usuarios_app/.test(u)) return new Response(JSON.stringify([{ rol: 'coach' }]))
    if (/rest\/v1\/microciclos/.test(u)) return new Response('[]')
    if (/rest\/v1\/praxis_avisos_coach/.test(u)) {
      switch (o.aviso ?? 'bien') {
        case 'http-500': return new Response(JSON.stringify({ code: 'XX000', message: 'detalle con me quiero morir' }), { status: 500 })
        case 'tabla-sin-migrar': return new Response(JSON.stringify({ code: 'PGRST205', message: 'Could not find the table' }), { status: 404 })
        case 'red': throw new TypeError('fetch failed')
        case 'tiempo': throw new DOMException('The operation timed out', 'TimeoutError')
        default: return new Response(null, { status: 201 })
      }
    }
    if (u.includes('api.anthropic.com')) {
      const cuerpo = JSON.parse(String(init?.body ?? '{}')) as { system?: { text: string }[]; tools?: unknown }
      const sistema = cuerpo.system?.[0]?.text
      if (sistema === PROMPT_RIESGO) return new Response(JSON.stringify(o.riesgo ?? lector('NINGUNO')))
      if (sistema === PROMPT_SISTEMA_INGRESO) return new Response(JSON.stringify(o.ingreso ?? extraccion({})))
      return new Response(JSON.stringify(registrador))
    }
    return new Response('{}', { status: 404 })
  })
  const d: Dependencias = {
    entorno: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'sk-prueba-no-real' },
    fetch: fetchSim as unknown as typeof fetch,
    ahora: () => AHORA,
  }
  const avisos = () => llamadas.filter((l) => /rest\/v1\/praxis_avisos_coach/.test(l.url))
  return { d, llamadas, avisos }
}

const post = (cuerpo: unknown) =>
  new Request('https://x.supabase.co/functions/v1/praxis-registro', {
    method: 'POST', headers: { authorization: 'Bearer jwt-de-la-persona', 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
  })
const frase = (f: string, extra: Record<string, unknown> = {}) => post({ frase: f, ...extra })
const ingreso = (texto: string, extra: Record<string, unknown> = {}) => post({ accion: 'ingreso', turno: 'sobre_ti', texto, ...extra })

const cuerpoDe = (l: { init?: RequestInit }) => JSON.parse(String(l.init?.body)) as Record<string, unknown>

afterEach(() => vi.restoreAllMocks())

describe('el registro de Praxis: una señal de riesgo deja UN aviso, sin la frase', () => {
  it('el diccionario detiene la frase: 1 insert con la persona, el origen y el tipo, y nada más', async () => {
    const e = entorno()
    const r = await manejar(frase('ya no quiero vivir'), e.d)
    expect(r.status).toBe(200)
    expect((await r.json()).meta.aviso_bryan).toBe(true)
    expect(e.avisos()).toHaveLength(1)
    const [a] = e.avisos()
    expect(a.init?.method).toBe('POST')
    expect(cuerpoDe(a)).toEqual({ usuario_id: USUARIO, origen: 'praxis', nivel: 'vida' })
  })

  it('va con el JWT de la persona (la RLS decide), nunca con otra credencial', async () => {
    const e = entorno()
    await manejar(frase('ya no quiero vivir'), e.d)
    const h = new Headers(e.avisos()[0].init?.headers)
    expect(h.get('authorization')).toBe('Bearer jwt-de-la-persona')
    expect(h.get('apikey')).toBe('anon')
    expect(h.get('prefer')).toBe('return=minimal')
  })

  it('la persona del aviso sale de la sesión validada, no de lo que diga el cuerpo de la petición', async () => {
    const e = entorno()
    await manejar(frase('ya no quiero vivir', { usuario_id: 'u-otra-persona', nivel: 'salud', origen: 'ingreso' }), e.d)
    expect(cuerpoDe(e.avisos()[0])).toEqual({ usuario_id: USUARIO, origen: 'praxis', nivel: 'vida' })
  })

  it('NUNCA lleva la frase: ni en el cuerpo ni en las cabeceras ni en la dirección', async () => {
    const e = entorno()
    const f = 'ya no quiero vivir'
    await manejar(frase(f), e.d)
    const [a] = e.avisos()
    expect(JSON.stringify(a)).not.toContain(f)
    expect(Object.keys(cuerpoDe(a)).sort()).toEqual(['nivel', 'origen', 'usuario_id'])
  })

  it.each([
    ['RIESGO_VIDA', 'vida'],
    ['URGENTE_FISICO', 'vida'],
    ['RIESGO_VIOLENCIA', 'pareja'],
    ['RIESGO_MENOR', 'nino'],
    ['AMBIGUO_VIDA', 'cuidado'],
    ['PREGUNTAR_ANTES_DE_ENTRENAR', 'salud'],
    ['DERIVAR', 'salud'],
  ])('el lector con modelo ve %s: 1 insert de tipo «%s»', async (nivelModelo, nivelAviso) => {
    const e = entorno({ riesgo: lector(nivelModelo) })
    const r = await manejar(frase('hoy ni ganas, esta lluvia me tiene mal'), e.d)
    expect((await r.json()).meta.aviso_bryan).toBe(true)
    expect(e.avisos()).toHaveLength(1)
    expect(cuerpoDe(e.avisos()[0])).toEqual({ usuario_id: USUARIO, origen: 'praxis', nivel: nivelAviso })
  })

  it('el diccionario por línea: pareja, un menor, una frase ambigua y una señal de salud se distinguen', async () => {
    const casos: [string, string][] = [
      ['mi esposo me pega', 'pareja'],
      ['le pegan a mi hijo en el colegio', 'nino'],
      ['me dieron ganas de morirme cuando vi los burpees', 'cuidado'],
      ['me duele la rodilla izquierda', 'salud'],
    ]
    for (const [f, nivel] of casos) {
      const e = entorno()
      const r = await manejar(frase(f), e.d)
      expect((await r.json()).meta.aviso_bryan, f).toBe(true)
      expect(cuerpoDe(e.avisos()[0]).nivel, f).toBe(nivel)
    }
  })

  it('sin riesgo (NINGUNO y el registro normal): 0 inserts', async () => {
    const e = entorno({ riesgo: lector('NINGUNO') })
    const r = await manejar(frase('hice 4 series de sentadilla con 60'), e.d)
    expect((await r.json()).meta.derivada).toBe(false)
    expect(e.avisos()).toHaveLength(0)
  })

  it('sin lectura de riesgo (502) tampoco se avisa: no hay señal que avisar', async () => {
    const e = entorno({ riesgo: { content: [{ type: 'text', text: 'no sé' }] } })
    const r = await manejar(frase('hice 4 series'), e.d)
    expect(r.status).toBe(502)
    expect(e.avisos()).toHaveLength(0)
  })

  it('una petición rechazada antes de llegar a Praxis (frase vacía, o larga) no avisa', async () => {
    const e = entorno()
    expect((await manejar(frase('   '), e.d)).status).toBe(400)
    expect((await manejar(frase('x'.repeat(700)), e.d)).status).toBe(400)
    expect(e.avisos()).toHaveLength(0)
  })
})

describe('si el aviso no se puede guardar, a la persona no le cambia nada', () => {
  const FRASE = 'ya no quiero vivir'
  const comoFalla: ComoFallaElAviso[] = ['http-500', 'tabla-sin-migrar', 'red', 'tiempo']

  it.each(comoFalla)('con el insert «%s» la respuesta es idéntica a la de cuando se guarda', async (falla) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const bien = entorno({ aviso: 'bien' })
    const mal = entorno({ aviso: falla })
    const rBien = await manejar(frase(FRASE), bien.d)
    const rMal = await manejar(frase(FRASE), mal.d)
    expect(rMal.status).toBe(rBien.status)
    expect(await rMal.json()).toEqual(await rBien.json())
    expect(mal.avisos()).toHaveLength(1)
  })

  it.each(comoFalla)('con el insert «%s» lo anota «aviso no guardado», sin la frase ni el cuerpo del error', async (falla) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const e = entorno({ aviso: falla })
    await manejar(frase(FRASE), e.d)
    const lineas = JSON.stringify(log.mock.calls)
    expect(lineas).toContain('praxis-registro: aviso no guardado')
    expect(lineas).not.toContain(FRASE)
    expect(lineas).not.toContain('me quiero morir') // el cuerpo del error de la base puede citar valores
    expect(lineas).not.toContain(USUARIO)
  })

  it('con el aviso guardado no hay nada que anotar', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await manejar(frase(FRASE), entorno().d)
    expect(JSON.stringify(log.mock.calls)).not.toContain('aviso no guardado')
  })

  it('también por la ruta del lector con modelo', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const rBien = await (await manejar(frase('frase'), entorno({ riesgo: lector('RIESGO_VIDA') }).d)).json()
    const rMal = await (await manejar(frase('frase'), entorno({ riesgo: lector('RIESGO_VIDA'), aviso: 'red' }).d)).json()
    expect(rMal).toEqual(rBien)
  })
})

describe('el ingreso por voz: riesgo o salud también avisan', () => {
  it('el diccionario detiene el turno: 1 insert de origen «ingreso» y la respuesta no cambia', async () => {
    const e = entorno()
    const r = await manejar(ingreso('a veces pienso en quitarme la vida'), e.d)
    const cuerpo = await r.json()
    expect(cuerpo.derivada).toBe(true)
    expect(e.avisos()).toHaveLength(1)
    expect(cuerpoDe(e.avisos()[0])).toEqual({ usuario_id: USUARIO, origen: 'ingreso', nivel: 'vida' })
    const sinAviso = await (await manejar(ingreso('a veces pienso en quitarme la vida'), entorno({ aviso: 'red' }).d)).json()
    expect(sinAviso).toEqual(cuerpo)
  })

  it('el lector con modelo ve riesgo en el ingreso: 1 insert', async () => {
    const e = entorno({ riesgo: lector('RIESGO_VIOLENCIA') })
    const cuerpo = await (await manejar(ingreso('en mi casa las cosas están difíciles'), e.d)).json()
    expect(cuerpo.derivada).toBe(true)
    expect(cuerpoDe(e.avisos()[0])).toEqual({ usuario_id: USUARIO, origen: 'ingreso', nivel: 'pareja' })
  })

  it('un turno con salud (el modelo la marca): 1 insert de tipo «salud» y la respuesta lleva el tema, no la frase', async () => {
    const dicho = 'me operaron del menisco hace un año'
    const e = entorno({ ingreso: extraccion({}, [{ tema: 'lesion', cita: dicho }]) })
    const cuerpo = await (await manejar(ingreso(dicho), e.d)).json()
    expect(cuerpo.derivada).toBe(false)
    expect(cuerpo.temas).toContain('lesion')
    expect(e.avisos()).toHaveLength(1)
    expect(cuerpoDe(e.avisos()[0])).toEqual({ usuario_id: USUARIO, origen: 'ingreso', nivel: 'salud' })
    expect(JSON.stringify(e.avisos()[0])).not.toContain(dicho)
  })

  it('un turno limpio (sin riesgo ni salud): 0 inserts', async () => {
    const e = entorno({ ingreso: extraccion({}) })
    const cuerpo = await (await manejar(ingreso('soy de Cali y tengo veintiocho años'), e.d)).json()
    expect(cuerpo.derivada).toBe(false)
    expect(cuerpo.temas).toEqual([])
    expect(e.avisos()).toHaveLength(0)
  })

  it('si el insert falla en un turno con salud, el turno sale igual', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const dicho = 'me operaron del menisco hace un año'
    const bien = await (await manejar(ingreso(dicho), entorno({ ingreso: extraccion({}, [{ tema: 'lesion', cita: dicho }]) }).d)).json()
    const mal = await (await manejar(ingreso(dicho), entorno({ ingreso: extraccion({}, [{ tema: 'lesion', cita: dicho }]), aviso: 'http-500' }).d)).json()
    expect(mal.meta.latencia_ms).toBeDefined()
    // La latencia y los tiempos son del reloj; el resto es lo que ve la persona.
    const sinReloj = (c: { meta: Record<string, unknown> }) => ({ ...c, meta: { ...c.meta, latencia_ms: 0, tiempos_ms: 0 } })
    expect(sinReloj(mal)).toEqual(sinReloj(bien))
  })
})
