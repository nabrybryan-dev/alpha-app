import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RespuestaDelRegistrador } from '../../domain/praxis/conversacion'
import type { LoQuePraxisVe } from '../../domain/praxis/plan/listaBlanca'
import type { PreguntaConRespuesta, ResultadoDejarPregunta } from '../../data/praxis/preguntasEnEspera'
import { PraxisCosmos } from './PraxisCosmos'
import type { ConexionPraxis } from './motor/conexion'
import { TOMA_MAX_MS, UMBRAL_MS } from './motor/hablar'
import { enviarTexto } from './motor/senales'
import { Voz } from './motor/voz'

/**
 * Mantener presionado el agujero para hablar (Bryan, 2-oct), en la sala CONECTADA y con un
 * reconocedor de voz falso: la app no toca audio, solo recibe texto del reconocedor, así
 * que lo que se prueba es qué hace con ese texto y cuándo lo pide.
 *
 * `enviarTexto` va envuelto (sin cambiar lo que hace) para ver que lo dicho entra por el
 * MISMO camino que lo escrito y con `fuente: 'voz'`.
 */
vi.mock('./motor/senales', async (importar) => {
  const m = await importar<typeof import('./motor/senales')>()
  return { ...m, enviarTexto: vi.fn(m.enviarTexto) }
})

vi.setConfig({ testTimeout: 30_000 })
const ESPERA = { timeout: 12_000 }
const HOY = '2026-10-01'
const USUARIO = 'u-voz'

const ve: LoQuePraxisVe = {
  activo: {
    numero: 6, fechaInicio: '2026-09-28', cadenciaDias: 7,
    sesiones: [{
      id: 's1', nombre: 'PIERNA A', dia: 'jueves', fecha: HOY, preparacion: [], bloquesCardio: [],
      ejercicios: [{ id: 'e1', nombre: 'SENTADILLA TRASERA', categoria: 'PIERNA', prescripcion: '40KG A 8 REPS; 3 SERIES', cargaKg: 40, sets: 3, rango: '8-10', repsDiana: 8, rirObjetivo: 2, descansoMin: 2, cues: '', series: [] }],
    }],
  },
  cerrados: [], perfil: { objetivos: 'Ganar fuerza' }, adherencias: [], hidratacionHoyMl: 0, comida: null, falta: ['plan_de_comida'], checkins: [],
}
const propuesta: RespuestaDelRegistrador = {
  ok: true, mensajeId: 'm-1',
  propuesta: { accion: 'tarjeta', registros: [{ campo: 'adherencia', fecha: HOY, estado: 'si', confianza: 'alta' }], descartado: [], notas_coach: [], citas_invalidas: [] },
  tarjeta: {
    tipo: 'confirmacion', titulo: 'SENTADILLA TRASERA', lineas: [{ tarjeta_id: 'm-1:0', texto: 'SENTADILLA TRASERA · serie 1 · 40 kg × 12', editable: true }],
    avisos: [], descartado: [], botones: [{ id: 'guardar', texto: 'Guardar', primario: true }], requiereConfirmarSesion: false, guardable: true,
  },
}

function crear(): ConexionPraxis & { proponer: ReturnType<typeof vi.fn> } {
  return {
    usuarioId: USUARIO, hoy: HOY,
    leer: vi.fn(() => ve),
    proponer: vi.fn(async (): Promise<RespuestaDelRegistrador> => propuesta),
    guardar: vi.fn(async () => ({ ok: true as const, resultados: [] })),
    preguntar: vi.fn(async (): Promise<ResultadoDejarPregunta> => ({ ok: true, destinatario: 'coach' })),
    preguntas: vi.fn(async (): Promise<PreguntaConRespuesta[]> => []),
    irAlFormulario: vi.fn(),
  }
}

