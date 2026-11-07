// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manejar, type Dependencias } from '../../../../supabase/functions/praxis-registro/index.ts'
import type { MicrocicloJson } from './contexto.ts'

/**
 * «Deshacer» en la función completa (paso D3): la orden NO ejecuta, la tarjeta firmada vence a los 2 minutos,
 * `praxis_deshacer` solo se llama con la confirmación y el libro es de la persona. Con el interruptor
 * `PRAXIS_LIBRO` apagado, `guardar` hace lo de siempre. La frase y la persona no salen en la consola.
 */
const AHORA = new Date('2026-11-05T15:00:00Z') // 10:00 en Bogotá
const YO = 'u-deshacer-1'
const SECRETO = 'secreto-de-prueba'
const FRASE_SECRETA = 'deshaz lo del agua de mi pareja'
const micro: MicrocicloJson = {
  id: 'm-1', numero: 12, cadenciaDias: 7, fechaInicio: '2026-11-02',
  sesiones: [{ id: 'S1', nombre: 'PIERNA', dia: 'JUEVES', ejercicios: [{ id: 'pa1', nombre: 'SENTADILLA TRASERA', sets: 4, rango: '8-12', unidadCarga: 'kg', series: [] }] }],
}
interface Fila { id: string; usuario_id: string; tipo: string; antes?: unknown; despues: unknown; creado_en: string; deshecho_en: string | null }
const fila = (id: string, tipo: string, creado_en: string, usuario_id = YO): Fila => ({
  id, usuario_id, tipo, creado_en, deshecho_en: null,
  despues: tipo === 'series' ? { series: [{ orden: 1, cargaKg: 60, reps: 10 }] } : { estado: 'si', comentario: null },
})
const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const AJENO = '33333333-3333-4333-8333-333333333333'
const SERIES = fila(A, 'series', '2026-11-05T14:20:00Z')
const ADHER = fila(B, 'adherencia', '2026-11-05T14:40:00Z')

type Envoltura = (original: typeof fetch) => typeof fetch

