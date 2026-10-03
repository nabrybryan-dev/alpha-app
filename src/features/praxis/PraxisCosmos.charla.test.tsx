import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RespuestaDelRegistrador } from '../../domain/praxis/conversacion'
import type { LoQuePraxisVe } from '../../domain/praxis/plan/listaBlanca'
import type { PreguntaConRespuesta, ResultadoDejarPregunta } from '../../data/praxis/preguntasEnEspera'
import { PraxisCosmos } from './PraxisCosmos'
import { aperturasPosibles, colasPosibles, reiniciarVariantes, textosPosibles } from './motor/charla'
import type { ConexionPraxis } from './motor/conexion'
import { limitesDeCharla } from './motor/conversacion'
import type { Trato } from './motor/entorno'
import { Voz } from './motor/voz'

/**
 * La charla en la pantalla conectada (3-oct): «gracias», «quién eres», «chao» se contestan aquí mismo; el saludo, el
 * «¿cómo estás?» y lo que el plan no puede contestar van al MODELO (la misma llamada del registrador), con una
 * apertura corta que se dice al instante. Si el modelo falla o tarda, el libreto local. La charla no guarda nada,
 * no crea tarjetas y lo marcado por el filtro de riesgo nunca llega a ella. El modelo aquí es un doble.
 */
vi.setConfig({ testTimeout: 30_000 })
const ESPERA = { timeout: 12_000 }
const HOY = '2026-10-01'
const USUARIO = 'u-charla'
const HORA = 9

const ve: LoQuePraxisVe = { activo: null, cerrados: [], perfil: { objetivos: 'Ganar fuerza' }, adherencias: [], hidratacionHoyMl: 0, comida: null, falta: ['plan_de_comida'], checkins: [] }
const tarjetaDeSentadilla: RespuestaDelRegistrador = {
  ok: true, mensajeId: 'm-1',
  propuesta: { accion: 'tarjeta', registros: [{ campo: 'adherencia', fecha: HOY, estado: 'si', confianza: 'alta' }], descartado: [], notas_coach: [], citas_invalidas: [] },
  tarjeta: { tipo: 'confirmacion', titulo: 'SENTADILLA', lineas: [{ tarjeta_id: 'm-1:0', texto: 'SENTADILLA · serie 1 · 60 kg × 4', editable: true }], avisos: [], descartado: [], botones: [{ id: 'guardar', texto: 'Guardar', primario: true }], requiereConfirmarSesion: false, guardable: true },
}
/** Lo que devuelve el servidor cuando la frase es charla: sin registros, sin tarjeta guardable, y el texto del modelo. */
const charlaDelModelo = (texto: string): RespuestaDelRegistrador => ({
  ok: true, mensajeId: 'm-c', charla: texto,
  propuesta: { accion: 'nada', motivo: 'charla', registros: [], descartado: [], notas_coach: [], citas_invalidas: [] },
  tarjeta: { tipo: 'informativa', titulo: '', lineas: [], avisos: [], descartado: [], botones: [], requiereConfirmarSesion: false, guardable: false },
})

