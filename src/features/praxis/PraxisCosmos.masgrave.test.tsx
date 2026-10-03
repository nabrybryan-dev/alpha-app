import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RespuestaDelRegistrador } from '../../domain/praxis/conversacion'
import type { MarcaDeRiesgo } from '../../domain/praxis/riesgo'
import type { LoQuePraxisVe } from '../../domain/praxis/plan/listaBlanca'
import type { PreguntaConRespuesta, ResultadoDejarPregunta } from '../../data/praxis/preguntasEnEspera'
import { PraxisCosmos } from './PraxisCosmos'
import { reiniciarVariantes } from './motor/charla'
import { Dia } from './motor/sesion'
import type { ConexionPraxis } from './motor/conexion'

/**
 * «Gana la lectura más grave» en la pantalla conectada (3-oct). El filtro marca cuidado o salud: su respuesta sale
 * YA, sin esperar; en paralelo y solo si la conexión trae `releerRiesgo` (el interruptor de consentimiento), el
 * modelo —aquí un doble que NO contesta hasta que el test lo decide— relee la frase. Si lo que vuelve es MÁS grave,
 * la pantalla sube (Quieta con la línea del modelo). Si falla o no es más grave, no cambia nada.
 * Sin relojes de pared: todo se afirma por ORDEN (qué se vio antes de que el modelo contestara).
 */
vi.setConfig({ testTimeout: 30_000 })
const ESPERA = { timeout: 12_000 }
const HOY = '2026-10-01'
const USUARIO = 'u-mas-grave'
const SALUD = 'me duele la rodilla izquierda'
const CUIDADO = 'me quiero morir con esta rutina de pierna'
const QUIETA = 'ya no quiero vivir'

const ve: LoQuePraxisVe = { activo: null, cerrados: [], perfil: { objetivos: 'Ganar fuerza' }, adherencias: [], hidratacionHoyMl: 0, comida: null, falta: ['plan_de_comida'], checkins: [] }
const charlaDelModelo = (texto: string): RespuestaDelRegistrador => ({
  ok: true, mensajeId: 'm-c', charla: texto,
  propuesta: { accion: 'nada', motivo: 'charla', registros: [], descartado: [], notas_coach: [], citas_invalidas: [] },
  tarjeta: { tipo: 'informativa', titulo: '', lineas: [], avisos: [], descartado: [], botones: [], requiereConfirmarSesion: false, guardable: false },
})

/** Un doble del lector que no contesta hasta que el test lo decida. */
function lectorEnEspera() {
  let contestar: (m: MarcaDeRiesgo | null) => void = () => {}
  let fallar: (e: unknown) => void = () => {}
  const lectura = new Promise<MarcaDeRiesgo | null>((res, rej) => { contestar = res; fallar = rej })
  return { lectura, contestar, fallar }
}

