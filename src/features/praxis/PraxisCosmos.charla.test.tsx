import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RespuestaDelRegistrador } from '../../domain/praxis/conversacion'
import type { LoQuePraxisVe } from '../../domain/praxis/plan/listaBlanca'
import type { PreguntaConRespuesta, ResultadoDejarPregunta } from '../../data/praxis/preguntasEnEspera'
import { PraxisCosmos } from './PraxisCosmos'
import type { ConexionPraxis } from './motor/conexion'
import type { Trato } from './motor/entorno'
import { Voz } from './motor/voz'

/**
 * La charla básica en la pantalla conectada: «hola», «gracias», «quién eres» se contestan
 * aquí, sin llamar al registrador (0 ms, 0 tokens), con el mismo texto y la misma voz que
 * todo lo demás de Praxis, y sin guardar ni crear tarjetas. Lo de salud o de riesgo va primero.
 */
vi.setConfig({ testTimeout: 30_000 })
const ESPERA = { timeout: 12_000 }
const HOY = '2026-10-01'
const USUARIO = 'u-charla'

const ve: LoQuePraxisVe = { activo: null, cerrados: [], perfil: { objetivos: 'Ganar fuerza' }, adherencias: [], hidratacionHoyMl: 0, comida: null, falta: ['plan_de_comida'], checkins: [] }
const propuesta: RespuestaDelRegistrador = {
  ok: true, mensajeId: 'm-1',
  propuesta: { accion: 'tarjeta', registros: [{ campo: 'adherencia', fecha: HOY, estado: 'si', confianza: 'alta' }], descartado: [], notas_coach: [], citas_invalidas: [] },
  tarjeta: { tipo: 'confirmacion', titulo: 'SENTADILLA', lineas: [{ tarjeta_id: 'm-1:0', texto: 'SENTADILLA · serie 1 · 60 kg × 4', editable: true }], avisos: [], descartado: [], botones: [{ id: 'guardar', texto: 'Guardar', primario: true }], requiereConfirmarSesion: false, guardable: true },
}