function crear(proponer?: ConexionPraxis['proponer'], nombre: string | null = 'Bryan') {
  return {
    usuarioId: USUARIO, nombre, hoy: HOY,
    leer: vi.fn(() => ve),
    proponer: vi.fn<ConexionPraxis['proponer']>(proponer ?? (async () => tarjetaDeSentadilla)),
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
/** Un doble del modelo que NO contesta hasta que el test lo decida: así se prueba lo que pasa MIENTRAS piensa. */
function modeloEnEspera() {
  let resolver: (r: RespuestaDelRegistrador) => void = () => {}
  const respuesta = new Promise<RespuestaDelRegistrador>((r) => { resolver = r })
  return { respuesta, contestar: resolver }
}

beforeEach(() => {
  reiniciarVariantes()
  limitesDeCharla.esperaMs = 7000
  localStorage.clear()
  localStorage.setItem(`praxis.u.${USUARIO}.permisos`, JSON.stringify({ cConversacion: true, cRiesgo: true, fecha: HOY, version: 'v1' }))
  window.matchMedia = ((q: string) => ({ matches: q.includes('prefers-reduced-motion'), media: q, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('Praxis conectada · la charla la lleva el modelo, con una entrada al instante', () => {
  it('«hola»: primero la apertura, luego el modelo la continúa SIN repetir el saludo; nada se guarda y no hay tarjeta', async () => {
    aLas(HORA)
    const modelo = modeloEnEspera()
    const orden: string[] = []
    const decirVoz = vi.spyOn(Voz, 'decir').mockImplementation((t: string) => { orden.push(t); return false })
    const u = userEvent.setup()
    const c = crear(() => modelo.respuesta)
    const { $, raiz } = montar(c)
    await abrir(u)
    orden.length = 0
    await decirle(u, $, 'hola')

    // 1. La apertura sale ya, mientras el modelo sigue sin contestar.
    await waitFor(() => expect(aperturasPosibles(HORA, 'Bryan')).toContain(frase($)), ESPERA)
    const apertura = frase($)
    expect(c.proponer).toHaveBeenCalledTimes(1)
    const [fraseEnviada, , contexto] = c.proponer.mock.calls[0]
    expect(fraseEnviada).toBe('hola')
    expect(contexto?.charla).toMatchObject({ trato: 'tu', nombre: 'Bryan', turnos: [], apertura })

    // 2. El modelo contesta con un saludo repetido: la pantalla lo continúa, no lo repite.
    modelo.contestar(charlaDelModelo('Hola, Bryan. ¿Cómo amaneciste hoy?'))
    await waitFor(() => expect(frase($)).toBe('¿Cómo amaneciste hoy?'), ESPERA)
    expect(orden).toEqual([apertura, '¿Cómo amaneciste hoy?']) // por orden, no por milisegundos
    expect(decirVoz).toHaveBeenCalled()

    // 3. La charla no guarda, no pregunta al coach y no monta tarjeta.
    expect(c.guardar).not.toHaveBeenCalled()
    expect(c.preguntar).not.toHaveBeenCalled()
    expect(raiz.querySelector('.tarjeta-registro')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
  })

  it('una pregunta que no es del plan («¿qué me cuentas?») va al modelo, sin apertura, y no ofrece preguntarle al coach', async () => {
    const u = userEvent.setup()
    const c = crear(async () => charlaDelModelo('Por aquí todo tranquilo. ¿Y tú, cómo vas con el entreno esta semana?'))
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, '¿Qué me cuentas?')
    await waitFor(() => expect(frase($)).toBe('Por aquí todo tranquilo. ¿Y tú, cómo vas con el entreno esta semana?'), ESPERA)
    expect(c.proponer).toHaveBeenCalledTimes(1)
    expect(c.proponer.mock.calls[0][2]?.charla?.apertura).toBeNull()
    expect(screen.queryByRole('button', { name: /pregúntale/ })).not.toBeInTheDocument()
  })

  it('«hola, hice 4 series de sentadilla con 60» NO es charla: sin apertura, va al registrador y se confirma con un toque', async () => {
    const u = userEvent.setup()
    const c = crear()
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'hola, hice 4 series de sentadilla con 60')
    await waitFor(() => expect(c.proponer).toHaveBeenCalledTimes(1), ESPERA)
    expect(c.proponer.mock.calls[0][0]).toBe('hola, hice 4 series de sentadilla con 60')
    expect(c.proponer.mock.calls[0][2]?.charla?.apertura).toBeNull()
    expect(await screen.findByRole('button', { name: 'Guardar' }, ESPERA)).toBeInTheDocument()
    expect(c.guardar).not.toHaveBeenCalled()
  })

  it('si el modelo contesta con una tarjeta y con texto de charla a la vez, gana la tarjeta: la charla nunca la tapa', async () => {
    const u = userEvent.setup()
    const c = crear(async () => ({ ...tarjetaDeSentadilla, charla: 'Qué bien que entrenaste hoy.' }) as RespuestaDelRegistrador)
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'estuve entrenando fuerte')
    expect(await screen.findByRole('button', { name: 'Guardar' }, ESPERA)).toBeInTheDocument()
    expect(frase($)).not.toContain('Qué bien que entrenaste')
  })
})

describe('Praxis conectada · si el modelo falla o tarda, el libreto local (nunca silencio, nunca «no te entendí»)', () => {
  const FALLOS = [
    ['la red se cae', { ok: false, motivo: 'red' }],
    ['la sesión venció (401)', { ok: false, motivo: 'sin_sesion' }],
    ['el servidor no entiende (502)', { ok: false, motivo: 'no_entendi' }],
    ['la función no está desplegada (404)', { ok: false, motivo: 'no_desplegada' }],
    ['demasiados mensajes (429)', { ok: false, motivo: 'limite' }],
  ] as const
  it.each(FALLOS)('«hola» cuando %s: la apertura y luego la cola del libreto', async (_nombre, fallo) => {
    aLas(HORA)
    const u = userEvent.setup()
    const c = crear(async () => fallo)
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'hola')
    await waitFor(() => expect(colasPosibles(HORA, 'tu')).toContain(frase($)), ESPERA)
    expect(frase($)).not.toMatch(/no te entend|no entend|se cay|no anot/i)
    expect(c.guardar).not.toHaveBeenCalled()
  })

  it('el modelo no contesta nunca: pasado el tiempo máximo, el libreto', async () => {
    limitesDeCharla.esperaMs = 0
    const u = userEvent.setup()
    const c = crear(() => new Promise<RespuestaDelRegistrador>(() => {}))
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, '¿cómo estás?')
    await waitFor(() => expect(textosPosibles('estado', 'tu')).toContain(frase($)), ESPERA)
  })

  it('una pregunta suelta cuando el servidor falla: una pista concreta, no «no te entendí» ni silencio', async () => {
    const u = userEvent.setup()
    const c = crear(async () => ({ ok: false, motivo: 'red' }))
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, '¿qué me cuentas?')
    await waitFor(() => expect(textosPosibles('suelta', 'tu')).toContain(frase($)), ESPERA)
  })

  it('una frase suelta que no es saludo ni pregunta («bueno, ya veremos») cuando el servidor falla: una pista concreta, no silencio', async () => {
    const u = userEvent.setup()
    const c = crear(async () => ({ ok: false, motivo: 'red' }))
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'bueno, ya veremos')
    await waitFor(() => expect(textosPosibles('suelta', 'tu')).toContain(frase($)), ESPERA)
    expect(c.proponer).toHaveBeenCalledTimes(1)
  })

  it('el modelo contesta sin nada útil (charla sin texto): el libreto, no «no encontré nada que anotar»', async () => {
    aLas(HORA)
    const sinTexto: RespuestaDelRegistrador = { ...(charlaDelModelo('x') as Extract<RespuestaDelRegistrador, { ok: true }>), charla: undefined }
    const u = userEvent.setup()
    const c = crear(async () => sinTexto)
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'hola')
    await waitFor(() => expect(colasPosibles(HORA, 'tu')).toContain(frase($)), ESPERA)
  })

  it('una frase de registro cuando el servidor falla SIGUE diciendo la verdad: no anotó nada (no se disfraza de charla)', async () => {
    const u = userEvent.setup()
    const c = crear(async () => ({ ok: false, motivo: 'red' }))
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'hice 4 series de sentadilla con 60')
    await waitFor(() => expect(frase($)).toContain('no anoté nada'), ESPERA)
    expect(c.guardar).not.toHaveBeenCalled()
  })
})

