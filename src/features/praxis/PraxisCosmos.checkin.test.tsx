import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LoQuePraxisVe } from '../../domain/praxis/plan/listaBlanca'
import { PraxisCosmos } from './PraxisCosmos'
import { reiniciarCheckinConectado } from './motor/checkinConectado'
import type { ConexionPraxis } from './motor/conexion'

/**
 * El check-in desde lo que la persona cuenta, en la pantalla de Praxis (conectores), con la conexión simulada.
 * Regla madre: nada se guarda sin el toque en la tarjeta. Frases inventadas por IA: no sirven para entrenar.
 */
vi.setConfig({ testTimeout: 30_000 })
const ESPERA = { timeout: 12_000 }
const USUARIO = 'u-prueba'
const veVacio: LoQuePraxisVe = { activo: null, cerrados: [], perfil: null, checkins: [], adherencias: [], hidratacionHoyMl: 0, aguaHoy: null, checkinHoy: null, adherenciaSemana: null, comida: null, falta: ['plan_activo', 'perfil', 'checkins', 'plan_de_comida'] }

function conexion(conCheckin = true, llenos: string[] = []) {
  const guardarCk = vi.fn<(p: unknown) => Promise<{ ok: true; parcial: boolean }>>(async () => ({ ok: true as const, parcial: true }))
  const proponer = vi.fn(async () => ({ ok: false as const, motivo: 'red' as const }))
  const c: ConexionPraxis = {
    usuarioId: USUARIO, hoy: '2026-11-07', leer: () => veVacio,
    proponer: proponer as unknown as ConexionPraxis['proponer'],
    guardar: vi.fn(async () => ({ ok: true as const, resultados: [] })),
    preguntar: vi.fn(async () => ({ ok: true as const, destinatario: 'coach' as const })),
    preguntas: vi.fn(async () => []),
    irAlFormulario: vi.fn(),
    ...(conCheckin ? { checkin: { yaHoy: () => llenos as never, lexico: vi.fn(async () => []), guardar: guardarCk } } : {}),
  }
  return { c, guardarCk, proponer }
}

function montar(c: ConexionPraxis) {
  const r = render(<MemoryRouter><PraxisCosmos trato="tu" conexion={c} /></MemoryRouter>)
  const raiz = r.container.querySelector('.praxis') as HTMLElement
  return { $: (s: string) => raiz.querySelector(s) as HTMLElement }
}
async function decir(u: ReturnType<typeof userEvent.setup>, $: (s: string) => HTMLElement, frase: string, primera = true) {
  if (primera) {
    await u.click(screen.getByRole('button', { name: 'Hablar con Praxis' }))
    await waitFor(() => expect((document.querySelector('#frase')?.textContent || '').length).toBeGreaterThan(5), ESPERA)
  }
  await u.type($('#entrada'), `${frase}{Enter}`)
}
const tarjeta = () => waitFor(() => { const t = document.querySelector('[data-k="checkin-conectado"]'); expect(t).not.toBeNull(); return t as HTMLElement }, ESPERA)

