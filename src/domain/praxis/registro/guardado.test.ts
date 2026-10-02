// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { manejar, type Dependencias } from '../../../../supabase/functions/praxis-registro/index.ts'
import { armarContexto, microcicloVencido, sesionDeHoy, type MicrocicloJson } from './contexto.ts'
import { prepararAdherencia, prepararSeries, prepararTestPost, prerrequisitoPendiente } from './guardado.ts'
import type { RegistroSeries, RegistroSesionCampo } from './tipos.ts'

const micro: MicrocicloJson = {
  id: 'm-1', numero: 12, cadenciaDias: 7, fechaInicio: '2026-09-28',
  sesiones: [
    {
      id: 'S1', nombre: 'PIERNA', dia: 'LUNES',
      ejercicios: [
        { id: 'pa1', nombre: 'SENTADILLA TRASERA', sets: 4, rango: '8-12', unidadCarga: 'kg', series: [{ orden: 1, cargaKg: 40, reps: 12, velocidad: { vmp: 0.5 } } as never] },
        { id: 'pa2', nombre: 'PRENSA 45', sets: 3, unidadCarga: 'kg', series: [] },
      ],
    },
    { id: 'S2', nombre: 'EMPUJE', dia: 'MARTES', ejercicios: [{ id: 'pb1', nombre: 'PRESS BANCA PLANO', sets: 4, unidadCarga: 'kg', series: [] }] },
  ],
}
const AHORA = '2026-09-28T18:40:00-05:00'
const ctx = () => armarContexto({ ahora: AHORA, activo: micro })
const reg = (o: Partial<RegistroSeries> = {}): RegistroSeries => ({
  campo: 'series', ejercicio_id: 'pa1', ejercicio_nombre: 'SENTADILLA TRASERA', sesion_id: 'S1',
  valor: [{ orden: 2, cargaKg: 45, reps: 10 }], unidad: 'kg', confianza: 'media', avisos: [], ...o,
})
const existentes = micro.sesiones[0].ejercicios![0].series as unknown as Record<string, unknown>[]

describe('contexto desde el microciclo', () => {
  it('la sesión de hoy sale del día de la semana', () => expect(ctx().sesionHoyId).toBe('S1'))
  it('la pantalla abierta manda sobre el día', () => {
    expect(armarContexto({ ahora: AHORA, activo: micro, pantallaEjercicioId: 'pb1' }).sesionHoyId).toBe('S2')
  })
  it('una fecha sellada hoy manda sobre el día', () => {
    const m = { ...micro, sesiones: micro.sesiones.map((s) => (s.id === 'S2' ? { ...s, fecha: '2026-09-28' } : s)) }
    expect(armarContexto({ ahora: AHORA, activo: m }).sesionHoyId).toBe('S2')
  })
  it('sin nada que decida, null (no se adivina)', () => {
    const m = { ...micro, sesiones: micro.sesiones.map((s) => ({ ...s, dia: undefined, ejercicios: s.ejercicios!.map((e) => ({ ...e, series: [] })) })) }
    expect(armarContexto({ ahora: AHORA, activo: m }).sesionHoyId).toBeNull()
  })
  it('sin día ni fecha, la única sesión a medias es la de hoy', () => {
    const m = { ...micro, sesiones: micro.sesiones.map((s) => ({ ...s, dia: undefined })) }
    expect(armarContexto({ ahora: AHORA, activo: m }).sesionHoyId).toBe('S1')
  })
  it('un microciclo vence al terminar su cadencia', () => {
    expect(microcicloVencido(micro, '2026-10-04')).toBe(false)
    expect(microcicloVencido(micro, '2026-10-05')).toBe(true)
    expect(ctx().microciclo?.vencido).toBe(false)
  })
  it('la semana anterior trae las series por ejercicio.id', () => {
    const c = armarContexto({ ahora: AHORA, activo: micro, anterior: { id: 'm-0', sesiones: [{ id: 'S1', nombre: 'P', ejercicios: [{ id: 'pa1', nombre: 'X', sets: 3, series: [{ orden: 1, cargaKg: 52.5, reps: 10 }] }] }] } })
    expect(c.semanaAnterior.pa1[0].cargaKg).toBe(52.5)
  })
  it('sesionDeHoy sin sesiones', () => expect(sesionDeHoy([], [], '2026-09-28', null)).toBeNull())
})