function entorno(o: { libro?: Fila[]; flag?: string; secreto?: string; ahora?: () => Date; rpcDeshacer?: unknown; tabla?: boolean; sesion?: string } = {}) {
  const llamadas: { url: string; init?: RequestInit }[] = []
  const libro = o.libro ?? []
  const yo = o.sesion ?? YO
  const fetchSim = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    llamadas.push({ url: u, init })
    if (/auth\/v1\/user/.test(u)) return new Response(JSON.stringify({ id: yo }))
    if (/rest\/v1\/usuarios_app/.test(u)) return new Response(JSON.stringify([{ rol: 'coach' }]))
    if (/rest\/v1\/capacidades_staff/.test(u)) return new Response('[]')
    if (/rest\/v1\/microciclos/.test(u)) return new Response(JSON.stringify([{ id: 'm-1', numero: 12, estado: 'activo', datos: micro }]))
    if (/rest\/v1\/praxis_registros_aplicados/.test(u)) {
      if (o.tabla === false) return new Response(JSON.stringify({ code: 'PGRST205' }), { status: 404 })
      return new Response(JSON.stringify(libro.filter((f) => f.usuario_id === yo && f.deshecho_en === null)))
    }
    if (/rpc\/praxis_deshacer/.test(u)) {
      const { p_registro_id } = JSON.parse(String(init?.body))
      if (!libro.some((f) => f.id === p_registro_id && f.usuario_id === yo)) return new Response(JSON.stringify({ code: '42501', message: 'x' }), { status: 403 })
      return new Response(JSON.stringify(o.rpcDeshacer ?? { deshecho: true, ya_deshecho: false, registro_id: p_registro_id, tipo: 'series' }))
    }
    if (/rpc\/praxis_aplicar_/.test(u)) return new Response(JSON.stringify({ ya_aplicado: false, registro_id: A }))
    if (/rpc\/fijar_series_ejercicio/.test(u)) return new Response('null')
    if (/rest\/v1\/adherencias/.test(u)) return new Response(null, { status: 201 })
    if (u.includes('api.anthropic.com')) return new Response(JSON.stringify({ content: [{ type: 'text', text: '{"nivel":"NINGUNO","cita":"","por_que":"p"}' }] }))
    return new Response('{}', { status: 404 })
  })
  const d: Dependencias = {
    entorno: {
      SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'sk-prueba-no-real', PRAXIS_CAMINO_RAPIDO: '0',
      PRAXIS_LIBRO: o.flag ?? '1', PRAXIS_SECRETO_DESHACER: o.secreto ?? SECRETO,
    },
    fetch: fetchSim as unknown as typeof fetch,
    ahora: o.ahora ?? (() => AHORA),
  }
  const envolver = (f: Envoltura) => { d.fetch = f(d.fetch) }
  const aRpc = (n: string) => llamadas.filter((l) => l.url.includes(`rpc/${n}`))
  const aModelo = () => llamadas.filter((l) => l.url.includes('api.anthropic.com'))
  return { d, llamadas, aRpc, aModelo, envolver }
}
type Entorno = ReturnType<typeof entorno>
const post = (cuerpo: unknown, ruta = '') =>
  new Request(`https://x.supabase.co/functions/v1/praxis-registro${ruta}`, {
    method: 'POST', headers: { authorization: 'Bearer jwt-de-la-persona', 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
  })
type Tarjeta = { registro_id: string; vence_en: string; token: string }
async function proponer(e: Entorno, frase: string) {
  const r = await manejar(post({ frase }), e.d)
  return { r, j: await r.json() }
}
const confirmar = (e: Entorno, tarjeta: unknown, extra: Record<string, unknown> = {}) =>
  manejar(post({ tarjeta, confirmado: true, mensaje_id: 'm-deshacer-1', ...extra }, '/deshacer'), e.d)
const tarjetaDe = async (e: Entorno) => (await proponer(e, 'deshaz lo último')).j.propuesta.tarjeta as Tarjeta
/** Que la base conteste otra cosa a las direcciones que cumplan `patron`. */
const responder = (e: Entorno, patron: RegExp, respuesta: () => Response) =>
  e.envolver((f) => (async (u: RequestInfo | URL, i?: RequestInit) => (patron.test(String(u)) ? respuesta() : f(u, i))) as typeof fetch)

afterEach(() => vi.restoreAllMocks())

describe('deshacer por frase: la orden propone y no ejecuta', () => {
  it('«deshaz lo último» con un registro: pide confirmar, con tarjeta que vence a los 2 minutos, sin modelo y sin escribir', async () => {
    const e = entorno({ libro: [SERIES] })
    const { r, j } = await proponer(e, 'deshaz lo último')
    expect(r.status).toBe(200)
    expect(j.tipo).toBe('deshacer')
    expect(j.propuesta.accion).toBe('confirmar_deshacer')
    expect(j.propuesta.tarjeta.registro_id).toBe(A)
    expect(j.propuesta.tarjeta.vence_en).toBe('2026-11-05T15:02:00.000Z')
    expect(j.propuesta.botones).toEqual(['Sí, quitar', 'No, dejarlo'])
    expect(j.meta.modelo).toBeNull()
    expect(e.aModelo()).toHaveLength(0)
    expect(e.aRpc('praxis_deshacer')).toHaveLength(0)
    expect(e.llamadas.filter((l) => l.init?.method === 'POST' && !/auth/.test(l.url))).toHaveLength(0)
  })

  it('con dos candidatos y «deshaz eso»: pregunta cuál y no ejecuta', async () => {
    const e = entorno({ libro: [SERIES, ADHER] })
    const { j } = await proponer(e, 'deshaz eso')
    expect(j.propuesta.accion).toBe('preguntar')
    expect(j.propuesta.opciones.map((o: { registro_id: string }) => o.registro_id).sort()).toEqual([A, B])
    expect(e.aRpc('praxis_deshacer')).toHaveLength(0)
  })

  it('libro vacío: «No hay nada que deshacer»', async () => {
    const { j } = await proponer(entorno(), 'deshaz lo último')
    expect(j.propuesta).toMatchObject({ accion: 'nada_que_deshacer', motivo: 'vacio' })
  })

  it('solo ofrece lo de la persona: un registro ajeno que se colara en la respuesta de la base no se ofrece', async () => {
    const e = entorno()
    responder(e, /praxis_registros_aplicados/, () => new Response(JSON.stringify([fila(AJENO, 'series', '2026-11-05T14:30:00Z', 'u-otra')])))
    const { j } = await proponer(e, 'deshaz lo último')
    expect(j.propuesta.accion).toBe('nada_que_deshacer')
  })

  it('la frase de riesgo gana: «deshaz …» con riesgo termina en seguridad y no mira el libro', async () => {
    const e = entorno({ libro: [SERIES] })
    const { j } = await proponer(e, 'deshaz lo último, ya no quiero vivir')
    expect(j.tipo).toBeUndefined()
    expect(j.meta.derivada).toBe(true)
    expect(e.llamadas.some((l) => l.url.includes('praxis_registros_aplicados'))).toBe(false)
  })

  it('una frase que no es la orden («mi hermano borró todo») sigue su camino de siempre, al modelo', async () => {
    const e = entorno({ libro: [SERIES] })
    await manejar(post({ frase: 'mi hermano borró todo' }), e.d)
    expect(e.llamadas.some((l) => l.url.includes('praxis_registros_aplicados'))).toBe(false)
    expect(e.aModelo().length).toBeGreaterThan(0)
  })

  it('interruptor apagado, sin clave o tabla sin migrar: «deshaz lo último» sigue como hoy (al modelo)', async () => {
    for (const e of [entorno({ libro: [SERIES], flag: '0' }), entorno({ libro: [SERIES], secreto: '' }), entorno({ tabla: false })]) {
      await manejar(post({ frase: 'deshaz lo último' }), e.d)
      expect(e.aModelo().length).toBeGreaterThan(0)
    }
  })

  it('ni la frase ni la persona salen en el registro de la consola', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const e = entorno({ libro: [SERIES] })
    const { j } = await proponer(e, 'deshaz lo último')
    await proponer(e, FRASE_SECRETA)
    await confirmar(e, j.propuesta.tarjeta)
    await confirmar(e, { ...j.propuesta.tarjeta, token: 'falso' })
    responder(e, /rpc\/praxis_deshacer/, () => new Response(JSON.stringify({ code: '22023', message: `detalle de ${YO}` }), { status: 400 }))
    await confirmar(e, j.propuesta.tarjeta)
    const todo = JSON.stringify([...log.mock.calls, ...err.mock.calls])
    expect(todo).not.toContain('pareja')
    expect(todo).not.toContain('agua')
    expect(todo).not.toContain(YO)
    expect(log.mock.calls.some((c) => String(c[0]).includes('deshacer'))).toBe(true)
  })
})

