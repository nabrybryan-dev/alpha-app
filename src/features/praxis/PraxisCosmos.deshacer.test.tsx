import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deshacerRegistro, elegirParaDeshacer } from '../../data/praxis/deshacer'
import { proponerRegistro } from '../../data/praxis/registrador'
import type { LoQuePraxisVe } from '../../domain/praxis/plan/listaBlanca'
import { PraxisCosmos } from './PraxisCosmos'
import type { ConexionPraxis } from './motor/conexion'

/**
 * «Deshacer» en la pantalla de Praxis, con la RED simulada (fetch) y los datos reales de por medio: lo que la persona ve,
 * y qué POST sale de verdad. Regla madre: nada se quita sin el toque en «Sí, quitar».
 */
vi.setConfig({ testTimeout: 30_000 })
const ESPERA = { timeout: 12_000 }
const HOY = '2026-10-01'
const USUARIO = 'u-prueba'
const SES = { access_token: 'jwt', url: 'https://x.supabase.co' }
const ID_A = '11111111-1111-4111-8111-111111111111'
const ID_B = '22222222-2222-4222-8222-222222222222'
const TARJETA = (id: string) => ({ campo: 'deshacer', registro_id: id, tipo: 'series', descripcion: '3 series', vence_en: '2026-11-05T15:02:00.000Z', token: `firma-${id.slice(0, 2)}` })
const veVacio: LoQuePraxisVe = { activo: null, cerrados: [], perfil: null, checkins: [], adherencias: [], hidratacionHoyMl: 0, aguaHoy: null, checkinHoy: null, adherenciaSemana: null, comida: null, falta: ['plan_activo', 'perfil', 'checkins', 'plan_de_comida'] }

type Cuerpo = Record<string, unknown>
interface Red { proponer: () => { status: number; cuerpo: unknown }; deshacer: (c: Cuerpo) => { status: number; cuerpo: unknown } | Promise<{ status: number; cuerpo: unknown }> }
const confirmar = (id: string) => ({ tipo: 'deshacer', propuesta: { accion: 'confirmar_deshacer', texto: 'Voy a quitar las series que anotaste a las 8:15: 3 series. ¿Lo quito?', botones: ['Sí, quitar', 'No, dejarlo'], tarjeta: TARJETA(id) }, meta: {} })
const preguntar = { tipo: 'deshacer', propuesta: { accion: 'preguntar', texto: '¿Cuál quito?', botones: [], opciones: [{ registro_id: ID_A, etiqueta: 'Series: 3 series, 8:15' }, { registro_id: ID_B, etiqueta: 'Adherencia: marcada «sí», 12:40' }] }, meta: {} }
const nada = { tipo: 'deshacer', propuesta: { accion: 'nada_que_deshacer', motivo: 'vacio', texto: 'No hay nada que deshacer. No toqué nada.' }, meta: {} }
const resultado = (resultado: string) => ({ tipo: 'deshacer', resultado, texto: 'texto del servidor' })

let llamadas: { ruta: string; cuerpo: Cuerpo }[] = []
function red(r: Red) {
  llamadas = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, op: RequestInit) => {
    const ruta = url.replace('https://x.supabase.co/functions/v1/praxis-registro', '') || '/'
    const cuerpo = JSON.parse(String(op.body)) as Cuerpo
    llamadas.push({ ruta, cuerpo })
    const x = await (ruta === '/deshacer' ? r.deshacer(cuerpo) : r.proponer())
    return new Response(JSON.stringify(x.cuerpo), { status: x.status })
  }))
}
const alDeshacer = () => llamadas.filter((l) => l.ruta === '/deshacer')

function conexion(): ConexionPraxis {
  return {
    usuarioId: USUARIO, hoy: HOY, leer: () => veVacio,
    proponer: (frase, mensajeId) => proponerRegistro(SES, { frase, mensajeId, horaLocal: '2026-10-01T08:00:00-05:00' }),
    deshacer: { elegir: (id) => elegirParaDeshacer(SES, id), confirmar: (p) => deshacerRegistro(SES, p) },
    guardar: vi.fn(async () => ({ ok: true as const, resultados: [] })),
    preguntar: vi.fn(async () => ({ ok: true as const, destinatario: 'coach' as const })),
    preguntas: vi.fn(async () => []),
    irAlFormulario: vi.fn(),
  }
}