describe('Praxis conectada · lo marcado por el filtro de riesgo NUNCA llega a la charla', () => {
  it('«hola, ya no quiero vivir»: la Quieta, y ni el saludo ni el modelo', async () => {
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

  it('«hola, me duele la rodilla»: el texto de salud de siempre, sin charla ni modelo', async () => {
    const u = userEvent.setup()
    const c = crear()
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'hola, me duele la rodilla')
    await waitFor(() => expect(frase($)).toContain('Eso es de salud'), ESPERA)
    expect(c.proponer).not.toHaveBeenCalled()
  })

  it('una frase marcada no viaja después como contexto de la charla (tampoco lo que Praxis contestó)', async () => {
    const u = userEvent.setup()
    const c = crear(async () => charlaDelModelo('Aquí estoy. ¿Qué anotamos hoy?'))
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'gracias') // local: entra al hilo
    await waitFor(() => expect(textosPosibles('gracias', 'tu')).toContain(frase($)), ESPERA)
    await decirle(u, $, 'me duele la rodilla izquierda') // salud: NO entra al hilo
    await waitFor(() => expect(frase($)).toContain('Eso es de salud'), ESPERA)
    await decirle(u, $, '¿qué me cuentas?')
    await waitFor(() => expect(c.proponer).toHaveBeenCalledTimes(1), ESPERA)
    const turnos = c.proponer.mock.calls[0][2]?.charla?.turnos ?? []
    expect(turnos.map((t) => t.rol)).toEqual(['persona', 'praxis']) // solo el «gracias» y su respuesta
    expect(JSON.stringify(turnos)).not.toMatch(/rodilla|salud/i)
  })
})

