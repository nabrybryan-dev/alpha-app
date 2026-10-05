// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manejar, type Dependencias } from '../../../../supabase/functions/praxis-registro/index.ts'
import { PROMPT_RIESGO } from '../riesgoModelo.ts'
import { PROMPT_SISTEMA_INGRESO, armarMensajeIngreso } from './extraer.ts'

/**
 * `accion: 'ingreso'` de la Edge Function `praxis-registro` (prueba interna del cuestionario de ingreso por voz,
 * 3-oct-2026). Cada bloque es una garantía de seguridad que NO puede romperse en silencio:
 *
 *   - un asesorado (o una cuenta sin rol conocido) no llega a ningún modelo: 0 llamadas;
 *   - una frase de riesgo o de salud no se extrae: la detiene el filtro ANTES de Haiku;
 *   - un valor sin cita literal se descarta;
 *   - un campo de salud no sale jamás de aquí, ni su frase;
 *   - nada se guarda y los registros de tiempos no llevan el texto.
 */
const AHORA = new Date('2026-10-03T15:00:00Z')

const extraccion = (campos: Record<string, unknown>, salud: unknown[] = []) => ({
  content: [{ type: 'text', text: JSON.stringify({ campos, salud }) }],
  usage: { input_tokens: 900, output_tokens: 80 },
})
const lector = (nivel: string) => ({ content: [{ type: 'text', text: JSON.stringify({ nivel, cita: '', por_que: 'prueba' }) }] })
const cita = (c: string, opcion: string | null = null) => ({ cita: c, opcion })

interface Opciones {
  rol?: string | null
  usuario?: string
  ingreso?: unknown
  riesgo?: unknown
  statusIngreso?: number
}

let contador = 0
function entorno(o: Opciones = {}) {
  const usuario = o.usuario ?? `u-ingreso-${++contador}`
  const rol = o.rol === undefined ? 'coach' : o.rol
  const llamadas: { url: string; init?: RequestInit }[] = []
  const fetchSim = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    llamadas.push({ url: u, init })
    if (/auth\/v1\/user/.test(u)) return new Response(JSON.stringify({ id: usuario }))
    if (/rest\/v1\/usuarios_app/.test(u)) return new Response(JSON.stringify(rol ? [{ rol }] : []))
    if (u.includes('api.anthropic.com')) {
      const sistema = (JSON.parse(String(init?.body ?? '{}')) as { system?: { text: string }[] }).system?.[0]?.text
      if (sistema === PROMPT_RIESGO) return new Response(JSON.stringify(o.riesgo ?? lector('NINGUNO')))
      if (sistema === PROMPT_SISTEMA_INGRESO) return new Response(JSON.stringify(o.ingreso ?? extraccion({})), { status: o.statusIngreso ?? 200 })
    }
    return new Response('{}', { status: 404 })
  })
  const d: Dependencias = {
    entorno: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'sk-prueba-no-real' },
    fetch: fetchSim as unknown as typeof fetch,
    ahora: () => AHORA,
  }
  const aAnthropic = () => llamadas.filter((l) => l.url.includes('api.anthropic.com'))
  const alExtractor = () => aAnthropic().filter((l) => (JSON.parse(String(l.init?.body)) as { system: { text: string }[] }).system[0].text === PROMPT_SISTEMA_INGRESO)
  const alLector = () => aAnthropic().filter((l) => (JSON.parse(String(l.init?.body)) as { system: { text: string }[] }).system[0].text === PROMPT_RIESGO)
  const escrituras = () => llamadas.filter((l) => l.init?.method === 'POST' && l.url.includes('supabase.co'))
  return { d, llamadas, aAnthropic, alExtractor, alLector, escrituras }
}