describe('POST /deshacer: confirmación, vigencia y dueño', () => {
  it('sin confirmado:true no llama a praxis_deshacer', async () => {
    const e = entorno({ libro: [SERIES] })
    const t = await tarjetaDe(e)
    for (const c of [undefined, false, 'true', 1]) {
      const r = await manejar(post({ tarjeta: t, confirmado: c }, '/deshacer'), e.d)
      expect(r.status).toBe(400)
    }
    expect(e.aRpc('praxis_deshacer')).toHaveLength(0)
  })

  it('con la tarjeta vigente y confirmado: llama UNA vez a praxis_deshacer con el registro y el JWT de la persona', async () => {
    const e = entorno({ libro: [SERIES] })
    const r = await confirmar(e, await tarjetaDe(e))
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ resultado: 'deshecho' })
    expect(e.aRpc('praxis_deshacer')).toHaveLength(1)
    const [c] = e.aRpc('praxis_deshacer')
    expect(JSON.parse(String(c.init!.body))).toEqual({ p_registro_id: A, p_mensaje_id: 'm-deshacer-1', p_confirmado: true })
    expect(new Headers(c.init!.headers).get('authorization')).toBe('Bearer jwt-de-la-persona')
  })

  it('tarjeta vencida (pasaron más de 2 minutos): rechazada, 0 llamadas', async () => {
    let ahora = AHORA
    const e = entorno({ libro: [SERIES], ahora: () => ahora })
    const t = await tarjetaDe(e)
    ahora = new Date(AHORA.getTime() + 2 * 60_000 + 1)
    const r = await confirmar(e, t)
    expect(r.status).toBe(410)
    expect((await r.json()).resultado).toBe('vencida')
    expect(e.aRpc('praxis_deshacer')).toHaveLength(0)
  })

  it('justo a los 2 minutos todavía vale', async () => {
    let ahora = AHORA
    const e = entorno({ libro: [SERIES], ahora: () => ahora })
    const t = await tarjetaDe(e)
    ahora = new Date(AHORA.getTime() + 2 * 60_000)
    expect((await confirmar(e, t)).status).toBe(200)
  })

  it('alargar el vencimiento a mano invalida la firma', async () => {
    let ahora = AHORA
    const e = entorno({ libro: [SERIES], ahora: () => ahora })
    const t = await tarjetaDe(e)
    ahora = new Date(AHORA.getTime() + 10 * 60_000)
    const r = await confirmar(e, { ...t, vence_en: '2026-11-05T16:00:00.000Z' })
    expect(r.status).toBe(403)
    expect(e.aRpc('praxis_deshacer')).toHaveLength(0)
  })

  it('deshacer ajeno: cambiar el registro de la tarjeta, inventar el token o mandar una tarjeta sin firma, rechazado sin llamar a la RPC', async () => {
    const e = entorno({ libro: [SERIES] })
    const t = await tarjetaDe(e)
    expect((await confirmar(e, { ...t, registro_id: AJENO })).status).toBe(403)
    expect((await confirmar(e, { ...t, token: 'a'.repeat(64) })).status).toBe(403)
    expect((await confirmar(e, { registro_id: AJENO, vence_en: t.vence_en })).status).toBe(400)
    expect(e.aRpc('praxis_deshacer')).toHaveLength(0)
  })

  it('una tarjeta firmada para OTRA persona no vale con mi sesión', async () => {
    const t = await tarjetaDe(entorno({ libro: [SERIES] }))
    const otra = entorno({ libro: [SERIES], sesion: 'u-otra' })
    expect((await confirmar(otra, t)).status).toBe(403)
    expect(otra.aRpc('praxis_deshacer')).toHaveLength(0)
  })

  it('si la base dice que no es tuyo (42501), no hay éxito', async () => {
    const e = entorno({ libro: [SERIES] })
    const t = await tarjetaDe(e)
    responder(e, /rpc\/praxis_deshacer/, () => new Response(JSON.stringify({ code: '42501', message: 'x' }), { status: 403 }))
    const r = await confirmar(e, t)
    expect(r.status).toBe(403)
    expect((await r.json()).resultado).toBe('no_encontrado')
  })

  it('respuestas de la base: ya_deshecho y cambio_despues se dicen tal cual', async () => {
    for (const [rpc, esperado, texto] of [
      [{ deshecho: false, ya_deshecho: true }, 'ya_deshecho', 'ya estaba deshecho'],
      [{ deshecho: false, motivo: 'cambio_despues' }, 'cambio_despues', 'ya cambió después'],
    ] as const) {
      const e = entorno({ libro: [SERIES], rpcDeshacer: rpc })
      const j = await (await confirmar(e, await tarjetaDe(e))).json()
      expect(j.resultado).toBe(esperado)
      expect(j.texto).toContain(texto)
    }
  })

  it('elegir entre candidatos emite la tarjeta de ese registro y nada más', async () => {
    const e = entorno({ libro: [SERIES, ADHER] })
    const j = await (await manejar(post({ elegir: B }, '/deshacer'), e.d)).json()
    expect(j.propuesta.accion).toBe('confirmar_deshacer')
    expect(j.propuesta.tarjeta.registro_id).toBe(B)
    expect(e.aRpc('praxis_deshacer')).toHaveLength(0)
    expect((await manejar(post({ elegir: AJENO }, '/deshacer'), e.d)).status).toBe(404)
  })

  it('apagado o sin clave, /deshacer responde 503 y no toca nada', async () => {
    const e = entorno({ libro: [SERIES], flag: '0' })
    expect((await manejar(post({ confirmado: true }, '/deshacer'), e.d)).status).toBe(503)
    expect(e.aRpc('praxis_deshacer')).toHaveLength(0)
  })
})