function montar(c: ConexionPraxis) {
  const r = render(<MemoryRouter><PraxisCosmos trato="tu" conexion={c} /></MemoryRouter>)
  const raiz = r.container.querySelector('.praxis') as HTMLElement
  return { raiz, $: (s: string) => raiz.querySelector(s) as HTMLElement }
}
async function pedir(u: ReturnType<typeof userEvent.setup>, $: (s: string) => HTMLElement, frase = 'deshaz lo último que anoté') {
  await u.click(screen.getByRole('button', { name: 'Hablar con Praxis' }))
  await waitFor(() => expect((document.querySelector('#frase')?.textContent || '').length).toBeGreaterThan(5), ESPERA)
  await u.type($('#entrada'), `${frase}{Enter}`)
}
const boton = (nombre: string) => screen.findByRole('button', { name: nombre }, ESPERA)

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(`praxis.u.${USUARIO}.permisos`, JSON.stringify({ cConversacion: true, cRiesgo: true, fecha: HOY, version: 'v2' }))
  window.matchMedia = ((consulta: string) => ({
    matches: consulta.includes('prefers-reduced-motion'), media: consulta, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Praxis · deshacer: qué pinta cada propuesta', () => {
  it('confirmar: el texto y dos botones; sin el toque NO hay POST a /deshacer', async () => {
    red({ proponer: () => ({ status: 200, cuerpo: confirmar(ID_A) }), deshacer: () => ({ status: 200, cuerpo: resultado('deshecho') }) })
    const u = userEvent.setup(); const { $ } = montar(conexion())
    await pedir(u, $)
    expect(await boton('Sí, quitar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No, dejarlo' })).toBeInTheDocument()
    await waitFor(() => expect($('#frase').textContent).toContain('Voy a quitar las series'), ESPERA)
    expect(alDeshacer()).toHaveLength(0)
  })

  it('preguntar: un botón por candidato con su hora, más «Ninguno»; sin toque no hay POST', async () => {
    red({ proponer: () => ({ status: 200, cuerpo: preguntar }), deshacer: () => ({ status: 200, cuerpo: resultado('deshecho') }) })
    const u = userEvent.setup(); const { $ } = montar(conexion())
    await pedir(u, $)
    expect(await boton('Series: 3 series, 8:15')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adherencia: marcada «sí», 12:40' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ninguno' })).toBeInTheDocument()
    expect(alDeshacer()).toHaveLength(0)
  })

  it('nada que deshacer: dice el motivo, sin botones y sin POST', async () => {
    red({ proponer: () => ({ status: 200, cuerpo: nada }), deshacer: () => ({ status: 200, cuerpo: resultado('deshecho') }) })
    const u = userEvent.setup(); const { $ } = montar(conexion())
    await pedir(u, $)
    await waitFor(() => expect($('#frase').textContent).toContain('No hay nada que deshacer'), ESPERA)
    expect(screen.queryByRole('button', { name: 'Sí, quitar' })).toBeNull()
    expect(alDeshacer()).toHaveLength(0)
  })
})