describe('Praxis conectada · el hilo: máximo 6 turnos, solo de esta sesión, nunca guardado', () => {
  it('manda a lo sumo los últimos 6 turnos, del más viejo al más nuevo, y no escribe nada en el almacenamiento', async () => {
    const u = userEvent.setup()
    const c = crear(async () => charlaDelModelo('Va bien. ¿Y tú?'))
    const { $ } = montar(c)
    await abrir(u)
    for (let i = 1; i <= 5; i++) {
      await decirle(u, $, i % 2 ? 'gracias' : 'perdón')
      await waitFor(() => expect(frase($).length).toBeGreaterThan(2), ESPERA)
    }
    await decirle(u, $, '¿qué me cuentas?')
    await waitFor(() => expect(c.proponer).toHaveBeenCalledTimes(1), ESPERA)
    const turnos = c.proponer.mock.calls[0][2]?.charla?.turnos ?? []
    expect(turnos.length).toBeLessThanOrEqual(6)
    expect(turnos.length).toBe(6) // hubo 10 turnos antes
    expect(turnos[turnos.length - 1].rol).toBe('praxis')
    expect(JSON.stringify(turnos)).not.toContain('qué me cuentas') // la frase actual viaja aparte
    // Nada del hilo se guardó: ni en el almacenamiento ni por la conexión.
    const guardado = JSON.stringify(Object.fromEntries(Object.entries(localStorage)))
    expect(guardado).not.toMatch(/gracias|perd[oó]n|Con gusto|No pasa nada/)
    expect(c.guardar).not.toHaveBeenCalled()
    expect(c.preguntar).not.toHaveBeenCalled()
  })
})

describe('Praxis conectada · la charla local y la pregunta de ánimo', () => {
  it('si el modelo preguntó cómo va, «bien» es respuesta de ánimo y no llega al servidor otra vez', async () => {
    const u = userEvent.setup()
    const c = crear(async () => charlaDelModelo('¿Cómo va el día?'))
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'hola')
    await waitFor(() => expect(frase($)).toBe('¿Cómo va el día?'), ESPERA)
    await decirle(u, $, 'bien')
    await waitFor(() => expect(textosPosibles('animoBueno', 'tu')).toContain(frase($)), ESPERA)
    expect(c.proponer).toHaveBeenCalledTimes(1)
  })

  it('si el modelo NO preguntó, «bien» sigue su camino de siempre (al registrador)', async () => {
    const u = userEvent.setup()
    const c = crear(async () => charlaDelModelo('Buen día para entrenar.'))
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'hola')
    await waitFor(() => expect(frase($)).toBe('Buen día para entrenar.'), ESPERA)
    await decirle(u, $, 'bien')
    await waitFor(() => expect(c.proponer).toHaveBeenCalledTimes(2), ESPERA)
  })

  it('«gracias» y «quién eres» siguen siendo locales, cada una con su texto y sin tocar el servidor', async () => {
    const u = userEvent.setup()
    const c = crear()
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'gracias')
    await waitFor(() => expect(textosPosibles('gracias', 'tu')).toContain(frase($)), ESPERA)
    await decirle(u, $, 'quién eres')
    await waitFor(() => expect(textosPosibles('quien', 'tu')).toContain(frase($)), ESPERA)
    expect(c.proponer).not.toHaveBeenCalled()
  })

  it('«buenas noches» al empezar saluda (con el modelo); después de haber hablado, se despide (local)', async () => {
    aLas(21)
    const u = userEvent.setup()
    const c = crear(async () => charlaDelModelo('¿Cómo estuvo el día?'))
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'gracias')
    await waitFor(() => expect(textosPosibles('gracias', 'tu')).toContain(frase($)), ESPERA)
    await decirle(u, $, 'buenas noches')
    await waitFor(() => expect(textosPosibles('despedida', 'tu', 21)).toContain(frase($)), ESPERA)
    expect(c.proponer).not.toHaveBeenCalled()
  })

  it('en usted, el trato viaja al modelo y la cola local también va en usted', async () => {
    aLas(21)
    const u = userEvent.setup()
    const c = crear(async () => ({ ok: false, motivo: 'red' }))
    const { $ } = montar(c, 'usted')
    await abrir(u)
    await decirle(u, $, 'buenas noches')
    await waitFor(() => expect(colasPosibles(21, 'usted')).toContain(frase($)), ESPERA)
    expect(c.proponer.mock.calls[0][2]?.charla?.trato).toBe('usted')
  })
})
