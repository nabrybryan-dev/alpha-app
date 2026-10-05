// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manejar, type Dependencias } from '../../../../supabase/functions/praxis-registro/index.ts'
import { armarContexto, type MicrocicloJson } from './contexto.ts'
import { validarExtraccion } from './esquema.ts'
import { resolverPropuesta } from './resolver.ts'
import { caminoRapido, extraerRapido, propuestaSinDudas } from './rapido.ts'
import type { Propuesta } from './tipos.ts'

/**
 * El camino rápido del registrador: las frases más simples de entreno se extraen sin modelo.
 * Lo que se vigila aquí es que sea ESTRECHO (ante la duda cae al modelo) y que no se salte
 * ninguna de las puertas de seguridad de la función.
 */
const AHORA = '2026-09-28T18:40:00-05:00' // lunes
const micro: MicrocicloJson = {
  id: 'm-1', numero: 12, cadenciaDias: 7, fechaInicio: '2026-09-28',
  sesiones: [
    {
      id: 'S1', nombre: 'PIERNA', dia: 'LUNES',
      ejercicios: [
        { id: 'pa1', nombre: 'SENTADILLA TRASERA', sets: 4, rango: '8-12', unidadCarga: 'kg', series: [] },
        { id: 'pa2', nombre: 'PRENSA 45', sets: 3, rango: '10-15', unidadCarga: 'kg', series: [] },
        { id: 'pa3', nombre: 'BANCO PLANO', sets: 3, rango: '8-10', unidadCarga: 'kg', series: [] },
        { id: 'pa4', nombre: 'BANCO INCLINADO', sets: 3, rango: '8-10', unidadCarga: 'kg', series: [] },
      ],
    },
    { id: 'S2', nombre: 'ESPALDA', dia: 'MARTES', ejercicios: [{ id: 'pb1', nombre: 'REMO CON BARRA', sets: 3, rango: '8-10', unidadCarga: 'kg', series: [] }] },
  ],
}
const ctx = armarContexto({ ahora: AHORA, activo: micro })

const resolver = (frase: string) => {
  const b = extraerRapido(frase)
  const v = validarExtraccion(frase, b)
  return resolverPropuesta(frase, v.extraccion, ctx, v.citasInvalidas)
}

describe('camino rápido · lo que SÍ toma', () => {
  it.each([
    ['sentadilla 60 por 10', 'pa1', [{ cargaKg: 60, reps: 10 }]],
    ['hice sentadilla 60 por 10', 'pa1', [{ cargaKg: 60, reps: 10 }]],
    ['Hice la sentadilla, 60 por 10.', 'pa1', [{ cargaKg: 60, reps: 10 }]],
    ['prensa 140 kilos por 15', 'pa2', [{ cargaKg: 140, reps: 15 }]],
    ['sentadilla tres de diez con quince', 'pa1', [{ cargaKg: 15, reps: 10 }, { cargaKg: 15, reps: 10 }, { cargaKg: 15, reps: 10 }]],
    ['prensa dos series de doce con cuarenta y cinco', 'pa2', [{ cargaKg: 45, reps: 12 }, { cargaKg: 45, reps: 12 }]],
    ['prensa 140 por 15 tres series', 'pa2', [{ cargaKg: 140, reps: 15 }, { cargaKg: 140, reps: 15 }, { cargaKg: 140, reps: 15 }]],
  ])('«%s» sale igual que si lo hubiera sacado el modelo', (frase, id, series) => {
    expect(caminoRapido(frase, ctx)).not.toBeNull()
    const p = resolver(frase)
    expect(p.accion).toBe('tarjeta')
    const r = p.registros[0] as { campo: string; ejercicio_id: string; valor: { cargaKg: number; reps?: number }[]; confianza: string }
    expect(r.campo).toBe('series')
    expect(r.ejercicio_id).toBe(id)
    expect(r.confianza).toBe('alta')
    expect(r.valor.map((s) => ({ cargaKg: s.cargaKg, reps: s.reps }))).toEqual(series)
  })

  it('la extracción tiene la forma de la del modelo y todas sus citas son literales de la frase', () => {
    const frase = 'sentadilla 60 por 10'
    const v = validarExtraccion(frase, extraerRapido(frase))
    expect(v.citasInvalidas).toEqual([])
    expect(v.extraccion.entreno[0].ejercicio.cita).toBe('sentadilla')
    expect(v.extraccion.entreno[0].bloques[0]).toMatchObject({ reps: '10', carga: { tipo: 'absoluta', valor: '60' } })
  })
})