describe('guardar y el libro, detrás de PRAXIS_LIBRO', () => {
  const series = { campo: 'series', ejercicio_id: 'pa1', ejercicio_nombre: 'SENTADILLA TRASERA', sesion_id: 'S1', valor: [{ orden: 1, cargaKg: 40, reps: 12 }], unidad: 'kg', confianza: 'alta', avisos: [] }
  const adher = { campo: 'adherencia', fecha: '2026-11-05', estado: 'si', confianza: 'alta' }
  const guardar = (e: Entorno, extra: Record<string, unknown> = {}) =>
    manejar(post({ mensaje_id: 'm-7', registros: [series, adher], hora_local: '2026-11-05T10:00:00-05:00', ...extra }, '/guardar'), e.d)
  const estados = async (r: Response) => ((await r.json()).resultados as { estado: string }[]).map((x) => x.estado)

  it('apagado: guarda como hoy (fijar_series_ejercicio y upsert de adherencias), sin tocar el libro', async () => {
    const e = entorno({ flag: '0' })
    expect(await estados(await guardar(e))).toEqual(['guardado', 'guardado'])
    expect(e.aRpc('fijar_series_ejercicio')).toHaveLength(1)
    expect(e.llamadas.filter((l) => /rest\/v1\/adherencias/.test(l.url))).toHaveLength(1)
    expect(e.llamadas.some((l) => l.url.includes('praxis_aplicar_'))).toBe(false)
  })

  it('encendido: usa praxis_aplicar_series y praxis_aplicar_adherencia con mensaje e índice, y no las rutas de antes', async () => {
    const e = entorno()
    expect(await estados(await guardar(e))).toEqual(['guardado', 'guardado'])
    expect(JSON.parse(String(e.aRpc('praxis_aplicar_series')[0].init!.body))).toMatchObject({ p_mensaje_id: 'm-7', p_indice: 0, p_microciclo_id: 'm-1', p_ejercicio_id: 'pa1' })
    expect(JSON.parse(String(e.aRpc('praxis_aplicar_adherencia')[0].init!.body))).toEqual({ p_mensaje_id: 'm-7', p_indice: 1, p_fecha: '2026-11-05', p_estado: 'si' })
    expect(e.aRpc('fijar_series_ejercicio')).toHaveLength(0)
    expect(e.llamadas.some((l) => /rest\/v1\/adherencias/.test(l.url))).toBe(false)
  })

  it('encendido pero sin mensaje_id válido: cae al camino de siempre', async () => {
    const e = entorno()
    await guardar(e, { mensaje_id: '' })
    expect(e.aRpc('fijar_series_ejercicio')).toHaveLength(1)
    expect(e.llamadas.some((l) => l.url.includes('praxis_aplicar_'))).toBe(false)
  })

  it('encendido pero la migración sin aplicar (función ausente, PGRST202): cae al camino de siempre', async () => {
    const e = entorno()
    responder(e, /rpc\/praxis_aplicar_/, () => new Response(JSON.stringify({ code: 'PGRST202' }), { status: 404 }))
    expect(await estados(await guardar(e))).toEqual(['guardado', 'guardado'])
    expect(e.aRpc('fijar_series_ejercicio')).toHaveLength(1)
  })

  it('encendido y la base rechaza (22023): queda rechazado, no se cuela por el otro camino', async () => {
    const e = entorno()
    responder(e, /rpc\/praxis_aplicar_series/, () => new Response(JSON.stringify({ code: '22023' }), { status: 400 }))
    expect((await estados(await guardar(e)))[0]).toBe('rechazado')
    expect(e.aRpc('fijar_series_ejercicio')).toHaveLength(0)
  })
})

