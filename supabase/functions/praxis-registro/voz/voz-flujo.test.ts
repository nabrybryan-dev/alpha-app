/**
 * Etapa A del criterio firmado CRITERIO-PASO-A-FUNCION-20261104.md: casos 1, 2, 3, 4, 6, 7 y 8, con llamadas simuladas
 * (sin red y sin gasto). «Pieza textual» en el camino del concepto = lo de hoy (`mostrar: null`), por la regla de
 * precedencia de Bryan. Pregunta y campos escritos por Claude.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_TOKENS_REDACTOR, PAUSA_SIN_SALDO_MS, reiniciarPausas } from './modelos'
import { contadorEnMemoria, vozDelConcepto, type DepsVoz, type EntradaVoz } from './vozConcepto'

const PREGUNTA = '¿Cuánto descanso entre series en máquina para Mateo?'
const CAMPOS = { respuesta: 'Entre 2 y 3 minutos en multiarticulares; en aislamiento puede ser menos.', de_que_depende: ['objetivo', 'ejercicio'], criterio_de_practica: 'Es una convención de práctica.' }
const REDACCION = 'De 2 a 3 minutos en multiarticulares, y menos en aislamiento según el objetivo.'
const ENTRADA: EntradaVoz = { pregunta: PREGUNTA, porteroDecidio: false, concepto: { id: 'nue-cuanto-descansar', coseno: 0.86, campos: CAMPOS }, alerta: false, nombresConocidos: [] }
const ENCENDIDO = { PRAXIS_REDACTOR: 'encendido', DEEPSEEK_API_KEY: 'ds-prueba', ANTHROPIC_API_KEY: 'an-prueba' }

const json = (c: unknown, status = 200) => new Response(JSON.stringify(c), { status })
const deepseekOk = (contenido = JSON.stringify({ respuesta: REDACCION, hueco: false })) => json({ choices: [{ message: { content: contenido } }], usage: { total_tokens: 900 } })
const lectorOk = (veredicto: unknown = { contesta_lo_preguntado: 'si', hecho_fuera_de_campos: null }) => json({ content: [{ type: 'text', text: JSON.stringify(veredicto) }], usage: { input_tokens: 700, output_tokens: 30 } })

type Respuestas = { deepseek?: () => Response | Promise<Response>; anthropic?: () => Response | Promise<Response> }
let reloj = 1_800_000_000_000
let registro: ReturnType<typeof vi.spyOn>

function deps(entorno: DepsVoz['entorno'], r: Respuestas = {}) {
  const f = vi.fn(async (url: string | URL | Request) => {
    const u = String(url)
    if (u.startsWith('https://api.deepseek.com/')) return (r.deepseek ?? (() => deepseekOk()))()
    if (u.startsWith('https://api.anthropic.com/')) return (r.anthropic ?? (() => lectorOk()))()
    throw new Error(`llamada no esperada a ${u}`)
  })
  const d: DepsVoz = { entorno, fetch: f as unknown as typeof fetch, ahoraMs: () => reloj, gasto: contadorEnMemoria() }
  return { d, f }
}

beforeEach(() => {
  reiniciarPausas()
  reloj = 1_800_000_000_000
  registro = vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => registro.mockRestore())

describe('el camino completo', () => {
  it('con todo bien y encendido, muestra la redacción aprobada', async () => {
    const { d } = deps(ENCENDIDO)
    const r = await vozDelConcepto(d, ENTRADA)
    expect(r.mostrar).toBe(REDACCION)
    expect(r.meta).toMatchObject({ redactor_estado: 'ok', lector_estado: 'aprobo', mostrado: 'redaccion', tokens_redactor: 900, tokens_lector: 730 })
  })
  it('en sombra corre todo y no muestra nada', async () => {
    const { d, f } = deps({ ...ENCENDIDO, PRAXIS_REDACTOR: 'sombra' })
    const r = await vozDelConcepto(d, ENTRADA)
    expect(r.mostrar).toBeNull()
    expect(r.meta.lector_estado).toBe('aprobo')
    expect(f).toHaveBeenCalledTimes(2)
  })
})

describe('caso 1: interruptor apagado o sin clave → lo de hoy, sin llamar a nadie', () => {
  it.each([
    ['sin interruptor', { DEEPSEEK_API_KEY: 'ds', ANTHROPIC_API_KEY: 'an' }],
    ['interruptor con valor raro', { ...ENCENDIDO, PRAXIS_REDACTOR: 'si' }],
    ['sin clave de DeepSeek', { ...ENCENDIDO, DEEPSEEK_API_KEY: undefined }],
  ])('%s', async (_n, entorno) => {
    const { d, f } = deps(entorno)
    const r = await vozDelConcepto(d, ENTRADA)
    expect(r.mostrar).toBeNull()
    expect(r.meta.omitido).toBe('apagado')
    expect(f).not.toHaveBeenCalled()
  })
})

describe('caso 2: DeepSeek falla → lo de hoy', () => {
  it.each([
    ['error 500', () => json({ error: 'x' }, 500), 'http_500'],
    ['tarda de más', () => { throw new DOMException('se acabó el tiempo', 'TimeoutError') }, 'timeout'],
    ['respuesta vacía', () => deepseekOk(''), 'vacio'],
    ['respuesta con texto vacío', () => deepseekOk(JSON.stringify({ respuesta: '  ', hueco: false })), 'vacio'],
    ['JSON inválido', () => deepseekOk('{respuesta: sin comillas'), 'json_invalido'],
  ])('%s', async (_n, deepseek, estado) => {
    const { d, f } = deps(ENCENDIDO, { deepseek })
    const r = await vozDelConcepto(d, ENTRADA)
    expect(r.mostrar).toBeNull()
    expect(r.meta.redactor_estado).toBe(estado)
    expect(f).toHaveBeenCalledTimes(1) // el lector no se llama
  })
})

describe('caso 3: DeepSeek sin saldo → lo de hoy y no insiste un rato', () => {
  it('marca sin_saldo, no vuelve a llamar dentro de la pausa y sí después', async () => {
    const { d, f } = deps(ENCENDIDO, { deepseek: () => json({ error: { message: 'Insufficient Balance' } }, 402) })
    expect((await vozDelConcepto(d, ENTRADA)).meta.redactor_estado).toBe('sin_saldo')
    reloj += PAUSA_SIN_SALDO_MS - 1
    const segunda = await vozDelConcepto(d, ENTRADA)
    expect(segunda.mostrar).toBeNull()
    expect(segunda.meta.redactor_estado).toBe('sin_saldo')
    expect(f).toHaveBeenCalledTimes(1)
    reloj += 2
    await vozDelConcepto(d, ENTRADA)
    expect(f).toHaveBeenCalledTimes(2)
  })
})

describe('caso 4: el segundo lector rechaza, falla o no tiene saldo → lo de hoy (nunca la redacción sin lector)', () => {
  it.each([
    ['rechaza por otro tipo', () => lectorOk({ contesta_lo_preguntado: 'no', hecho_fuera_de_campos: null }), 'rechazo'],
    ['rechaza por hecho fuera', () => lectorOk({ contesta_lo_preguntado: 'si', hecho_fuera_de_campos: 'cita un estudio que no está' }), 'rechazo'],
    ['error 529', () => json({}, 529), 'http_529'],
    ['tarda de más', () => { throw new DOMException('x', 'TimeoutError') }, 'timeout'],
    ['JSON ilegible', () => json({ content: [{ type: 'text', text: 'apruebo' }] }), 'json_invalido'],
    ['sin saldo', () => json({ error: { message: 'Your credit balance is too low' } }, 400), 'sin_saldo'],
  ])('%s', async (_n, anthropic, estado) => {
    const { d } = deps(ENCENDIDO, { anthropic })
    const r = await vozDelConcepto(d, ENTRADA)
    expect(r.mostrar).toBeNull()
    expect(r.meta.lector_estado).toBe(estado)
    expect(r.meta.mostrado).toBe('lo_de_hoy')
  })
  it('sin clave de Anthropic tampoco se muestra la redacción', async () => {
    const { d } = deps({ ...ENCENDIDO, ANTHROPIC_API_KEY: undefined })
    const r = await vozDelConcepto(d, ENTRADA)
    expect(r.mostrar).toBeNull()
    expect(r.meta.lector_estado).toBe('apagado')
  })
  it('si el total pasa de 8 segundos, aunque apruebe, lo de hoy', async () => {
    const { d } = deps(ENCENDIDO, { anthropic: () => { reloj += 8001; return lectorOk() } })
    const r = await vozDelConcepto(d, ENTRADA)
    expect(r.mostrar).toBeNull()
    expect(r.meta.lector_estado).toBe('timeout')
  })
})

describe('caso 5 en el flujo: una guarda que rechaza no llega al lector', () => {
  it('voseo en la redacción', async () => {
    const { d, f } = deps(ENCENDIDO, { deepseek: () => deepseekOk(JSON.stringify({ respuesta: 'Vos podés dejar 2 minutos.', hueco: false })) })
    const r = await vozDelConcepto(d, ENTRADA)
    expect(r.mostrar).toBeNull()
    expect(r.meta.redactor_estado).toBe('guarda_voseo')
    expect(f).toHaveBeenCalledTimes(1)
  })
})

describe('caso 6: «cómo», alerta de salud y precedencia → no se redacta', () => {
  it('«cómo» no redacta y anota la duda', async () => {
    const { d, f } = deps(ENCENDIDO)
    const r = await vozDelConcepto(d, { ...ENTRADA, pregunta: '¿Cómo armo una serie descendente en polea?' })
    expect(r).toMatchObject({ mostrar: null, anotarDuda: true, meta: { omitido: 'como' } })
    expect(f).not.toHaveBeenCalled()
  })
  it.each([
    ['alerta de salud o riesgo', { alerta: true }, 'alerta'],
    ['el portero ya decidió (gana la ficha)', { porteroDecidio: true }, 'ficha_gana'],
    ['sin concepto', { concepto: null }, 'sin_concepto'],
    ['concepto bajo el corte', { concepto: { ...ENTRADA.concepto!, coseno: 0.82 } }, 'bajo_corte'],
  ])('%s', async (_n, cambio, omitido) => {
    const { d, f } = deps(ENCENDIDO)
    const r = await vozDelConcepto(d, { ...ENTRADA, ...cambio })
    expect(r.mostrar).toBeNull()
    expect(r.meta.omitido).toBe(omitido)
    expect(f).not.toHaveBeenCalled()
  })
})

describe('caso 7: gasto sin freno, con aviso, y tope de salida fijo', () => {
  it('al cruzar el nivel deja UNA línea de aviso y sigue atendiendo', async () => {
    const { d, f } = deps({ ...ENCENDIDO, PRAXIS_VOZ_AVISO_TOKENS_DIA: '1500' })
    const a = await vozDelConcepto(d, ENTRADA) // deepseek 900
    const b = await vozDelConcepto(d, ENTRADA) // deepseek 1800: cruza
    const c = await vozDelConcepto(d, ENTRADA) // DeepSeek ya cruzó: no repite su aviso
    for (const r of [a, b, c]) expect(r.mostrar).toBe(REDACCION)
    const avisos = registro.mock.calls.filter((l) => String(l[0]).endsWith('aviso_gasto'))
    // Cada proveedor avisa una sola vez: DeepSeek en la 2.ª (900 → 1.800) y el lector en la 3.ª (730 × 3 = 2.190).
    expect(avisos).toEqual([
      ['praxis-registro: voz aviso_gasto', 'deepseek', 1800, 'nivel', 1500],
      ['praxis-registro: voz aviso_gasto', 'anthropic', 2190, 'nivel', 1500],
    ])
    expect(f).toHaveBeenCalledTimes(6)
  })
  it('el redactor siempre pide el mismo máximo de texto de salida', async () => {
    const { d, f } = deps(ENCENDIDO)
    await vozDelConcepto(d, ENTRADA)
    const cuerpo = JSON.parse(String((f.mock.calls[0][1] as RequestInit).body))
    expect(cuerpo.max_tokens).toBe(MAX_TOKENS_REDACTOR)
    expect(cuerpo.reasoning_effort).toBe('low') // Enmienda 4: none fue rápido pero peor (13 de 40 largas, mezcla de piezas)
    expect(MAX_TOKENS_REDACTOR).toBe(4000)
  })
})

describe('caso 8: nada guarda ni registra la pregunta, la redacción ni los campos', () => {
  it('ni en el registro ni en meta; y solo se habla con los dos modelos', async () => {
    const { d, f } = deps(ENCENDIDO)
    const r = await vozDelConcepto(d, ENTRADA)
    const salida = JSON.stringify(registro.mock.calls) + JSON.stringify(r.meta)
    for (const secreto of [PREGUNTA, REDACCION, CAMPOS.respuesta, CAMPOS.criterio_de_practica, 'descanso', 'Mateo']) expect(salida).not.toContain(secreto)
    expect(registro).toHaveBeenCalledTimes(1)
    const destinos = f.mock.calls.map((c) => new URL(String(c[0])).host)
    expect(destinos).toEqual(['api.deepseek.com', 'api.anthropic.com'])
  })
  it('a DeepSeek no le llega el nombre (limpiador antes de mandar)', async () => {
    const { d, f } = deps(ENCENDIDO)
    await vozDelConcepto(d, ENTRADA)
    expect(String((f.mock.calls[0][1] as RequestInit).body)).not.toContain('Mateo')
  })
})