beforeEach(() => {
  localStorage.clear()
  reiniciarCheckinConectado()
  localStorage.setItem(`praxis.u.${USUARIO}.permisos`, JSON.stringify({ cConversacion: true, cRiesgo: true, fecha: '2026-11-07', version: 'v2' }))
  window.matchMedia = ((consulta: string) => ({
    matches: consulta.includes('prefers-reduced-motion'), media: consulta, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => { vi.restoreAllMocks() })

describe('Praxis · check-in desde lo que la persona cuenta', () => {
  it('arma la tarjeta en el teléfono, sin llamar al registrador; sin toque no guarda', async () => {
    const { c, guardarCk, proponer } = conexion()
    const u = userEvent.setup(); const { $ } = montar(c)
    await decir(u, $, 'Dormí fatal y el entreno no tan bien')
    const t = await tarjeta()
    expect(t.textContent).toContain('Calidad del sueño')
    expect(t.textContent).toContain('«Dormí fatal»')
    expect((t.querySelector('[data-k="ck-anotar"]') as HTMLButtonElement).disabled).toBe(true)
    expect(proponer).not.toHaveBeenCalled()
    expect(guardarCk).not.toHaveBeenCalled()
  })

  it('al tocar y anotar, guarda SOLO lo tocado y pregunta UNA cosa de lo que falta', async () => {
    const { c, guardarCk } = conexion(true, ['motivacion', 'hambreEscala', 'cansancio', 'estres', 'dolor', 'alimentacion', 'calidadSueno'])
    const u = userEvent.setup(); const { $ } = montar(c)
    await decir(u, $, 'Dormí fatal y el entreno no tan bien')
    const t = await tarjeta()
    await u.click(t.querySelector('[data-k="ck-calidadSueno-MALA"]') as HTMLElement)
    await u.click(document.querySelector('[data-k="ck-anotar"]') as HTMLElement)
    await waitFor(() => expect(guardarCk).toHaveBeenCalledTimes(1), ESPERA)
    expect(guardarCk.mock.calls[0][0]).toMatchObject({ confirmado: { parche: { calidadSueno: 'MALA' } } })
    // Lo único que falta es el rendimiento: Praxis pregunta eso, una sola cosa.
    await waitFor(() => expect($('#frase').textContent).toMatch(/entreno/i), ESPERA)
  })

  it('con la pregunta anterior, «ahí, como medio» se lee como respuesta a ESA pregunta', async () => {
    const { c } = conexion(true, ['motivacion', 'hambreEscala', 'cansancio', 'estres', 'dolor', 'alimentacion', 'calidadSueno'])
    const u = userEvent.setup(); const { $ } = montar(c)
    await decir(u, $, 'Dormí fatal')
    await u.click((await tarjeta()).querySelector('[data-k="ck-calidadSueno-MALA"]') as HTMLElement)
    await u.click(document.querySelector('[data-k="ck-anotar"]') as HTMLElement)
    await waitFor(() => expect($('#frase').textContent).toMatch(/entreno/i), ESPERA)
    await decir(u, $, 'ahí, como medio', false)
    const t = await tarjeta()
    expect(t.textContent).toContain('¿Cómo estuvo tu rendimiento?')
    expect((t.querySelector('[data-k="ck-rendimiento-REGULAR"]') as HTMLElement).dataset.propuesto).toBe('si')
  })

  it('las series siguen al registrador de siempre, aunque la frase también hable del sueño', async () => {
    const { c, proponer } = conexion()
    const u = userEvent.setup(); const { $ } = montar(c)
    await decir(u, $, 'hice 3 series de sentadilla con 60 kilos y dormí fatal')
    await waitFor(() => expect(proponer).toHaveBeenCalled(), ESPERA)
    expect(document.querySelector('[data-k="checkin-conectado"]')).toBeNull()
  })

  it('una frase con riesgo no se toma como check-in', async () => {
    const { c, guardarCk } = conexion()
    const u = userEvent.setup(); const { $ } = montar(c)
    await decir(u, $, 'dormí fatal y me duele mucho el pecho')
    // La pantalla pasa a su ruta de cuidado (borra la frase): se espera un rato y se mira que no haya tarjeta.
    await new Promise((r) => setTimeout(r, 2500))
    expect(document.querySelector('[data-k="checkin-conectado"]')).toBeNull()
    expect(guardarCk).not.toHaveBeenCalled()
  })

  it('con la bandera apagada (sin `checkin` en la conexión), la frase va al registrador como hoy', async () => {
    const { c, proponer } = conexion(false)
    const u = userEvent.setup(); const { $ } = montar(c)
    await decir(u, $, 'Dormí fatal y el entreno no tan bien')
    await waitFor(() => expect(proponer).toHaveBeenCalled(), ESPERA)
    expect(document.querySelector('[data-k="checkin-conectado"]')).toBeNull()
  })
})