/* ——— El reconocedor de voz falso: guarda cómo lo configuran y deja decir lo que haga falta ——— */
type Parte = [texto: string, final: boolean]
const evento = (partes: Parte[]) => ({ resultIndex: 0, results: partes.map(([t, fin]) => Object.assign([{ transcript: t }], { isFinal: fin })) })
class Falso {
  static ultimo: Falso | null = null
  static creados = 0
  /** Lo que pasó y en qué orden (callar / start), para ver que Praxis se calla ANTES de escuchar. */
  static orden: string[] = []
  lang = ''; interimResults = false; continuous = false; maxAlternatives = 0
  onresult: ((e: ReturnType<typeof evento>) => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  iniciado = false; parado = false; abortado = false
  /** Lo que el reconocedor entrega como final al pedirle que pare (null: nada). */
  finalAlParar: string | null = null
  constructor() { Falso.creados++; Falso.ultimo = this }
  start(): void { this.iniciado = true; Falso.orden.push('start') }
  stop(): void {
    this.parado = true
    const f = this.finalAlParar
    queueMicrotask(() => { if (f) this.onresult?.(evento([[f, true]])); this.onend?.() })
  }
  abort(): void { this.abortado = true; queueMicrotask(() => this.onend?.()) }
  decir(...partes: Parte[]): void { this.onresult?.(evento(partes)) }
}
const ventana = window as unknown as Record<string, unknown>

function montar(permisoVoz: boolean) {
  localStorage.setItem(`praxis.u.${USUARIO}.permisos`, JSON.stringify({ cConversacion: true, cRiesgo: true, cVoz: permisoVoz, fecha: HOY, version: 'v1' }))
  const c = crear()
  const r = render(<MemoryRouter><PraxisCosmos trato="tu" conexion={c} /></MemoryRouter>)
  const raiz = r.container.querySelector('.praxis') as HTMLElement
  const $ = (s: string) => raiz.querySelector(s) as HTMLElement
  return { c, raiz, $ }
}
async function abrir($: (s: string) => HTMLElement) {
  fireEvent.click(screen.getByRole('button', { name: 'Hablar con Praxis' }))
  await waitFor(() => expect(($('#frase').textContent || '').length).toBeGreaterThan(5), ESPERA)
}
const agujero = () => screen.getByRole('button', { name: 'Mantén presionado para hablar con Praxis' })
const presionar = () => fireEvent.pointerDown(agujero(), { pointerId: 1, button: 0, pointerType: 'touch' })
const soltar = () => fireEvent.pointerUp(agujero(), { pointerId: 1, button: 0, pointerType: 'touch' })
async function presionarYEsperar() {
  presionar()
  await waitFor(() => expect(Falso.ultimo?.iniciado).toBe(true), ESPERA)
  return Falso.ultimo as Falso
}

beforeEach(() => {
  localStorage.clear()
  window.matchMedia = ((consulta: string) => ({
    matches: consulta.includes('prefers-reduced-motion'), media: consulta, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  Falso.ultimo = null; Falso.creados = 0; Falso.orden = []
  ventana.webkitSpeechRecognition = Falso
  delete ventana.SpeechRecognition
  vi.mocked(enviarTexto).mockClear()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete ventana.webkitSpeechRecognition
})

describe('Praxis conectada · mantener el agujero para hablar', () => {
  it('el agujero es un botón con su nombre y aria-pressed', async () => {
    const { $ } = montar(true)
    await abrir($)
    expect(agujero().getAttribute('aria-pressed')).toBe('false')
  })

  it('sin el permiso «Usar mi voz» NO graba: dice cómo darlo', async () => {
    const { $ } = montar(false)
    await abrir($)
    presionar()
    await act(() => new Promise((r) => setTimeout(r, UMBRAL_MS + 150)))
    soltar()
    expect(Falso.creados).toBe(0)
    expect($('#ayuda').textContent).toContain('activa «Usar mi voz» en «Tus permisos»')
    expect(screen.getByRole('button', { name: 'Ir a «Tus permisos»' })).toBeInTheDocument()
    expect(enviarTexto).not.toHaveBeenCalled()
  })

  it('con el permiso, mantener arranca el reconocedor en es-CO, con lo provisional y continuo, y calla a Praxis primero', async () => {
    const { $ } = montar(true)
    await abrir($)
    fireEvent.click($('#frase')) // la frase de Praxis se completa: lo que quede callado tiene que callarlo la toma, no el corte de la frase
    await act(() => new Promise((r) => setTimeout(r, 50)))
    const callar = vi.spyOn(Voz, 'callar').mockImplementation(() => { Falso.orden.push('callar') })
    const rec = await presionarYEsperar()
    expect(rec.lang).toBe('es-CO')
    expect(rec.interimResults).toBe(true)
    expect(rec.continuous).toBe(true)
    expect(callar).toHaveBeenCalled()
    expect(Falso.orden.indexOf('callar')).toBeLessThan(Falso.orden.indexOf('start')) // primero se calla, después escucha
    expect(agujero().getAttribute('aria-pressed')).toBe('true')
    expect($('#ondaCaja').classList.contains('escuchando')).toBe(true)
    act(() => rec.decir(['le metí 40 kilos', false]))
    expect($('#enVivo').textContent).toBe('le metí 40 kilos…') // lo que va entendiendo, en vivo
  })

  it('un toque corto (menos de 250 ms) no graba nada: enseña el gesto', async () => {
    const { $ } = montar(true)
    await abrir($)
    presionar(); soltar()
    await act(() => new Promise((r) => setTimeout(r, UMBRAL_MS + 150)))
    expect(Falso.creados).toBe(0)
    expect($('#ayuda').textContent).toBe('Mantén presionado el agujero mientras hablas.')
  })

  it('al soltar, lo final entra por el MISMO camino que lo escrito, con fuente «voz», y llega al registrador', async () => {
    const { c, $ } = montar(true)
    await abrir($)
    const rec = await presionarYEsperar()
    act(() => rec.decir(['eh le metí 40 kilos', false]))
    rec.finalAlParar = 'eh, le metí 40 kilos, 12 en la sentadilla'
    soltar()
    expect(rec.parado).toBe(true)
    expect(agujero().getAttribute('aria-pressed')).toBe('false')
    await waitFor(() => expect(enviarTexto).toHaveBeenCalledWith('le metí 40 kilos, 12 en la sentadilla', 'voz'), ESPERA) // sin la pausa «eh»
    await waitFor(() => expect(c.proponer).toHaveBeenCalledTimes(1), ESPERA)
    expect(c.proponer.mock.calls[0][0]).toBe('le metí 40 kilos, 12 en la sentadilla')
  })

  it('una frase de riesgo dicha por voz entra en la Quieta igual que escrita, sin llegar al registrador', async () => {
    const { c, $, raiz } = montar(true)
    await abrir($)
    const rec = await presionarYEsperar()
    rec.finalAlParar = 'le metí 40 a la sentadilla pero no quiero vivir más'
    soltar()
    await waitFor(() => expect(raiz.querySelector('.quieta')).not.toBeNull(), ESPERA)
    expect(enviarTexto).toHaveBeenCalledWith('le metí 40 a la sentadilla pero no quiero vivir más', 'voz')
    expect(raiz.querySelector('.quieta a[href="tel:123"]')).not.toBeNull()
    expect(c.proponer).not.toHaveBeenCalled()
  })

  it('soltar sin texto no manda nada', async () => {
    const { c, $ } = montar(true)
    await abrir($)
    await presionarYEsperar()
    soltar()
    await waitFor(() => expect($('#ayuda').textContent).toBe('No te oí. Mantén presionado el agujero mientras hablas.'), ESPERA)
    expect(enviarTexto).not.toHaveBeenCalled()
    expect(c.proponer).not.toHaveBeenCalled()
  })

  it('sin reconocimiento de voz en el navegador, lo dice claro y no graba', async () => {
    delete ventana.webkitSpeechRecognition
    const { $ } = montar(true)
    await abrir($)
    presionar(); soltar()
    expect($('#ayuda').textContent).toBe('Este navegador no deja usar el micrófono aquí; usa el micrófono del teclado.')
    expect(Falso.creados).toBe(0)
  })

  it('si el permiso del micrófono se niega, el mismo mensaje y nada se manda', async () => {
    const { $ } = montar(true)
    await abrir($)
    const rec = await presionarYEsperar()
    act(() => rec.onerror?.({ error: 'not-allowed' }))
    rec.finalAlParar = null
    soltar()
    await waitFor(() => expect($('#ayuda').textContent).toBe('Este navegador no deja usar el micrófono aquí; usa el micrófono del teclado.'), ESPERA)
    expect(enviarTexto).not.toHaveBeenCalled()
  })

  it('una toma dura como mucho un minuto: el tiempo la corta aunque se siga presionando', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] })
    const { $ } = montar(true)
    await abrir($)
    presionar()
    await act(() => vi.advanceTimersByTimeAsync(UMBRAL_MS + 20))
    const rec = Falso.ultimo as Falso
    expect(rec.iniciado).toBe(true)
    rec.finalAlParar = 'le metí 40 kilos, 12 en la sentadilla'
    await act(() => vi.advanceTimersByTimeAsync(TOMA_MAX_MS - 1000))
    expect(rec.parado).toBe(false)
    await act(() => vi.advanceTimersByTimeAsync(1100))
    expect(rec.parado).toBe(true)
    expect(agujero().getAttribute('aria-pressed')).toBe('false')
    await waitFor(() => expect(enviarTexto).toHaveBeenCalledWith('le metí 40 kilos, 12 en la sentadilla', 'voz'), ESPERA)
  })

  it('con el foco en el agujero, mantener la barra espaciadora hace lo mismo', async () => {
    const { $ } = montar(true)
    await abrir($)
    fireEvent.keyDown(agujero(), { key: ' ' })
    await waitFor(() => expect(Falso.ultimo?.iniciado).toBe(true), ESPERA)
    const rec = Falso.ultimo as Falso
    rec.finalAlParar = 'le metí 40 kilos, 12 en la sentadilla'
    fireEvent.keyUp(agujero(), { key: ' ' })
    await waitFor(() => expect(enviarTexto).toHaveBeenCalledWith('le metí 40 kilos, 12 en la sentadilla', 'voz'), ESPERA)
  })
})