const post = (cuerpo: unknown, token: string | null = 'jwt') =>
  new Request('https://x.supabase.co/functions/v1/praxis-registro', {
    method: 'POST',
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
const ingreso = (turno: string, texto: string) => post({ accion: 'ingreso', turno, texto })

afterEach(() => vi.restoreAllMocks())

describe('quién puede usar el ingreso: el equipo, y nada llega a un modelo antes', () => {
  it('un asesorado recibe 403 y su texto no llega a NINGÚN modelo (0 llamadas)', async () => {
    const e = entorno({ rol: 'asesorado' })
    const r = await manejar(ingreso('sobre_ti', 'soy de Cali y tengo 28 años'), e.d)
    expect(r.status).toBe(403)
    expect(e.aAnthropic()).toHaveLength(0)
  })

  it('si no se puede saber el rol, se cierra: 403 y 0 llamadas al modelo', async () => {
    const e = entorno({ rol: null })
    const r = await manejar(ingreso('sobre_ti', 'soy de Cali'), e.d)
    expect(r.status).toBe(403)
    expect(e.aAnthropic()).toHaveLength(0)
  })

  it('sin sesión: 401 y 0 llamadas', async () => {
    const e = entorno()
    const r = await manejar(post({ accion: 'ingreso', turno: 'sobre_ti', texto: 'hola' }, null), e.d)
    expect(r.status).toBe(401)
    expect(e.llamadas).toHaveLength(0)
  })

  it.each(['coach', 'nutricionista'])('%s sí pasa', async (rol) => {
    const e = entorno({ rol, ingreso: extraccion({ ciudad: cita('Cali') }) })
    const r = await manejar(ingreso('sobre_ti', 'Soy de Cali, tengo veintiocho años'), e.d)
    expect(r.status).toBe(200)
  })

  it('no lee el plan de nadie ni escribe nada: ni una sola lectura de microciclos ni una escritura', async () => {
    const e = entorno({ ingreso: extraccion({ ciudad: cita('Cali') }) })
    await manejar(ingreso('sobre_ti', 'Soy de Cali'), e.d)
    expect(e.llamadas.filter((l) => /microciclos/.test(l.url))).toHaveLength(0)
    expect(e.escrituras()).toHaveLength(0)
  })
})

describe('el filtro de riesgo corre ANTES del modelo', () => {
  it.each([
    ['ya no quiero vivir', 'vida'],
    ['mi novio me pega', 'pareja'],
  ])('«%s»: se deriva (Quieta, línea %s), 0 extracciones y 0 lectores', async (texto, linea) => {
    const e = entorno({ ingreso: extraccion({ ciudad: cita('Cali') }) })
    const cuerpo = await (await manejar(ingreso('objetivo', texto), e.d)).json()
    expect(cuerpo.derivada).toBe(true)
    expect(cuerpo.derivacion.riesgo).toEqual({ tipo: 'quieta', linea })
    expect(cuerpo.campos).toBeUndefined()
    expect(e.alExtractor()).toHaveLength(0)
    expect(e.alLector()).toHaveLength(0)
  })

  it('una frase ambigua se detiene como pregunta de cuidado, sin extraer', async () => {
    const e = entorno()
    const cuerpo = await (await manejar(ingreso('objetivo', 'ya no aguanto más con todo'), e.d)).json()
    expect(cuerpo.derivacion.riesgo).toEqual({ tipo: 'cuidado' })
    expect(e.aAnthropic()).toHaveLength(0)
  })

  it('una mención de salud («me duele la rodilla») tampoco se extrae: la detiene el filtro y no hay llamada al modelo', async () => {
    const e = entorno({ ingreso: extraccion({ ciudad: cita('Cali') }) })
    const cuerpo = await (await manejar(ingreso('historia_entreno', 'llevo dos años entrenando pero me duele la rodilla'), e.d)).json()
    expect(cuerpo.derivada).toBe(true)
    expect(cuerpo.derivacion.filtro).toBe('dolor')
    expect(cuerpo.derivacion.riesgo).toBeNull()
    expect(cuerpo.campos).toBeUndefined()
    expect(e.aAnthropic()).toHaveLength(0)
  })

  it('la derivación no devuelve la palabra que disparó ni notas para el coach', async () => {
    const e = entorno()
    const texto = await (await manejar(ingreso('objetivo', 'ya no quiero vivir'), e.d)).text()
    expect(texto).not.toContain('vivir')
    expect(texto).not.toContain('notas_coach')
  })

  it('si el diccionario no ve nada pero el lector con modelo ve riesgo de vida, se deriva y la extracción se descarta', async () => {
    const e = entorno({ riesgo: lector('RIESGO_VIDA'), ingreso: extraccion({ ciudad: cita('Cali') }) })
    const cuerpo = await (await manejar(ingreso('sobre_ti', 'hoy ni ganas, soy de Cali'), e.d)).json()
    expect(cuerpo.derivada).toBe(true)
    expect(cuerpo.derivacion.riesgo).toEqual({ tipo: 'quieta', linea: 'vida' })
    expect(cuerpo.campos).toBeUndefined()
  })

  it('sin lectura de riesgo no se sigue: 502 reintentable, nunca NINGUNO', async () => {
    const e = entorno({ riesgo: { content: [{ type: 'text', text: 'no sé' }] }, ingreso: extraccion({ ciudad: cita('Cali') }) })
    const r = await manejar(ingreso('sobre_ti', 'Soy de Cali'), e.d)
    expect(r.status).toBe(502)
    expect((await r.json()).reintentable).toBe(true)
  })
})

describe('un valor sin cita literal se descarta', () => {
  const TEXTO = 'Soy de Cali, tengo veintiocho años y mido uno setenta'

  it('sin cita o con una cita que no está en lo dicho: el campo no sale', async () => {
    const e = entorno({
      ingreso: extraccion({
        ciudad: cita('Cali'), // buena
        edad: { cita: null, opcion: null, valor: 28 }, // sin cita
        altura_cm: cita('uno ochenta y cinco'), // la cita no está en la frase
        peso_actual_kg: cita('82 kilos'), // tampoco
      }),
    })
    const cuerpo = await (await manejar(ingreso('sobre_ti', TEXTO), e.d)).json()
    expect(cuerpo.campos).toEqual({ ciudad: 'Cali' })
    const motivos = Object.fromEntries(cuerpo.descartados.map((x: { campo: string; motivo: string }) => [x.campo, x.motivo]))
    expect(motivos).toEqual({ edad: 'sin_cita', altura_cm: 'cita_invalida', peso_actual_kg: 'cita_invalida' })
  })

  it('los números los convierte el código a partir de la cita, no el modelo', async () => {
    const e = entorno({ ingreso: extraccion({ edad: { cita: 'veintiocho años', opcion: null, valor: 99 }, altura_cm: cita('uno setenta') }) })
    const cuerpo = await (await manejar(ingreso('sobre_ti', TEXTO), e.d)).json()
    expect(cuerpo.campos).toEqual({ edad: 28, altura_cm: 170 })
  })

  it('un campo de otro turno no se acepta', async () => {
    const e = entorno({ ingreso: extraccion({ tipo_trabajo: cita('Cali', 'teletrabajo') }) })
    const cuerpo = await (await manejar(ingreso('sobre_ti', TEXTO), e.d)).json()
    expect(cuerpo.campos).toEqual({})
    expect(cuerpo.descartados).toEqual([{ campo: 'tipo_trabajo', motivo: 'fuera_de_turno' }])
  })

  it('«no sé»: el modelo no pone el campo y la respuesta lo deja vacío (nunca un valor)', async () => {
    const e = entorno({ ingreso: extraccion({}) })
    const cuerpo = await (await manejar(ingreso('historia_entreno', 'no sé a qué peso llegar, dos años, no sé en qué nivel'), e.d)).json()
    expect(cuerpo.campos).toEqual({})
  })
})

describe('la salud NO sale de aquí', () => {
  const TEXTO = 'Quiero ganar músculo, y tuve un rollo con el manguito rotador del hombro derecho'

  it('un campo de salud que el modelo se invente no sale, y la frase que lo dijo tampoco', async () => {
    const e = entorno({
      ingreso: extraccion(
        { objetivo_principal: cita('ganar músculo', 'Hipertrofia / estética'), lesiones: cita('manguito rotador del hombro derecho', 'Sí'), parq_huesos_articulaciones: cita('un rollo con el manguito', 'Sí') },
        [{ tema: 'lesion', cita: 'tuve un rollo con el manguito rotador del hombro derecho' }],
      ),
    })
    const r = await manejar(ingreso('objetivo', TEXTO), e.d)
    const texto = await r.text()
    const cuerpo = JSON.parse(texto)
    expect(cuerpo.campos).toEqual({ objetivo_principal: 'Hipertrofia / estética' })
    expect(cuerpo.temas).toEqual(['lesion'])
    expect(cuerpo.toques).toEqual(['lesiones', 'parq_huesos_articulaciones'])
    for (const prohibido of ['manguito', 'hombro derecho', 'rollo', 'lesiones":', 'parq_huesos_articulaciones":']) expect(texto, prohibido).not.toContain(prohibido)
  })

  it('un texto libre con salud dentro se descarta entero y no viaja en la respuesta', async () => {
    const e = entorno({ ingreso: extraccion({ parte_a_mejorar: cita('me pincha horrible la rodilla derecha al bajar escaleras') }) })
    const texto = await (await manejar(ingreso('objetivo', 'quiero fortalecer piernas, me pincha horrible la rodilla derecha al bajar escaleras'), e.d)).text()
    const cuerpo = JSON.parse(texto)
    expect(cuerpo.campos.parte_a_mejorar).toBeUndefined()
    expect(texto).not.toContain('rodilla')
    expect(cuerpo.temas).toContain('dolor')
  })

  it('la segunda red: aunque el modelo no vea la salud, el diccionario la marca sin devolver la frase', async () => {
    const e = entorno({ ingreso: extraccion({ tiempo_entrenando: cita('dos años', '1 a 2 años') }) })
    const texto = await (await manejar(ingreso('historia_entreno', 'llevo dos años entrenando, tomo enalapril para la presión'), e.d)).text()
    expect(texto).not.toContain('enalapril')
    expect(JSON.parse(texto).toques).toContain('parq_medicamento_presion')
  })
})

describe('el límite por hora', () => {
  it('a la llamada 41 de la misma persona responde 429, y otra persona no se ve afectada', async () => {
    const e = entorno({ usuario: 'u-abusador', ingreso: extraccion({ ciudad: cita('Cali') }) })
    for (let i = 0; i < 40; i++) expect((await manejar(ingreso('sobre_ti', 'Soy de Cali'), e.d)).status).toBe(200)
    const r = await manejar(ingreso('sobre_ti', 'Soy de Cali'), e.d)
    expect(r.status).toBe(429)
    const otra = entorno({ usuario: 'u-otra', ingreso: extraccion({ ciudad: cita('Cali') }) })
    expect((await manejar(ingreso('sobre_ti', 'Soy de Cali'), otra.d)).status).toBe(200)
  })

  it('una frase detenida por el filtro no gasta cupo', async () => {
    const e = entorno({ usuario: 'u-cupo', ingreso: extraccion({ ciudad: cita('Cali') }) })
    for (let i = 0; i < 50; i++) await manejar(ingreso('sobre_ti', 'ya no quiero vivir'), e.d)
    expect((await manejar(ingreso('sobre_ti', 'Soy de Cali'), e.d)).status).toBe(200)
  })

  it('una prueba del ingreso no se come el cupo del registro normal', async () => {
    const e = entorno({ usuario: 'u-aparte', ingreso: extraccion({ ciudad: cita('Cali') }) })
    for (let i = 0; i < 40; i++) await manejar(ingreso('sobre_ti', 'Soy de Cali'), e.d)
    const registro = await manejar(post({ frase: 'hice 4 series de sentadilla con 60' }), e.d)
    expect(registro.status).not.toBe(429)
  })
})

describe('la petición a Haiku es la que se midió', () => {
  it('lleva el prompt del ingreso, el mensaje del turno, sin herramientas y temperatura 0', async () => {
    const e = entorno({ ingreso: extraccion({ ciudad: cita('Cali') }) })
    const texto = 'Soy de Cali, tengo veintiocho años'
    await manejar(ingreso('sobre_ti', texto), e.d)
    const llamadas = e.alExtractor()
    expect(llamadas).toHaveLength(1)
    const cuerpo = JSON.parse(String(llamadas[0].init?.body))
    expect(cuerpo.system[0].text).toBe(PROMPT_SISTEMA_INGRESO)
    expect(cuerpo.messages).toEqual([{ role: 'user', content: armarMensajeIngreso('sobre_ti', texto) }])
    expect(cuerpo.tools).toBeUndefined()
    expect(cuerpo.temperature).toBe(0)
  })

  it('el lector de riesgo con modelo también lee el mismo texto', async () => {
    const e = entorno({ ingreso: extraccion({}) })
    await manejar(ingreso('sobre_ti', 'Soy de Cali'), e.d)
    expect(e.alLector()).toHaveLength(1)
    expect(JSON.parse(String(e.alLector()[0].init?.body)).messages).toEqual([{ role: 'user', content: 'Soy de Cali' }])
  })

  it('un turno de CONTEXTO avisa al modelo de que la respuesta es larga a propósito', () => {
    expect(armarMensajeIngreso('objetivo', 'quiero ganar músculo')).toContain('CONTEXTO')
    expect(armarMensajeIngreso('sobre_ti', 'Cali')).not.toContain('CONTEXTO')
  })
})

describe('entradas malas', () => {
  it('un turno que no existe, sin texto o con un texto enorme: 400 y 0 llamadas a un modelo', async () => {
    const e = entorno()
    expect((await manejar(ingreso('no_existe', 'hola'), e.d)).status).toBe(400)
    expect((await manejar(ingreso('sobre_ti', '   '), e.d)).status).toBe(400)
    expect((await manejar(post({ accion: 'ingreso', turno: 'sobre_ti' }), e.d)).status).toBe(400)
    expect((await manejar(ingreso('sobre_ti', 'a'.repeat(1501)), e.d)).status).toBe(400)
    expect(e.aAnthropic()).toHaveLength(0)
  })

  it('un contexto largo (1.400 caracteres) sí cabe', async () => {
    const e = entorno({ ingreso: extraccion({}) })
    expect((await manejar(ingreso('objetivo', 'quiero ganar músculo y '.repeat(60).slice(0, 1400)), e.d)).status).toBe(200)
  })

  it('si Anthropic falla en el extractor → 502 y el log no lleva el texto', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const texto = 'Soy de Cali y esta es mi frase privada'
    const e = entorno({ statusIngreso: 500, ingreso: { type: 'error', error: { message: `fallo con ${texto}` } } })
    const r = await manejar(ingreso('sobre_ti', texto), e.d)
    expect(r.status).toBe(502)
    expect(JSON.stringify(log.mock.calls)).not.toContain('frase privada')
  })
})

describe('los tiempos se registran sin el texto', () => {
  it('anota cuánto tardó cada paso, en la respuesta y en el registro, sin lo que dijo la persona', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const texto = 'Soy de Zipaquirá y tengo veintiocho años'
    const e = entorno({ ingreso: extraccion({ ciudad: cita('Zipaquirá') }) })
    const cuerpo = await (await manejar(ingreso('sobre_ti', texto), e.d)).json()
    expect(Object.keys(cuerpo.meta.tiempos_ms).sort()).toEqual(['ingreso', 'riesgo', 'total'])
    const lineas = JSON.stringify(log.mock.calls)
    expect(lineas).toContain('praxis-registro: tiempos-ingreso')
    expect(lineas).toContain('praxis-registro: tiempos-sesion')
    expect(lineas).not.toContain('Zipaquirá')
  })
})
