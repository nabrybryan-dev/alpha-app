import { afterEach, describe, expect, it, vi } from 'vitest'
import { extraerIngreso, guardarRegistro, proponerRegistro } from './registrador'

/**
 * El cliente de la Edge Function `praxis-registro`. Nunca lanza, nunca manda el usuario en
 * el cuerpo (el servidor lo saca del token) y nunca da por guardado algo que el servidor
 * no confirmó.
 */
const sesion = { access_token: 'jwt-de-la-persona', url: 'https://proyecto.supabase.co' }
const propuesta = { accion: 'tarjeta', registros: [{ campo: 'adherencia', fecha: '2026-10-01', estado: 'si', confianza: 'alta' }], descartado: [], notas_coach: [], citas_invalidas: [] }
const tarjeta = { tipo: 'confirmacion', titulo: 'Esto entendí', lineas: [{ tarjeta_id: 'm1:0', texto: 'Seguiste el plan: sí', editable: true }], avisos: [], descartado: [], botones: [], requiereConfirmarSesion: false, guardable: true }

function conFetch(respuesta: { status: number; cuerpo?: unknown } | Error) {
  const espia = vi.fn(async () => {
    if (respuesta instanceof Error) throw respuesta
    return new Response(JSON.stringify(respuesta.cuerpo ?? {}), { status: respuesta.status })
  })
  vi.stubGlobal('fetch', espia)
  return espia
}

afterEach(() => vi.unstubAllGlobals())

describe('proponerRegistro', () => {
  it('llama a la función con el JWT de la persona y sin mandar quién es', async () => {
    const espia = conFetch({ status: 200, cuerpo: { propuesta, tarjeta, meta: {} } })
    const r = await proponerRegistro(sesion, { frase: 'seguí el plan', mensajeId: 'm1', horaLocal: '2026-10-01T08:00:00-05:00', hidratacionHoyMl: 500 })

    expect(r).toEqual({ ok: true, propuesta, tarjeta, mensajeId: 'm1' })
    const [url, opciones] = espia.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://proyecto.supabase.co/functions/v1/praxis-registro')
    expect((opciones.headers as Record<string, string>).authorization).toBe('Bearer jwt-de-la-persona')
    const cuerpo = JSON.parse(opciones.body as string)
    expect(cuerpo).toEqual({ frase: 'seguí el plan', mensaje_id: 'm1', hora_local: '2026-10-01T08:00:00-05:00', hidratacion_hoy_ml: 500 })
    expect(JSON.stringify(cuerpo)).not.toMatch(/usuario/i)
  })

  it('sin sesión de nube no llama a nadie', async () => {
    const espia = conFetch({ status: 200 })
    expect(await proponerRegistro(null, { frase: 'x', mensajeId: 'm1', horaLocal: 'h' })).toEqual({ ok: false, motivo: 'sin_sesion' })
    expect(espia).not.toHaveBeenCalled()
  })

  it.each([
    [404, 'no_desplegada'],
    [401, 'sin_sesion'],
    [429, 'limite'],
    [502, 'no_entendi'],
    [400, 'frase'],
    [500, 'red'],
  ] as const)('un %i del servidor se dice como «%s»', async (status, motivo) => {
    conFetch({ status })
    expect(await proponerRegistro(sesion, { frase: 'x', mensajeId: 'm1', horaLocal: 'h' })).toEqual({ ok: false, motivo })
  })

  it('si la red se cae, lo dice y no lanza', async () => {
    conFetch(new TypeError('Failed to fetch'))
    await expect(proponerRegistro(sesion, { frase: 'x', mensajeId: 'm1', horaLocal: 'h' })).resolves.toEqual({ ok: false, motivo: 'red' })
  })

  it('un 200 sin propuesta ni tarjeta no se toma por bueno', async () => {
    conFetch({ status: 200, cuerpo: { ok: true } })
    expect(await proponerRegistro(sesion, { frase: 'x', mensajeId: 'm1', horaLocal: 'h' })).toEqual({ ok: false, motivo: 'no_entendi' })
  })
})

describe('guardarRegistro', () => {
  it('manda a /guardar SOLO lo confirmado y devuelve lo que el servidor dijo de cada registro', async () => {
    const resultados = [{ indice: 0, campo: 'adherencia', estado: 'guardado' }]
    const espia = conFetch({ status: 200, cuerpo: { mensaje_id: 'm1', resultados } })
    const r = await guardarRegistro(sesion, { mensajeId: 'm1', registros: propuesta.registros as never, confirmaSesion: true, horaLocal: 'h' })

    expect(r).toEqual({ ok: true, resultados })
    const [url, opciones] = espia.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://proyecto.supabase.co/functions/v1/praxis-registro/guardar')
    expect(JSON.parse(opciones.body as string)).toEqual({ mensaje_id: 'm1', registros: propuesta.registros, confirma_sesion: true, confirma_extra: false, hora_local: 'h' })
  })

  it('sin registros no llama al servidor', async () => {
    const espia = conFetch({ status: 200 })
    expect(await guardarRegistro(sesion, { mensajeId: 'm1', registros: [], confirmaSesion: false, horaLocal: 'h' })).toEqual({ ok: false, motivo: 'frase' })
    expect(espia).not.toHaveBeenCalled()
  })

  it('un 200 sin la lista de resultados NO cuenta como guardado', async () => {
    conFetch({ status: 200, cuerpo: { mensaje_id: 'm1' } })
    expect(await guardarRegistro(sesion, { mensajeId: 'm1', registros: propuesta.registros as never, confirmaSesion: false, horaLocal: 'h' })).toEqual({ ok: false, motivo: 'red' })
  })

  it('si el servidor falla, nada quedó guardado', async () => {
    conFetch({ status: 404 })
    expect(await guardarRegistro(sesion, { mensajeId: 'm1', registros: propuesta.registros as never, confirmaSesion: false, horaLocal: 'h' })).toEqual({ ok: false, motivo: 'no_desplegada' })
  })
})