describe('camino rápido · lo que NO toma (cae al modelo)', () => {
  it.each([
    ['dos ejercicios: ambiguo entre BANCO PLANO e INCLINADO', 'banco 60 por 8'],
    ['una duda dicha: «como»', 'sentadilla como 60 por 10'],
    ['aproximado', 'sentadilla 60 por 10 más o menos'],
    ['autocorrección', 'sentadilla 40 no no 60 por 10'],
    ['otro día: «ayer»', 'ayer sentadilla 60 por 10'],
    ['pero: dos ideas', 'sentadilla 60 por 10 pero la prensa 140 por 15'],
    ['dos ejercicios con «y»', 'sentadilla y prensa 60 por 10'],
    ['con reserva', 'sentadilla 60 por 10 con 2 en reserva'],
    ['sin ejercicio (el de la pantalla)', '60 por 10'],
    ['sin ejercicio (solo números)', 'hice 40 por 12'],
    ['unidad distinta (libras)', 'sentadilla 135 libras por 10'],
    ['ejercicio que no está en el plan de hoy', 'curl femoral 40 por 12'],
    ['ejercicio de otra sesión (martes)', 'remo con barra 50 por 10'],
    ['sin repeticiones', 'sentadilla con 60'],
    ['una pregunta', '¿cuánto peso debería subir en sentadilla 60 por 10?'],
    ['un número fuera de la gramática', 'sentadilla 60 por diez veces'],
    ['frase de comida', 'comí arroz 100 por 2'],
    ['vacía', ''],
  ])('%s: «%s»', (_porque, frase) => {
    expect(caminoRapido(frase, ctx)).toBeNull()
  })

  it('si no es el día de esa sesión la propuesta pide confirmación y la frase va al modelo', () => {
    const otro = armarContexto({ ahora: '2026-09-30T18:40:00-05:00', activo: micro })
    expect(caminoRapido('sentadilla 60 por 10', otro)).toBeNull()
  })
})

/* ——— La función entera: las puertas de seguridad no se mueven ——— */
const haikuRiesgo = (nivel: string) => ({ content: [{ type: 'text', text: JSON.stringify({ nivel, cita: nivel === 'NINGUNO' ? '' : 'x', por_que: 'prueba' }) }] })