describe('Praxis conectada · la barra para escribir', () => {
  it('nace plegada e inerte; el tirador la abre y al enviar se pliega otra vez', async () => {
    const { $ } = montar(true)
    await abrir($)
    const muelle = $('#muelle'), tirador = screen.getByRole('button', { name: 'Escribirle a Praxis' })
    expect(muelle.classList.contains('plegada')).toBe(true)
    expect(muelle.inert).toBe(true)
    fireEvent.click(tirador)
    expect(muelle.classList.contains('plegada')).toBe(false)
    expect(tirador.getAttribute('aria-expanded')).toBe('true')
    fireEvent.change($('#entrada'), { target: { value: 'le metí 40 kilos, 12 en la sentadilla' } })
    fireEvent.submit($('#formTexto'))
    expect(muelle.classList.contains('plegada')).toBe(true)
  })

  it('decir «quiero escribir» abre la barra y no manda nada', async () => {
    const { c, $ } = montar(true)
    await abrir($)
    const rec = await presionarYEsperar()
    rec.finalAlParar = 'Quiero escribir.'
    soltar()
    await waitFor(() => expect($('#muelle').classList.contains('plegada')).toBe(false), ESPERA)
    expect(enviarTexto).not.toHaveBeenCalled()
    expect(c.proponer).not.toHaveBeenCalled()
  })
})