describe('guardar series: se vuelve a comprobar todo', () => {
  it('reemplaza por orden, conserva lo que no toca y marca la procedencia', () => {
    const w = prepararSeries(reg(), ctx(), existentes, { ahora: AHORA })
    expect(w.ok).toBe(true)
    if (!w.ok) return
    expect(w.valor.ejercicioId).toBe('pa1')
    expect(w.valor.series).toHaveLength(2)
    expect(w.valor.series[0]).toMatchObject({ orden: 1, velocidad: { vmp: 0.5 } })
    expect(w.valor.series[1]).toMatchObject({ orden: 2, cargaKg: 45, reps: 10, fuente: 'praxis', confianza: 'media', hechoEn: AHORA })
  })
  it('un reemplazo pisa esa serie y solo esa', () => {
    const w = prepararSeries(reg({ valor: [{ orden: 1, cargaKg: 45, reps: 12 }] }), ctx(), existentes, { ahora: AHORA })
    expect(w.ok && w.valor.series).toHaveLength(1)
    expect(w.ok && w.valor.series[0]).toMatchObject({ cargaKg: 45, fuente: 'praxis' })
  })
  it.each([
    ['carga imposible', { valor: [{ orden: 2, cargaKg: 900, reps: 8 }] }],
    ['reps imposibles', { valor: [{ orden: 2, cargaKg: 50, reps: 400 }] }],
    ['RIR fuera de escala', { valor: [{ orden: 2, cargaKg: 50, reps: 8, rir: 6 }] }],
    ['orden repetido', { valor: [{ orden: 2, cargaKg: 50, reps: 8 }, { orden: 2, cargaKg: 50, reps: 8 }] }],
    ['sin series', { valor: [] }],
    ['ejercicio que no es de la persona', { ejercicio_id: 'pz9' }],
  ])('rechaza %s', (_n, o) => {
    expect(prepararSeries(reg(o as Partial<RegistroSeries>), ctx(), existentes, { ahora: AHORA }).ok).toBe(false)
  })
  it('una serie por encima de sets exige confirmación explícita', () => {
    const r = reg({ ejercicio_id: 'pa2', valor: [{ orden: 4, cargaKg: 140, reps: 10 }] })
    expect(prepararSeries(r, ctx(), [], { ahora: AHORA }).ok).toBe(false)
    expect(prepararSeries(r, ctx(), [], { ahora: AHORA, confirmaExtra: true }).ok).toBe(true)
  })
  it('un ejercicio de otra sesión exige confirmar que se selle su fecha', () => {
    const r = reg({ ejercicio_id: 'pb1', sesion_id: 'S2', valor: [{ orden: 1, cargaKg: 60, reps: 8 }] })
    expect(prepararSeries(r, ctx(), [], { ahora: AHORA }).ok).toBe(false)
    expect(prepararSeries(r, ctx(), [], { ahora: AHORA, confirmaSesion: true }).ok).toBe(true)
  })
  it('un microciclo vencido no recibe nada', () => {
    const c = armarContexto({ ahora: '2026-10-06T10:00:00-05:00', activo: micro })
    expect(prepararSeries(reg(), c, existentes, { ahora: AHORA })).toEqual({ ok: false, motivo: expect.stringMatching(/venció/) })
  })
  it('sin microciclo activo no se escribe', () => {
    expect(prepararSeries(reg(), armarContexto({ ahora: AHORA, activo: null }), [], { ahora: AHORA }).ok).toBe(false)
  })
})