function entorno(opciones: { rapido?: string; auth?: boolean; rol?: string; riesgo?: string | 'falla' } = {}) {
  const llamadas: { url: string; body: string }[] = []
  const fetchSim = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    const body = String(init?.body ?? '')
    llamadas.push({ url: u, body })
    if (u.includes('auth/v1/user')) return opciones.auth === false ? new Response('{}', { status: 401 }) : new Response(JSON.stringify({ id: 'u-1' }))
    if (u.includes('rest/v1/usuarios_app')) return new Response(JSON.stringify([{ rol: opciones.rol ?? 'coach' }]))
    if (u.includes('rest/v1/microciclos')) return new Response(JSON.stringify([{ id: 'm-1', numero: 12, estado: 'activo', datos: micro }]))
    if (u.includes('praxis_avisos_coach')) return new Response('{}')
    if (u.includes('api.anthropic.com') && !body.includes('"tools"')) {
      if (opciones.riesgo === 'falla') return new Response('{}', { status: 500 })
      return new Response(JSON.stringify(haikuRiesgo(opciones.riesgo ?? 'NINGUNO')))
    }
    if (u.includes('api.anthropic.com')) {
      const entrada = { intencion: ['entreno'], entreno: [{ ejercicio: { cita: 'sentadilla', implicito: 'no' }, bloques: [{ reps: '10', carga: { tipo: 'absoluta', valor: '60' } }] }] }
      return new Response(JSON.stringify({ content: [{ type: 'tool_use', name: 'registrar', input: entrada }], usage: { input_tokens: 9000, output_tokens: 90 } }))
    }
    return new Response('{}', { status: 404 })
  })
  const d: Dependencias = {
    entorno: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'sk-prueba-no-real', PRAXIS_CAMINO_RAPIDO: opciones.rapido },
    fetch: fetchSim as unknown as typeof fetch,
    ahora: () => new Date('2026-09-28T23:40:00Z'),
  }
  return {
    d, llamadas,
    registrador: () => llamadas.filter((l) => l.url.includes('api.anthropic.com') && l.body.includes('"tools"')),
    lector: () => llamadas.filter((l) => l.url.includes('api.anthropic.com') && !l.body.includes('"tools"')),
  }
}
const post = (frase: string) =>
  new Request('https://x.supabase.co/functions/v1/praxis-registro', {
    method: 'POST', headers: { authorization: 'Bearer jwt-de-la-persona', 'content-type': 'application/json' }, body: JSON.stringify({ frase }),
  })

describe('camino rápido · dentro de la función', () => {
  afterEach(() => vi.restoreAllMocks())

  it('la frase simple NO llama al registrador, pero SÍ al lector de riesgo, y la respuesta es la de siempre', async () => {
    const e = entorno()
    const r = await manejar(post('sentadilla 60 por 10'), e.d)
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(j.propuesta.accion).toBe('tarjeta')
    expect(j.propuesta.registros[0]).toMatchObject({ campo: 'series', ejercicio_id: 'pa1' })
    expect(j.meta.camino).toBe('rapido')
    expect(e.registrador()).toHaveLength(0)
    expect(e.lector()).toHaveLength(1)
  })

  it('el lector de riesgo manda: si marca, la frase simple se deriva y no hay tarjeta', async () => {
    const e = entorno({ riesgo: 'RIESGO_VIDA' })
    const j = await (await manejar(post('sentadilla 60 por 10'), e.d)).json()
    expect(j.propuesta.accion).toBe('derivar')
    expect(j.meta.derivada).toBe(true)
    expect(e.registrador()).toHaveLength(0)
  })

  it('si el lector de riesgo falla, 502 aunque la frase sea simple', async () => {
    const e = entorno({ riesgo: 'falla' })
    const r = await manejar(post('sentadilla 60 por 10'), e.d)
    expect(r.status).toBe(502)
  })

  it('sin sesión válida no se llama a ningún modelo', async () => {
    const e = entorno({ auth: false })
    const r = await manejar(post('sentadilla 60 por 10'), e.d)
    expect(r.status).toBe(401)
    expect(e.llamadas.filter((l) => l.url.includes('anthropic'))).toHaveLength(0)
  })

  it('sin el rol permitido no se llama a ningún modelo', async () => {
    const e = entorno({ rol: 'asesorado' })
    const r = await manejar(post('sentadilla 60 por 10'), e.d)
    expect(r.status).toBe(403)
    expect(e.llamadas.filter((l) => l.url.includes('anthropic'))).toHaveLength(0)
  })

  it('el filtro de riesgo va antes de todo: una frase con dolor no llega ni al camino rápido ni a Anthropic', async () => {
    const e = entorno()
    const j = await (await manejar(post('sentadilla 60 por 10 pero me duele el hombro'), e.d)).json()
    expect(j.propuesta.accion).toBe('derivar')
    expect(e.llamadas.filter((l) => l.url.includes('anthropic'))).toHaveLength(0)
  })

  it('una frase que no es simple sigue llamando al registrador', async () => {
    const e = entorno()
    const j = await (await manejar(post('sentadilla 60 por 10 más o menos'), e.d)).json()
    expect(e.registrador()).toHaveLength(1)
    expect(j.meta.camino).toBe('modelo')
  })

  it('PRAXIS_CAMINO_RAPIDO=0 lo apaga sin tocar el código', async () => {
    const e = entorno({ rapido: '0' })
    const j = await (await manejar(post('sentadilla 60 por 10'), e.d)).json()
    expect(e.registrador()).toHaveLength(1)
    expect(j.meta.camino).toBe('modelo')
  })
})