function crear(releer?: ConexionPraxis['releerRiesgo']) {
  return {
    usuarioId: USUARIO, nombre: 'Bryan', hoy: HOY,
    leer: vi.fn(() => ve),
    proponer: vi.fn<ConexionPraxis['proponer']>(async () => charlaDelModelo('Aquí estoy. ¿Qué anotamos hoy?')),
    guardar: vi.fn(async () => ({ ok: true as const, resultados: [] })),
    preguntar: vi.fn(async (): Promise<ResultadoDejarPregunta> => ({ ok: true, destinatario: 'coach' })),
    preguntas: vi.fn(async (): Promise<PreguntaConRespuesta[]> => []),
    irAlFormulario: vi.fn(),
    ...(releer ? { releerRiesgo: vi.fn<NonNullable<ConexionPraxis['releerRiesgo']>>(releer) } : {}),
  } satisfies ConexionPraxis
}
function montar(c: ConexionPraxis) {
  const r = render(<MemoryRouter><PraxisCosmos trato="tu" conexion={c} /></MemoryRouter>)
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

beforeEach(() => {
  reiniciarVariantes()
  localStorage.clear()
  localStorage.setItem(`praxis.u.${USUARIO}.permisos`, JSON.stringify({ cConversacion: true, cRiesgo: true, fecha: HOY, version: 'v2' }))
  window.matchMedia = ((q: string) => ({ matches: q.includes('prefers-reduced-motion'), media: q, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('Praxis conectada · el filtro marca salud: primero su respuesta, luego el modelo puede subirla', () => {
  it('«me duele la rodilla»: el texto de salud sale ANTES de que el modelo conteste; si luego lee urgencia, entra la Quieta con 123', async () => {
    const lector = lectorEnEspera()
    const u = userEvent.setup()
    const c = crear(() => lector.lectura)
    const { $, raiz } = montar(c)
    await abrir(u)
    await decirle(u, $, SALUD)

    // 1. La respuesta del filtro, sin esperar al modelo (que todavía no contestó).
    await waitFor(() => expect(frase($)).toContain('Eso es de salud'), ESPERA)
    expect(c.releerRiesgo).toHaveBeenCalledTimes(1)
    expect(c.releerRiesgo).toHaveBeenCalledWith(SALUD)
    expect(raiz.querySelector('.quieta')).toBeNull()

    // 2. El modelo lee urgencia: la Quieta con la línea del MODELO.
    lector.contestar({ tipo: 'quieta', linea: 'vida' })
    await waitFor(() => expect(raiz.querySelector('.quieta')).not.toBeNull(), ESPERA)
    expect(raiz.querySelector('.quieta a[href="tel:123"]')).not.toBeNull()
  })

  it('la Quieta que sube lleva la línea de lo que leyó el modelo (pareja → 155; niño → 141), no la de vida', async () => {
    const pareja = lectorEnEspera()
    const u = userEvent.setup()
    const c = crear(() => pareja.lectura)
    const { $, raiz } = montar(c)
    await abrir(u)
    await decirle(u, $, SALUD)
    await waitFor(() => expect(frase($)).toContain('Eso es de salud'), ESPERA)
    pareja.contestar({ tipo: 'quieta', linea: 'pareja' })
    await waitFor(() => expect(raiz.querySelector('.quieta a[href="tel:155"]')).not.toBeNull(), ESPERA)
    expect(raiz.querySelector('.quieta a[href="tel:141"]')).toBeNull()
  })

  it('salud → el modelo lee cuidado: Praxis hace la pregunta de cuidado, sin repetir la frase de la persona', async () => {
    const lector = lectorEnEspera()
    const u = userEvent.setup()
    const c = crear(() => lector.lectura)
    const { $, raiz } = montar(c)
    await abrir(u)
    await decirle(u, $, SALUD)
    await waitFor(() => expect(frase($)).toContain('Eso es de salud'), ESPERA)
    lector.contestar({ tipo: 'cuidado' })
    await waitFor(() => expect(frase($)).toContain('hacerte daño'), ESPERA)
    expect(raiz.querySelector('.quieta')).toBeNull()
  })

  it('el modelo falla, rechaza o no dice nada: se queda el texto de salud (nunca silencio ni una marca menor)', async () => {
    for (const modo of ['null', 'rechaza', 'salud'] as const) {
      const lector = lectorEnEspera()
      const u = userEvent.setup()
      const c = crear(() => lector.lectura)
      const { $, raiz } = montar(c)
      await abrir(u)
      await decirle(u, $, SALUD)
      await waitFor(() => expect(frase($)).toContain('Eso es de salud'), ESPERA)
      await screen.findByRole('button', { name: 'Abrir el formulario' }, ESPERA)
      if (modo === 'null') lector.contestar(null)
      else if (modo === 'rechaza') lector.fallar(new Error('red'))
      else lector.contestar({ tipo: 'salud', filtro: 'sintoma' })
      await Promise.resolve(); await Promise.resolve()
      await waitFor(() => expect(c.releerRiesgo).toHaveBeenCalledTimes(1), ESPERA)
      expect(frase($)).toContain('Eso es de salud')
      expect(screen.getByRole('button', { name: 'Abrir el formulario' })).toBeInTheDocument()
      expect(raiz.querySelector('.quieta')).toBeNull()
      cleanup()
    }
  })

  it('sin el interruptor (la conexión no trae releerRiesgo) la frase marcada no sale: ni modelo, ni registrador', async () => {
    const u = userEvent.setup()
    const c = crear()
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, SALUD)
    await waitFor(() => expect(frase($)).toContain('Eso es de salud'), ESPERA)
    expect('releerRiesgo' in c).toBe(false)
    expect(c.proponer).not.toHaveBeenCalled()
  })
})

describe('Praxis conectada · el filtro marca cuidado', () => {
  it('la pregunta de cuidado sale ya; si el modelo lee Quieta, se detiene con la línea del modelo', async () => {
    const lector = lectorEnEspera()
    const u = userEvent.setup()
    const c = crear(() => lector.lectura)
    const { $, raiz } = montar(c)
    await abrir(u)
    await decirle(u, $, CUIDADO)
    await waitFor(() => expect(frase($)).toContain('hacerte daño'), ESPERA)
    expect(c.releerRiesgo).toHaveBeenCalledWith(CUIDADO)
    expect(raiz.querySelector('.quieta')).toBeNull()
    lector.contestar({ tipo: 'quieta', linea: 'nino' })
    await waitFor(() => expect(raiz.querySelector('.quieta a[href="tel:141"]')).not.toBeNull(), ESPERA)
  })

  it('el modelo no puede BAJAR la pregunta de cuidado: si lee salud, sigue la pregunta', async () => {
    const lector = lectorEnEspera()
    const u = userEvent.setup()
    const c = crear(() => lector.lectura)
    const { $, raiz } = montar(c)
    await abrir(u)
    await decirle(u, $, CUIDADO)
    await waitFor(() => expect(frase($)).toContain('hacerte daño'), ESPERA)
    lector.contestar({ tipo: 'salud', filtro: 'sintoma' })
    await Promise.resolve(); await Promise.resolve()
    expect(frase($)).toContain('hacerte daño')
    expect(raiz.querySelector('.quieta')).toBeNull()
  })
})

describe('Praxis conectada · el filtro marca Quieta: nada cambia ni espera', () => {
  it('la Quieta sale al instante y el modelo NO se consulta', async () => {
    const u = userEvent.setup()
    const c = crear(() => new Promise<MarcaDeRiesgo | null>(() => {})) // si se llamara, nunca contestaría: la Quieta no lo esperaría
    const { $, raiz } = montar(c)
    await abrir(u)
    await decirle(u, $, QUIETA)
    await waitFor(() => expect(raiz.querySelector('.quieta a[href="tel:123"]')).not.toBeNull(), ESPERA)
    expect(c.releerRiesgo).not.toHaveBeenCalled()
    expect(c.proponer).not.toHaveBeenCalled()
  })
})

describe('Praxis conectada · la frase marcada sigue sin entrar al hilo, sin guardar y sin tarjetas', () => {
  it('con el modelo releyendo, la frase marcada no viaja como contexto de la charla ni crea tarjeta ni guarda', async () => {
    const u = userEvent.setup()
    const c = crear(async () => ({ tipo: 'salud', filtro: 'sintoma' }))
    const { $, raiz } = montar(c)
    await abrir(u)
    await decirle(u, $, SALUD)
    await waitFor(() => expect(c.releerRiesgo).toHaveBeenCalledTimes(1), ESPERA)
    await decirle(u, $, '¿qué me cuentas?')
    await waitFor(() => expect(c.proponer).toHaveBeenCalledTimes(1), ESPERA)
    const turnos = c.proponer.mock.calls[0][2]?.charla?.turnos ?? []
    expect(JSON.stringify(turnos)).not.toMatch(/rodilla|salud/i)
    expect(c.guardar).not.toHaveBeenCalled()
    expect(c.preguntar).not.toHaveBeenCalled()
    expect(raiz.querySelector('.tarjeta-registro')).toBeNull()
  })

  it('la frase marcada NUNCA va por proponer (no es el registrador quien la lee)', async () => {
    const u = userEvent.setup()
    const c = crear(async () => ({ tipo: 'cuidado' }))
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, SALUD)
    await waitFor(() => expect(c.releerRiesgo).toHaveBeenCalledTimes(1), ESPERA)
    expect(c.proponer).not.toHaveBeenCalled()
  })
})

describe('Praxis conectada · el permiso nuevo y los textos (Bryan, 3-oct)', () => {
  it('quien aceptó el permiso VIEJO (v1) ve los permisos otra vez y Praxis no se activa hasta aceptar', async () => {
    localStorage.setItem(`praxis.u.${USUARIO}.permisos`, JSON.stringify({ cConversacion: true, cRiesgo: true, fecha: HOY, version: 'v1' }))
    const u = userEvent.setup()
    const c = crear(async () => null)
    const { $ } = montar(c)
    await u.click(screen.getByRole('button', { name: 'Hablar con Praxis' }))
    const acepto = await screen.findByRole('button', { name: 'Acepto y empiezo' }, ESPERA)
    expect(c.leer).toBeDefined()
    expect(($('#frase').textContent || '')).toContain('Antes de empezar')
    expect(c.proponer).not.toHaveBeenCalled()
    await u.click(acepto)
    await waitFor(() => expect(JSON.parse(localStorage.getItem(`praxis.u.${USUARIO}.permisos`) || '{}').version).toBe('v2'), ESPERA)
  })

  it('con el permiso viejo NO se envía la frase marcada (aunque la sala siga abierta)', async () => {
    const u = userEvent.setup()
    const c = crear(async () => ({ tipo: 'quieta', linea: 'vida' }))
    const { $ } = montar(c)
    await abrir(u)
    Dia.permisos = { ...(Dia.permisos as object), version: 'v1' } as never
    await decirle(u, $, SALUD)
    await waitFor(() => expect(frase($)).toContain('Eso es de salud'), ESPERA)
    expect(c.releerRiesgo).not.toHaveBeenCalled()
  })

  it('la Quieta que subió el modelo dice que se leyó (no que no se envió); la del filtro sigue igual', async () => {
    const lector = lectorEnEspera()
    const u = userEvent.setup()
    const c = crear(() => lector.lectura)
    const { $, raiz } = montar(c)
    await abrir(u)
    await decirle(u, $, SALUD)
    await waitFor(() => expect(frase($)).toContain('Eso es de salud'), ESPERA)
    lector.contestar({ tipo: 'quieta', linea: 'vida' })
    await waitFor(() => expect(raiz.querySelector('.quieta')).not.toBeNull(), ESPERA)
    const texto = raiz.querySelector('.quieta')?.textContent || ''
    expect(texto).toContain('Se leyó solo para decidir detenerme')
    expect(texto).not.toContain('ni se envió')
  })

  it('la Quieta que puso el filtro dice, como hoy, que no se guardó ni se envió', async () => {
    const u = userEvent.setup()
    const c = crear(async () => null)
    const { $, raiz } = montar(c)
    await abrir(u)
    await decirle(u, $, QUIETA)
    await waitFor(() => expect(raiz.querySelector('.quieta')).not.toBeNull(), ESPERA)
    expect(raiz.querySelector('.quieta')?.textContent).toContain('no se guardó ni se envió')
  })

  it('el texto de privacidad ya no promete que lo marcado no sale: dice qué se envía y por qué', async () => {
    const u = userEvent.setup()
    const { raiz } = montar(crear())
    await abrir(u)
    const t = raiz.textContent || ''
    expect(t).toContain('esa frase no sale de este teléfono')
    expect(t).toContain('se envía a ese servicio solo para leerla mejor')
    expect(t).toContain('esa frase se lee con inteligencia artificial')
    expect(t).not.toContain('no llega a ese servicio')
    expect(t).not.toContain('no sale de este teléfono: no se anota')
  })
})