describe('guardar el test posterior', () => {
  const rpe = (valor: number): RegistroSesionCampo => ({ campo: 'testPost.rpeSesion', sesion_id: 'S1', valor, unidad: 'rpe', confianza: 'alta' })
  it('fusiona con lo que ya había, sin pisarlo', () => {
    const w = prepararTestPost(rpe(9), ctx(), { duracionMin: 58 })
    expect(w).toEqual({ ok: true, valor: { sesionId: 'S1', testPost: { duracionMin: 58, rpeSesion: 9 } } })
  })
  it('el esfuerzo solo admite enteros de 6 a 10', () => {
    expect(prepararTestPost(rpe(5), ctx(), null).ok).toBe(false)
    expect(prepararTestPost(rpe(8.5), ctx(), null).ok).toBe(false)
  })
  it('la duración de 1 a 600 min', () => {
    const d = (valor: number): RegistroSesionCampo => ({ campo: 'testPost.duracionMin', sesion_id: 'S1', valor, unidad: 'min', confianza: 'media' })
    expect(prepararTestPost(d(70), ctx(), null).ok).toBe(true)
    expect(prepararTestPost(d(0), ctx(), null).ok).toBe(false)
  })
})

describe('adherencia (idempotente)', () => {
  it('una fila por usuario y fecha, con el mismo id que usa la app', () => {
    expect(prepararAdherencia({ campo: 'adherencia', fecha: '2026-09-28', estado: 'si', confianza: 'alta' }, 'u-1', AHORA)).toEqual({
      ok: true, valor: { id: 'ad-u-1-2026-09-28', usuario_id: 'u-1', fecha: '2026-09-28', estado: 'si' },
    })
  })
  it('solo hoy o ayer, y solo si/parcial/no', () => {
    expect(prepararAdherencia({ campo: 'adherencia', fecha: '2026-09-01', estado: 'si', confianza: 'alta' }, 'u-1', AHORA).ok).toBe(false)
    expect(prepararAdherencia({ campo: 'adherencia', fecha: '2026-09-28', estado: 'casi' as never, confianza: 'alta' }, 'u-1', AHORA).ok).toBe(false)
  })
})