describe('camino rápido · series de más', () => {
  it('una cuarta serie sobre una pauta de tres no se resuelve sola: pregunta, así que va al modelo', () => {
    expect(caminoRapido('prensa 140 por 15 cuatro series', ctx)).toBeNull()
  })
})

describe('camino rápido · cada duda por separado', () => {
  it.each([
    ['reps fuera del rango de la pauta', 'banca 70 por 6'],
    ['una carga muy distinta a la última serie', 'sentadilla 800 por 10'],
    ['carga imposible: pregunta', 'sentadilla 12 por 60'],
  ])('%s: «%s» va al modelo', (_porque, frase) => {
    expect(caminoRapido(frase, ctx)).toBeNull()
  })

  const base = (): Propuesta => ({
    accion: 'tarjeta', descartado: [], notas_coach: [], citas_invalidas: [],
    registros: [{
      campo: 'series', ejercicio_id: 'pa1', ejercicio_nombre: 'SENTADILLA TRASERA', sesion_id: 'S1',
      valor: [{ orden: 1, cargaKg: 60, reps: 10 }], unidad: 'kg', confianza: 'alta', avisos: [],
    }],
  })
  it('la propuesta limpia pasa', () => {
    expect(propuestaSinDudas(base(), ctx)).toBe(true)
  })
  it.each<[string, (p: Propuesta) => void]>([
    ['confianza media', (p) => { (p.registros[0] as { confianza: string }).confianza = 'media' }],
    ['confianza baja', (p) => { (p.registros[0] as { confianza: string }).confianza = 'baja' }],
    ['un aviso en el registro', (p) => { (p.registros[0] as { avisos: string[] }).avisos = ['revísala'] }],
    ['una nota para el coach', (p) => { p.notas_coach = ['reps fuera de rango'] }],
    ['algo descartado', (p) => { p.descartado = [{ cita: 'x', motivo: 'y' }] }],
    ['una cita inválida', (p) => { p.citas_invalidas = ['x'] }],
    ['una pregunta', (p) => { p.pregunta = { texto: '¿?', opciones: [], campo_bloqueante: 'x' } as unknown as Propuesta['pregunta'] }],
    ['otra sesión', (p) => { (p.registros[0] as { sesion_id: string }).sesion_id = 'S2' }],
    ['pide confirmar la sesión', (p) => { p.requiere_confirmacion_de_sesion = true }],
    ['otra fecha', (p) => { p.fecha_real = '2026-09-27' }],
    ['una copia', (p) => { (p.registros[0] as { origen?: string }).origen = 'copiado_de_pauta' }],
    ['reemplaza una serie', (p) => { (p.registros[0] as { reemplaza?: unknown }).reemplaza = { orden: 1, antes: { cargaKg: 50 } } }],
    ['dos registros', (p) => { p.registros.push(p.registros[0]) }],
    ['no es tarjeta', (p) => { p.accion = 'preguntar' }],
    ['registro que no es de series', (p) => { (p.registros[0] as { campo: string }).campo = 'comida' }],
  ])('%s la saca del camino rápido', (_n, romper) => {
    const p = base()
    romper(p)
    expect(propuestaSinDudas(p, ctx)).toBe(false)
  })
})