function crear() {
  return {
    usuarioId: USUARIO, hoy: HOY,
    leer: vi.fn(() => ve),
    proponer: vi.fn<ConexionPraxis['proponer']>(async () => propuesta),
    guardar: vi.fn(async () => ({ ok: true as const, resultados: [] })),
    preguntar: vi.fn(async (): Promise<ResultadoDejarPregunta> => ({ ok: true, destinatario: 'coach' })),
    preguntas: vi.fn(async (): Promise<PreguntaConRespuesta[]> => []),
    irAlFormulario: vi.fn(),
  } satisfies ConexionPraxis
}
function montar(c: ConexionPraxis, trato: Trato = 'tu') {
  const r = render(<MemoryRouter><PraxisCosmos trato={trato} conexion={c} /></MemoryRouter>)
  const raiz = r.container.querySelector('.praxis') as HTMLElement
  const $ = (s: string) => raiz.querySelector(s) as HTMLElement
  return { raiz, $ }
}
async function abrir(u: ReturnType<typeof userEvent.setup>) {
  await u.click(screen.getByRole('button', { name: 'Hablar con Praxis' }))
  await waitFor(() => expect((document.querySelector('#frase')?.textContent || '').length).toBeGreaterThan(5), ESPERA)
}
const decirle = (u: ReturnType<typeof userEvent.setup>, $: (s: string) => HTMLElement, texto: string) => u.type($('#entrada'), `${texto}{Enter}`)
const frase = ($: (s: string) => HTMLElement) => ($('#frase').textContent || '').trim()
/** Fija la hora local sin tocar los temporizadores (los waitFor siguen andando). */
function aLas(h: number): void {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 1, h, 0, 0))
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(`praxis.u.${USUARIO}.permisos`, JSON.stringify({ cConversacion: true, cRiesgo: true, fecha: HOY, version: 'v1' }))
  window.matchMedia = ((q: string) => ({ matches: q.includes('prefers-reduced-motion'), media: q, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('Praxis conectada · charla básica, local y al instante', () => {
  it('«hola» se contesta al instante por la hora, SIN llamar al registrador ni guardar, y sin tarjeta', async () => {
    aLas(9)
    const u = userEvent.setup()
    const c = crear()
    const { $, raiz } = montar(c)
    await abrir(u)
    await decirle(u, $, 'hola')
    await waitFor(() => expect(frase($)).toBe('Buenos días. ¿Cómo amaneciste?'), ESPERA)
    expect(c.proponer).not.toHaveBeenCalled()
    expect(c.guardar).not.toHaveBeenCalled()
    expect(c.preguntar).not.toHaveBeenCalled()
    expect(raiz.querySelector('.tarjeta-registro')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
    expect($('#dijo').textContent).toContain('«hola»')
  })

  it('se dice con la misma voz que las demás respuestas de Praxis', async () => {
    aLas(15)
    const decirVoz = vi.spyOn(Voz, 'decir')
    const u = userEvent.setup()
    const { $ } = montar(crear())
    await abrir(u)
    decirVoz.mockClear()
    await decirle(u, $, 'buenas')
    await waitFor(() => expect(frase($)).toBe('Buenas tardes. ¿Cómo va tu día?'), ESPERA)
    expect(decirVoz).toHaveBeenCalledWith('Buenas tardes. ¿Cómo va tu día?', expect.anything(), expect.anything(), expect.anything())
  })

  it('en usted, con su saludo de la noche', async () => {
    aLas(21)
    const u = userEvent.setup()
    const c = crear()
    const { $ } = montar(c, 'usted')
    await abrir(u)
    await decirle(u, $, 'buenas noches')
    await waitFor(() => expect(frase($)).toBe('Buenas noches. ¿Cómo le fue hoy?'), ESPERA)
    expect(c.proponer).not.toHaveBeenCalled()
  })

  it('«¿cómo estás?» no se contesta como una pregunta del plan', async () => {
    const u = userEvent.setup()
    const c = crear()
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, '¿Cómo estás?')
    await waitFor(() => expect(frase($)).toBe('Bien, gracias por preguntar. ¿Y tú, cómo vas?'), ESPERA)
    expect(c.proponer).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /pregúntale/ })).not.toBeInTheDocument()
  })

  it('«bien» solo es respuesta de ánimo después de que Praxis preguntó; sin pregunta va al registrador', async () => {
    const u = userEvent.setup()
    const c = crear()
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'bien') // sin pregunta antes: flujo normal
    await waitFor(() => expect(c.proponer).toHaveBeenCalledTimes(1), ESPERA)
    expect(c.proponer.mock.calls[0][0]).toBe('bien')
    await u.click(await screen.findByRole('button', { name: 'Descartar' }, ESPERA))

    await decirle(u, $, 'hola')
    await waitFor(() => expect(frase($)).toMatch(/^Buen/), ESPERA)
    await decirle(u, $, 'bien') // ahora sí es la respuesta
    await waitFor(() => expect(frase($)).toBe('Me alegra. ¿Qué anotamos hoy?'), ESPERA)
    expect(c.proponer).toHaveBeenCalledTimes(1) // el segundo «bien» no llegó al servidor

    await decirle(u, $, 'bien') // la pregunta ya se contestó: otra vez es flujo normal
    await waitFor(() => expect(c.proponer).toHaveBeenCalledTimes(2), ESPERA)
  })

  it('una respuesta de ánimo mala se acoge y ofrece anotar', async () => {
    const u = userEvent.setup()
    const c = crear()
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'qué tal')
    await waitFor(() => expect(frase($)).toContain('¿Y tú, cómo vas?'), ESPERA)
    await decirle(u, $, 'cansada')
    await waitFor(() => expect(frase($)).toBe('Gracias por contarme. ¿Es el cuerpo, el sueño o el día? Si quieres, lo anoto.'), ESPERA)
    expect(c.proponer).not.toHaveBeenCalled()
  })

  it('«hola, hice 4 series de sentadilla con 60» NO es charla: va al registrador como siempre', async () => {
    const u = userEvent.setup()
    const c = crear()
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'hola, hice 4 series de sentadilla con 60')
    await waitFor(() => expect(c.proponer).toHaveBeenCalledTimes(1), ESPERA)
    expect(c.proponer.mock.calls[0][0]).toBe('hola, hice 4 series de sentadilla con 60')
    expect(await screen.findByRole('button', { name: 'Guardar' }, ESPERA)).toBeInTheDocument()
  })

  it('«hola, ya no quiero vivir» NUNCA es charla: la Quieta, y nada llega al registrador', async () => {
    const u = userEvent.setup()
    const c = crear()
    const { $, raiz } = montar(c)
    await abrir(u)
    await decirle(u, $, 'hola, ya no quiero vivir')
    await waitFor(() => expect(raiz.querySelector('.quieta')).not.toBeNull(), ESPERA)
    expect(raiz.querySelector('.quieta a[href="tel:123"]')).not.toBeNull()
    expect(frase($)).not.toMatch(/Buenos|Buenas|Hola/)
    expect(c.proponer).not.toHaveBeenCalled()
  })

  it('«gracias» y «quién eres» también, cada una con su texto', async () => {
    const u = userEvent.setup()
    const c = crear()
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'gracias')
    await waitFor(() => expect(frase($)).toBe('Con mucho gusto.'), ESPERA)
    await decirle(u, $, 'quién eres')
    await waitFor(() => expect(frase($)).toContain('Soy Praxis, la guía de hábitos de Alpha. Anoto tu entrenamiento'), ESPERA)
    expect(c.proponer).not.toHaveBeenCalled()
  })

  it('«buenas noches» al empezar saluda; después de haber hablado, se despide', async () => {
    aLas(21)
    const u = userEvent.setup()
    const c = crear()
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'gracias')
    await waitFor(() => expect(frase($)).toBe('Con mucho gusto.'), ESPERA)
    await decirle(u, $, 'buenas noches')
    await waitFor(() => expect(frase($)).toBe('Que descanses. Aquí estoy mañana.'), ESPERA)
    expect(c.proponer).not.toHaveBeenCalled()
  })
})