describe('extraerIngreso', () => {
  const ok = { tipo: 'ingreso', turno: 'sobre_ti', derivada: false, campos: { ciudad: 'Cali', edad: 28 }, temas: ['lesion'], toques: ['lesiones'], descartados: [{ campo: 'altura_cm', motivo: 'cita_invalida' }], meta: {} }

  it('manda el turno y el texto con la acción «ingreso», con el JWT y sin decir quién es', async () => {
    const espia = conFetch({ status: 200, cuerpo: ok })
    const r = await extraerIngreso(sesion, { turno: 'sobre_ti', texto: 'Soy de Cali, tengo veintiocho años' })
    expect(r).toEqual({ ok: true, derivada: false, turno: 'sobre_ti', campos: { ciudad: 'Cali', edad: 28 }, temas: ['lesion'], toques: ['lesiones'], descartados: [{ campo: 'altura_cm', motivo: 'cita_invalida' }] })
    const [url, opciones] = espia.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://proyecto.supabase.co/functions/v1/praxis-registro')
    expect((opciones.headers as Record<string, string>).authorization).toBe('Bearer jwt-de-la-persona')
    expect(JSON.parse(opciones.body as string)).toEqual({ accion: 'ingreso', turno: 'sobre_ti', texto: 'Soy de Cali, tengo veintiocho años' })
  })

  it('una derivación llega como derivación, con la línea de ayuda si es de riesgo', async () => {
    conFetch({ status: 200, cuerpo: { tipo: 'ingreso', turno: 'objetivo', derivada: true, derivacion: { filtro: 'crisis', riesgo: { tipo: 'quieta', linea: 'vida' }, urgencia: 'alta' }, meta: {} } })
    expect(await extraerIngreso(sesion, { turno: 'objetivo', texto: 'x' })).toEqual({
      ok: true, derivada: true, turno: 'objetivo', derivacion: { filtro: 'crisis', riesgo: { tipo: 'quieta', linea: 'vida' }, urgencia: 'alta' },
    })
    conFetch({ status: 200, cuerpo: { tipo: 'ingreso', derivada: true, derivacion: { filtro: 'dolor', riesgo: null, urgencia: null } } })
    expect(await extraerIngreso(sesion, { turno: 'objetivo', texto: 'x' })).toMatchObject({ derivada: true, derivacion: { filtro: 'dolor', riesgo: null } })
  })

  it('una línea de ayuda inventada no se acepta como riesgo', async () => {
    conFetch({ status: 200, cuerpo: { tipo: 'ingreso', derivada: true, derivacion: { filtro: 'crisis', riesgo: { tipo: 'quieta', linea: 'otra' }, urgencia: null } } })
    expect(await extraerIngreso(sesion, { turno: 'objetivo', texto: 'x' })).toMatchObject({ derivacion: { riesgo: null } })
  })

  it('sin sesión de nube no llama a nadie', async () => {
    const espia = conFetch({ status: 200 })
    expect(await extraerIngreso(null, { turno: 'sobre_ti', texto: 'x' })).toEqual({ ok: false, motivo: 'sin_sesion' })
    expect(espia).not.toHaveBeenCalled()
  })

  it.each([[403, 'sin_sesion'], [429, 'limite'], [502, 'no_entendi'], [400, 'frase'], [404, 'no_desplegada']] as const)('un %i se dice como «%s»', async (status, motivo) => {
    conFetch({ status })
    expect(await extraerIngreso(sesion, { turno: 'sobre_ti', texto: 'x' })).toEqual({ ok: false, motivo })
  })

  it('un 200 con otra forma no se toma por bueno, y si la red se cae no lanza', async () => {
    conFetch({ status: 200, cuerpo: { ok: true } })
    expect(await extraerIngreso(sesion, { turno: 'sobre_ti', texto: 'x' })).toEqual({ ok: false, motivo: 'no_entendi' })
    conFetch({ status: 200, cuerpo: { tipo: 'ingreso', derivada: false, campos: {} } }) // faltan toques y temas
    expect(await extraerIngreso(sesion, { turno: 'sobre_ti', texto: 'x' })).toEqual({ ok: false, motivo: 'no_entendi' })
    conFetch(new TypeError('Failed to fetch'))
    expect(await extraerIngreso(sesion, { turno: 'sobre_ti', texto: 'x' })).toEqual({ ok: false, motivo: 'red' })
  })
})