describe('lo que todavía no se escribe', () => {
  it('el cardio y la preparación esperan a P7 y a la marca alterna', () => {
    expect(prerrequisitoPendiente({ campo: 'bloquesCardio[cd1].duracionRealMin', sesion_id: 'S5', bloque_id: 'cd1', bloque_nombre: 'X', valor: 20, unidad: 'min', confianza: 'alta' })).toMatch(/P7/)
    expect(prerrequisitoPendiente({ campo: 'preparacion[pr1].hechoEn', sesion_id: 'S5', parte_id: 'pr1', parte_nombre: 'X', valor: AHORA, unidad: 'iso', confianza: 'alta' })).toMatch(/alterna/)
  })
  it('check-in, agua y comida quedan pendientes de su prerrequisito', () => {
    expect(prerrequisitoPendiente({ campo: 'checkin', fecha: 'x', parche: {}, confianza_por_campo: {} })).toMatch(/P2/)
    expect(prerrequisitoPendiente({ campo: 'hidratacion', fecha: 'x', delta_ml: 200, confianza: 'media' })).toMatch(/idempotente/)
    expect(prerrequisitoPendiente({ campo: 'comida', comida: 'almuerzo', fecha: 'x', items: [], confianza_registro: 'estimado' })).toMatch(/P5/)
    expect(prerrequisitoPendiente(reg())).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// La Edge Function, con fetch simulado
// ---------------------------------------------------------------------------

function entorno(clave: string | undefined = 'sk-prueba-no-real') {
  const llamadas: { url: string; init?: RequestInit }[] = []
  const respuestas: { url: RegExp; cuerpo: unknown; ok?: boolean }[] = []
  const fetchSim = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    llamadas.push({ url: String(url), init })
    // El lector de riesgo con modelo (sin herramientas) contesta NINGUNO, salvo que la prueba
    // haya hecho fallar a Anthropic entero; estas pruebas miran el registrador.
    const anthropic = respuestas.find((x) => x.url.test(String(url)) && String(url).includes('api.anthropic.com'))
    if (String(url).includes('api.anthropic.com') && !String(init?.body ?? '').includes('"tools"') && anthropic?.ok !== false) {
      return new Response(JSON.stringify({ content: [{ type: 'text', text: '{"nivel":"NINGUNO","cita":"","por_que":"prueba"}' }] }))
    }
    const r = respuestas.find((x) => x.url.test(String(url)))
    if (!r) return new Response('{}', { status: 404 })
    return new Response(JSON.stringify(r.cuerpo), { status: r.ok === false ? 500 : 200 })
  })
  const d: Dependencias = {
    entorno: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: clave },
    fetch: fetchSim as unknown as typeof fetch,
    ahora: () => new Date('2026-09-28T23:40:00Z'),
  }
  const base = () => {
    respuestas.push({ url: /auth\/v1\/user/, cuerpo: { id: 'u-1' } })
    // Mientras Praxis esté cerrada a los asesorados, la función solo atiende al equipo (A2).
    respuestas.push({ url: /rest\/v1\/usuarios_app/, cuerpo: [{ rol: 'coach' }] })
    respuestas.push({ url: /rest\/v1\/microciclos/, cuerpo: [{ id: 'm-1', numero: 12, estado: 'activo', datos: micro }] })
  }
  return { d, llamadas, respuestas, base }
}
const post = (cuerpo: unknown, ruta = '', auth = 'Bearer jwt-de-la-persona') =>
  new Request(`https://x.supabase.co/functions/v1/praxis-registro${ruta}`, {
    method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
  })
const haiku = (entrada: unknown) => ({ content: [{ type: 'tool_use', name: 'registrar', input: entrada }], usage: { input_tokens: 1800, output_tokens: 220 } })
const sinCampos = { intencion: ['entreno'], comida: null, vida: null, sesion: null, correccion: null, aclaracion: null, clinico: { hay: false, cita: null }, fuera_de_alcance: false }
const entradaSentadilla = {
  ...sinCampos,
  entreno: [{
    ejercicio: { cita: 'sentadilla', ref_sugerida: 'e1', implicito: 'no' }, cuando: null,
    bloques: [{ n_series: null, ordinal: null, reps: '12', es_calentamiento: false, extra: [], senales: [], reserva: { tipo: 'no_dicha', cita: null },
      carga: { tipo: 'absoluta', valor: '40', unidad_cita: 'kilos', discos: null, delta: null, por: 'no_dicho' } }],
  }],
}

describe('Edge Function praxis-registro', () => {
  it('sin sesión: 401 y no llama a nadie más', async () => {
    const e = entorno()
    const r = await manejar(post({ frase: 'x' }, '', ''), e.d)
    expect(r.status).toBe(401)
    expect(e.llamadas).toHaveLength(0)
  })

  it('PROPONER: llama a Haiku con la herramienta forzada, sin modo estricto (el esquema pasa sus límites), y NO escribe', async () => {
    const e = entorno()
    e.base()
    e.respuestas.push({ url: /api\.anthropic\.com/, cuerpo: haiku(entradaSentadilla) })
    const r = await manejar(post({ frase: 'le metí 40 kilos, 12 en la sentadilla que me pusiste', mensaje_id: 'm-9' }), e.d)
    expect(r.status).toBe(200)
    const cuerpo = await r.json()
    expect(cuerpo.propuesta.accion).toBe('tarjeta')
    expect(cuerpo.propuesta.registros[0]).toMatchObject({ ejercicio_id: 'pa1', valor: [{ orden: 2, cargaKg: 40, reps: 12 }] })
    expect(cuerpo.tarjeta.lineas[0].texto).toBe('SENTADILLA TRASERA · serie 2 · 40 kg × 12')
    expect(cuerpo.meta).toMatchObject({ modelo: 'claude-haiku-4-5', tokens_entrada: 1800 })
    const enviado = JSON.parse(String(e.llamadas.find((l) => l.url.includes("anthropic") && String(l.init?.body ?? "").includes("\"tools\""))!.init!.body))
    expect(enviado.tool_choice).toEqual({ type: 'tool', name: 'registrar' })
    expect(enviado.tools[0].strict).toBeUndefined()
    expect(enviado.temperature).toBe(0)
    expect(enviado.system[0].cache_control).toEqual({ type: 'ephemeral' })
    expect(JSON.stringify(enviado.messages)).not.toMatch(/pauta|seriesPrescritas/)
    // Nada de escritura: ninguna llamada es POST a rpc ni a tablas.
    expect(e.llamadas.filter((l) => /rpc\/|\/rest\/v1\/[a-z_]+$/.test(l.url) && l.init?.method === 'POST')).toHaveLength(0)
  })

  it('la clave sale del secreto: va en la cabecera x-api-key y no aparece en el cuerpo ni en la respuesta', async () => {
    const e = entorno('sk-ant-secreto-de-prueba')
    e.base()
    e.respuestas.push({ url: /api\.anthropic\.com/, cuerpo: haiku(entradaSentadilla) })
    const r = await manejar(post({ frase: 'sentadilla 40 por 12' }), e.d)
    const llamada = e.llamadas.find((l) => l.url.includes("anthropic") && String(l.init?.body ?? "").includes("\"tools\""))!
    expect((llamada.init!.headers as Record<string, string>)['x-api-key']).toBe('sk-ant-secreto-de-prueba')
    expect(String(llamada.init!.body)).not.toContain('sk-ant-secreto')
    expect(JSON.stringify(await r.json())).not.toContain('sk-ant-secreto')
  })

  it('los datos se leen con el JWT de la persona, no con service_role', async () => {
    const e = entorno()
    e.base()
    e.respuestas.push({ url: /api\.anthropic\.com/, cuerpo: haiku(entradaSentadilla) })
    await manejar(post({ frase: 'sentadilla 40 por 12' }), e.d)
    const lectura = e.llamadas.find((l) => l.url.includes('rest/v1/microciclos'))!
    expect((lectura.init!.headers as Record<string, string>).authorization).toBe('Bearer jwt-de-la-persona')
    expect(lectura.url).toContain('usuario_id=eq.u-1')
  })

  it('el filtro clínico corre ANTES del modelo: Haiku no ve la frase', async () => {
    const e = entorno()
    e.base()
    const r = await manejar(post({ frase: 'hice banco 60 por 8 pero me molestó el hombro derecho' }), e.d)
    const cuerpo = await r.json()
    expect(cuerpo.propuesta.accion).toBe('derivar')
    expect(cuerpo.meta).toMatchObject({ modelo: null, derivada: true, aviso_bryan: true })
    expect(e.llamadas.some((l) => l.url.includes('anthropic'))).toBe(false)
    expect(cuerpo.propuesta.registros).toEqual([])
  })

  it('si Haiku falla, responde 502 con el mensaje de siempre y sin inventar', async () => {
    const e = entorno()
    e.base()
    e.respuestas.push({ url: /api\.anthropic\.com/, cuerpo: {}, ok: false })
    const r = await manejar(post({ frase: 'sentadilla 40 por 12' }), e.d)
    expect(r.status).toBe(502)
    expect((await r.json()).error).toBe('No te entendí bien, ¿lo anotas aquí?')
  })

  it('sin secreto configurado no revienta: 502 con el mismo mensaje', async () => {
    const e = entorno(undefined)
    e.base()
    const r = await manejar(post({ frase: 'sentadilla 40 por 12' }), e.d)
    expect(r.status).toBe(502)
  })

  it('una cita inventada por el modelo no llega a la propuesta', async () => {
    const e = entorno()
    e.base()
    const inventada = JSON.parse(JSON.stringify(entradaSentadilla))
    inventada.entreno[0].bloques[0].carga.valor = '99'
    e.respuestas.push({ url: /api\.anthropic\.com/, cuerpo: haiku(inventada) })
    const cuerpo = await (await manejar(post({ frase: 'sentadilla 12 repeticiones' }), e.d)).json()
    expect(cuerpo.propuesta.citas_invalidas.length).toBeGreaterThan(0)
    expect(cuerpo.propuesta.accion).toBe('preguntar')
  })

  it('GUARDAR series: usa la RPC de la app con el JWT y las series ya fusionadas', async () => {
    const e = entorno()
    e.base()
    e.respuestas.push({ url: /rpc\/fijar_series_ejercicio/, cuerpo: null })
    const r = await manejar(post({ mensaje_id: 'm-9', registros: [reg()], hora_local: AHORA }, '/guardar'), e.d)
    const cuerpo = await r.json()
    expect(cuerpo.resultados[0]).toMatchObject({ estado: 'guardado', campo: 'series' })
    const llamada = e.llamadas.find((l) => l.url.includes('rpc/fijar_series_ejercicio'))!
    const args = JSON.parse(String(llamada.init!.body))
    expect(args).toMatchObject({ p_microciclo_id: 'm-1', p_ejercicio_id: 'pa1' })
    expect(args.p_series).toHaveLength(2)
    expect((llamada.init!.headers as Record<string, string>).authorization).toBe('Bearer jwt-de-la-persona')
  })

  it('GUARDAR rechaza lo que no pasa la comprobación y no toca la base', async () => {
    const e = entorno()
    e.base()
    const r = await manejar(post({ registros: [reg({ valor: [{ orden: 2, cargaKg: 900, reps: 8 }] })], hora_local: AHORA }, '/guardar'), e.d)
    expect((await r.json()).resultados[0].estado).toBe('rechazado')
    expect(e.llamadas.some((l) => l.url.includes('rpc/'))).toBe(false)
  })

  it('GUARDAR check-in, agua y comida no escribe: dice qué prerrequisito falta', async () => {
    const e = entorno()
    e.base()
    const r = await manejar(post({ registros: [{ campo: 'hidratacion', fecha: '2026-09-28', delta_ml: 400, confianza: 'media' }], hora_local: AHORA }, '/guardar'), e.d)
    const res = (await r.json()).resultados[0]
    expect(res.estado).toBe('pendiente_prerrequisito')
    expect(e.llamadas.some((l) => l.url.includes('rpc/') || l.init?.method === 'POST')).toBe(false)
  })

  it('GUARDAR test posterior fusiona con el existente vía fijar_test_post', async () => {
    const e = entorno()
    e.base()
    e.respuestas.push({ url: /rpc\/fijar_test_post/, cuerpo: null })
    const r = await manejar(post({ registros: [{ campo: 'testPost.rpeSesion', sesion_id: 'S1', valor: 9, unidad: 'rpe', confianza: 'alta' }], hora_local: AHORA }, '/guardar'), e.d)
    expect((await r.json()).resultados[0].estado).toBe('guardado')
    expect(JSON.parse(String(e.llamadas.find((l) => l.url.includes('fijar_test_post'))!.init!.body))).toMatchObject({ p_sesion_id: 'S1', p_test: { rpeSesion: 9 } })
  })

  it('GUARDAR adherencia: upsert por (usuario, fecha) con el JWT, solo las columnas que cambian', async () => {
    const e = entorno()
    e.base()
    e.respuestas.push({ url: /rest\/v1\/adherencias/, cuerpo: null })
    const r = await manejar(post({ registros: [{ campo: 'adherencia', fecha: '2026-09-28', estado: 'parcial', confianza: 'alta' }], hora_local: AHORA }, '/guardar'), e.d)
    expect((await r.json()).resultados[0].estado).toBe('guardado')
    const l = e.llamadas.find((x) => x.url.includes('adherencias'))!
    expect(l.url).toContain('on_conflict=usuario_id,fecha')
    expect((l.init!.headers as Record<string, string>).prefer).toContain('merge-duplicates')
    expect(JSON.parse(String(l.init!.body))).toEqual({ id: 'ad-u-1-2026-09-28', usuario_id: 'u-1', fecha: '2026-09-28', estado: 'parcial' })
  })

  it('cuerpo inválido y método equivocado', async () => {
    const e = entorno()
    const mal = new Request('https://x/functions/v1/praxis-registro', { method: 'POST', headers: { authorization: 'Bearer j' }, body: 'no es json' })
    expect((await manejar(mal, e.d)).status).toBe(400)
    expect((await manejar(new Request('https://x/functions/v1/praxis-registro', { method: 'GET' }), e.d)).status).toBe(405)
    expect((await manejar(new Request('https://x/functions/v1/praxis-registro', { method: 'OPTIONS' }), e.d)).status).toBe(204)
  })
})
