import { afterEach, describe, expect, it, vi } from 'vitest'
import { deshacerRegistro, elegirParaDeshacer } from './deshacer'

const sesion = { access_token: 'jwt-de-la-persona', url: 'https://proyecto.supabase.co' }
const tarjeta = { campo: 'deshacer' as const, registro_id: '11111111-1111-4111-8111-111111111111', tipo: 'series', descripcion: '3 series', vence_en: '2026-11-05T15:02:00.000Z', token: 'firma' }

function conFetch(respuesta: { status: number; cuerpo?: unknown } | Error) {
  const espia = vi.fn(async () => {
    if (respuesta instanceof Error) throw respuesta
    return new Response(JSON.stringify(respuesta.cuerpo ?? {}), { status: respuesta.status })
  })
  vi.stubGlobal('fetch', espia)
  return espia
}
afterEach(() => vi.unstubAllGlobals())

describe('deshacerRegistro: POST /deshacer con la tarjeta firmada y el confirmado', () => {
  it('manda {tarjeta, confirmado:true, mensaje_id} con el JWT y nada más', async () => {
    const espia = conFetch({ status: 200, cuerpo: { tipo: 'deshacer', resultado: 'deshecho', texto: 'x' } })
    expect(await deshacerRegistro(sesion, { tarjeta, mensajeId: 'm-1' })).toBe('deshecho')
    const [url, op] = espia.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://proyecto.supabase.co/functions/v1/praxis-registro/deshacer')
    expect((op.headers as Record<string, string>).authorization).toBe('Bearer jwt-de-la-persona')
    expect(JSON.parse(op.body as string)).toEqual({ tarjeta, confirmado: true, mensaje_id: 'm-1' })
  })
  it.each([
    [200, 'ya_deshecho', 'ya_deshecho'], [200, 'cambio_despues', 'cambio_despues'], [410, 'vencida', 'vencida'],
    [409, 'otro_dia', 'otro_dia'], [403, 'no_encontrado', 'no_se_pudo'], [502, 'error', 'no_se_pudo'], [400, 'tarjeta_invalida', 'no_se_pudo'],
  ])('%i %s se cuenta como %s (el cuerpo de un 4xx también se lee)', async (status, resultado, esperado) => {
    conFetch({ status, cuerpo: { tipo: 'deshacer', resultado, texto: 'x' } })
    expect(await deshacerRegistro(sesion, { tarjeta, mensajeId: 'm' })).toBe(esperado)
  })
  it('sin sesión no llama a nadie; red caída o cuerpo ilegible: no se pudo, sin lanzar', async () => {
    const espia = conFetch({ status: 200 })
    expect(await deshacerRegistro(null, { tarjeta, mensajeId: 'm' })).toBe('no_se_pudo')
    expect(await deshacerRegistro({ access_token: '', url: sesion.url }, { tarjeta, mensajeId: 'm' })).toBe('no_se_pudo')
    expect(espia).not.toHaveBeenCalled()
    conFetch(new Error('sin red'))
    expect(await deshacerRegistro(sesion, { tarjeta, mensajeId: 'm' })).toBe('no_se_pudo')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 200 })))
    expect(await deshacerRegistro(sesion, { tarjeta, mensajeId: 'm' })).toBe('no_se_pudo')
  })
})

describe('deshacerRegistro: el agua deshecha se fija en el teléfono', () => {
  it('deshecho con agua: avisa la fecha y el total que quedaron', async () => {
    conFetch({ status: 200, cuerpo: { tipo: 'deshacer', resultado: 'deshecho', texto: 'x', agua: { fecha: '2026-11-05', total_ml: 1000 } } })
    const fijar = vi.fn()
    expect(await deshacerRegistro(sesion, { tarjeta, mensajeId: 'm' }, fijar)).toBe('deshecho')
    expect(fijar).toHaveBeenCalledWith('2026-11-05', 1000)
  })
  it.each([
    ['sin agua', { tipo: 'deshacer', resultado: 'deshecho', texto: 'x' }, 200],
    ['no deshecho', { tipo: 'deshacer', resultado: 'cambio_despues', texto: 'x', agua: { fecha: '2026-11-05', total_ml: 1000 } }, 200],
    ['fecha rara', { tipo: 'deshacer', resultado: 'deshecho', texto: 'x', agua: { fecha: 'hoy', total_ml: 1000 } }, 200],
    ['total fuera de rango', { tipo: 'deshacer', resultado: 'deshecho', texto: 'x', agua: { fecha: '2026-11-05', total_ml: 10001 } }, 200],
    ['estado de error', { tipo: 'deshacer', resultado: 'deshecho', texto: 'x', agua: { fecha: '2026-11-05', total_ml: 1000 } }, 502],
  ])('%s: no toca el agua del teléfono', async (_n, cuerpo, status) => {
    conFetch({ status, cuerpo })
    const fijar = vi.fn()
    await deshacerRegistro(sesion, { tarjeta, mensajeId: 'm' }, fijar)
    expect(fijar).not.toHaveBeenCalled()
  })
})

describe('elegirParaDeshacer: POST /deshacer {elegir}', () => {
  it('devuelve la confirmación de ese candidato y manda solo {elegir}', async () => {
    const espia = conFetch({ status: 200, cuerpo: { tipo: 'deshacer', propuesta: { accion: 'confirmar_deshacer', texto: 'Voy a quitar…', botones: [], tarjeta } } })
    const r = await elegirParaDeshacer(sesion, tarjeta.registro_id)
    expect(r).toMatchObject({ ok: true, propuesta: { accion: 'confirmar_deshacer', tarjeta } })
    const [, op] = espia.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(op.body as string)).toEqual({ elegir: tarjeta.registro_id })
  })
  it('404 «no es tuyo», propuesta que no es de confirmar, sin sesión o red caída: { ok:false }', async () => {
    conFetch({ status: 404, cuerpo: { tipo: 'deshacer', resultado: 'no_encontrado', texto: 'x' } })
    expect(await elegirParaDeshacer(sesion, 'a')).toEqual({ ok: false })
    conFetch({ status: 200, cuerpo: { tipo: 'deshacer', propuesta: { accion: 'nada_que_deshacer', texto: 't' } } })
    expect(await elegirParaDeshacer(sesion, 'a')).toEqual({ ok: false })
    expect(await elegirParaDeshacer(null, 'a')).toEqual({ ok: false })
    conFetch(new Error('x'))
    expect(await elegirParaDeshacer(sesion, 'a')).toEqual({ ok: false })
  })
})