describe('deshacer el agua (0163)', () => {
  const C = '44444444-4444-4444-8444-444444444444'
  const AGUA: Fila = { id: C, usuario_id: YO, tipo: 'agua', antes: { ml: 1000 }, despues: { ml: 1250 }, creado_en: '2026-11-05T14:50:00Z', deshecho_en: null }

  it('el libro se lee también con el agua', async () => {
    const e = entorno({ libro: [AGUA] })
    await proponer(e, 'deshaz lo último')
    const lectura = e.llamadas.find((l) => l.url.includes('praxis_registros_aplicados'))!
    expect(decodeURIComponent(lectura.url)).toContain('tipo=in.(series,adherencia,agua)')
    expect(lectura.url).toMatch(/select=[^&]*antes/)
  })

  it('«deshaz lo del agua»: pide confirmar el agua con lo que sumó la tarjeta, sin modelo y sin escribir', async () => {
    const e = entorno({ libro: [SERIES, AGUA] })
    const { j } = await proponer(e, 'deshaz lo del agua')
    expect(j.propuesta.accion).toBe('confirmar_deshacer')
    expect(j.propuesta.tarjeta).toMatchObject({ registro_id: C, tipo: 'hidratacion', descripcion: '+250 ml' })
    expect(e.aModelo()).toHaveLength(0)
    expect(e.aRpc('praxis_deshacer')).toHaveLength(0)
  })

  it('el agua de una tarjeta que creó el día (antes nulo) cuenta desde 0', async () => {
    const e = entorno({ libro: [{ ...AGUA, antes: null, despues: { ml: 500 } }] })
    const { j } = await proponer(e, 'deshaz lo del agua')
    expect(j.propuesta.tarjeta.descripcion).toBe('+500 ml')
  })

  it('confirmado: la base deshace el agua y se dice en palabras', async () => {
    const e = entorno({ libro: [AGUA], rpcDeshacer: { deshecho: true, ya_deshecho: false, registro_id: C, tipo: 'agua' } })
    const j = await (await confirmar(e, await tarjetaDe(e))).json()
    expect(j).toMatchObject({ resultado: 'deshecho', texto: 'Listo, dejé el agua de hoy como estaba antes.' })
    expect(e.aRpc('praxis_deshacer')).toHaveLength(1)
  })

  it('confirmado: devuelve el total y la fecha que quedaron, para que el teléfono fije su agua', async () => {
    const e = entorno({ libro: [AGUA], rpcDeshacer: { deshecho: true, ya_deshecho: false, registro_id: C, tipo: 'agua', fecha: '2026-11-05', total_ml: 1000 } })
    const j = await (await confirmar(e, await tarjetaDe(e))).json()
    expect(j.agua).toEqual({ fecha: '2026-11-05', total_ml: 1000 })
  })

  it('las series no traen agua, y un total raro de la base no se pasa', async () => {
    const e = entorno({ libro: [SERIES] })
    expect((await (await confirmar(e, await tarjetaDe(e))).json()).agua).toBeUndefined()
    const e2 = entorno({ libro: [AGUA], rpcDeshacer: { deshecho: true, tipo: 'agua', fecha: 'ayer', total_ml: -5 } })
    expect((await (await confirmar(e2, await tarjetaDe(e2))).json()).agua).toBeUndefined()
  })

  it('con la 0163 sin aplicar la base rechaza el agua: no hay éxito y no se toca nada', async () => {
    const e = entorno({ libro: [AGUA] })
    const t = await tarjetaDe(e)
    responder(e, /rpc\/praxis_deshacer/, () => new Response(JSON.stringify({ code: '22023', message: 'praxis_deshacer: el tipo agua todavia no se puede deshacer' }), { status: 400 }))
    const r = await confirmar(e, t)
    expect(r.status).toBe(502)
    expect((await r.json()).resultado).toBe('error')
  })
})