describe('Praxis · deshacer: los toques', () => {
  it('«Sí, quitar» manda {tarjeta, confirmado:true, mensaje_id} y dice «Listo, lo quité.»', async () => {
    red({ proponer: () => ({ status: 200, cuerpo: confirmar(ID_A) }), deshacer: () => ({ status: 200, cuerpo: resultado('deshecho') }) })
    const u = userEvent.setup(); const { $ } = montar(conexion())
    await pedir(u, $)
    await u.click(await boton('Sí, quitar'))
    await waitFor(() => expect($('#frase').textContent).toContain('Listo, lo quité.'), ESPERA)
    expect(alDeshacer()).toHaveLength(1)
    expect(alDeshacer()[0].cuerpo).toMatchObject({ tarjeta: TARJETA(ID_A), confirmado: true })
    expect(typeof alDeshacer()[0].cuerpo.mensaje_id).toBe('string')
  })

  it('doble toque en «Sí, quitar» = UN solo POST (el botón se bloquea mientras espera)', async () => {
    let soltar: () => void = () => {}
    const espera = new Promise<void>((res) => { soltar = res })
    red({ proponer: () => ({ status: 200, cuerpo: confirmar(ID_A) }), deshacer: async () => { await espera; return { status: 200, cuerpo: resultado('deshecho') } } })
    const u = userEvent.setup(); const { $ } = montar(conexion())
    await pedir(u, $)
    const si = await boton('Sí, quitar')
    await u.dblClick(si)
    await waitFor(() => expect(alDeshacer()).toHaveLength(1), ESPERA)
    expect(screen.getByRole('button', { name: 'Quitando…' })).toBeDisabled()
    soltar()
    await waitFor(() => expect($('#frase').textContent).toContain('Listo, lo quité.'), ESPERA)
    expect(alDeshacer()).toHaveLength(1)
  })

  it('«No, dejarlo» no llama a nada', async () => {
    red({ proponer: () => ({ status: 200, cuerpo: confirmar(ID_A) }), deshacer: () => ({ status: 200, cuerpo: resultado('deshecho') }) })
    const u = userEvent.setup(); const { $ } = montar(conexion())
    await pedir(u, $)
    await u.click(await boton('No, dejarlo'))
    await waitFor(() => expect($('#frase').textContent).toContain('no quité nada'), ESPERA)
    expect(alDeshacer()).toHaveLength(0)
  })

  it('«Ninguno» no llama a nada', async () => {
    red({ proponer: () => ({ status: 200, cuerpo: preguntar }), deshacer: () => ({ status: 200, cuerpo: resultado('deshecho') }) })
    const u = userEvent.setup(); const { $ } = montar(conexion())
    await pedir(u, $)
    await u.click(await boton('Ninguno'))
    await waitFor(() => expect($('#frase').textContent).toContain('no quité nada'), ESPERA)
    expect(alDeshacer()).toHaveLength(0)
  })

  it('elegir un candidato manda {elegir} (sin confirmado) y muestra SU confirmación; recién ahí «Sí, quitar» quita', async () => {
    red({
      proponer: () => ({ status: 200, cuerpo: preguntar }),
      deshacer: (c) => ('elegir' in c ? { status: 200, cuerpo: confirmar(String(c.elegir)) } : { status: 200, cuerpo: resultado('deshecho') }),
    })
    const u = userEvent.setup(); const { $ } = montar(conexion())
    await pedir(u, $)
    await u.click(await boton('Adherencia: marcada «sí», 12:40'))
    expect(await boton('Sí, quitar')).toBeInTheDocument()
    expect(alDeshacer()).toHaveLength(1)
    expect(alDeshacer()[0].cuerpo).toEqual({ elegir: ID_B })
    await u.click(screen.getByRole('button', { name: 'Sí, quitar' }))
    await waitFor(() => expect(alDeshacer()).toHaveLength(2), ESPERA)
    expect(alDeshacer()[1].cuerpo).toMatchObject({ tarjeta: TARJETA(ID_B), confirmado: true })
  })
})

describe('Praxis · deshacer: cada respuesta tiene su frase corta', () => {
  it.each([
    [200, 'deshecho', 'Listo, lo quité.'],
    [200, 'ya_deshecho', 'ya estaba quitado'],
    [200, 'cambio_despues', 'cambió después, así que no lo toqué'],
    [410, 'vencida', 'La tarjeta venció'],
    [409, 'otro_dia', 'Eso es de otro día'],
    [403, 'no_encontrado', 'No pude quitarlo ahora'],
  ])('%i %s', async (status, res, frase) => {
    red({ proponer: () => ({ status: 200, cuerpo: confirmar(ID_A) }), deshacer: () => ({ status, cuerpo: resultado(res) }) })
    const u = userEvent.setup(); const { $ } = montar(conexion())
    await pedir(u, $)
    await u.click(await boton('Sí, quitar'))
    await waitFor(() => expect($('#frase').textContent).toContain(frase), ESPERA)
    expect($('#frase').textContent).not.toContain('texto del servidor')
  })
})

describe('Praxis · deshacer: con el libro apagado todo sigue como siempre', () => {
  it('una respuesta de siempre (sin tipo:deshacer) pinta la tarjeta de Guardar y no toca /deshacer', async () => {
    const propuesta = { accion: 'tarjeta', registros: [{ campo: 'adherencia', fecha: HOY, estado: 'si', confianza: 'alta' }], descartado: [], notas_coach: [], citas_invalidas: [] }
    const tarjeta = { tipo: 'confirmacion', titulo: 'ADHERENCIA', lineas: [{ tarjeta_id: 'm:0', texto: 'Seguiste el plan: sí', editable: true }], avisos: [], descartado: [], botones: [{ id: 'guardar', texto: 'Guardar', primario: true }], requiereConfirmarSesion: false, guardable: true }
    red({ proponer: () => ({ status: 200, cuerpo: { propuesta, tarjeta, meta: {} } }), deshacer: () => ({ status: 200, cuerpo: resultado('deshecho') }) })
    const u = userEvent.setup(); const { $ } = montar(conexion())
    await pedir(u, $, 'hoy seguí el plan')
    expect(await boton('Guardar')).toBeInTheDocument()
    expect(screen.getByText('Seguiste el plan: sí')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sí, quitar' })).toBeNull()
    expect(alDeshacer()).toHaveLength(0)
  })
})
