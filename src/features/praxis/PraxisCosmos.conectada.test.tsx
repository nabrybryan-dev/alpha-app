import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RespuestaDeGuardar, RespuestaDelRegistrador } from '../../domain/praxis/conversacion'
import { SALUD_SIN_REGISTRO } from '../../domain/praxis/conversacion'
import { fechaMenos, type LoQuePraxisVe } from '../../domain/praxis/plan/listaBlanca'
import { NUMEROS_VERIFICADOS } from '../../domain/praxis/riesgo'
import type { PreguntaConRespuesta, ResultadoDejarPregunta } from '../../data/praxis/preguntasEnEspera'
import { PraxisCosmos } from './PraxisCosmos'
import type { ConexionPraxis } from './motor/conexion'
import type { Trato } from './motor/entorno'

/**
 * La pantalla de Praxis CONECTADA, con dobles en vez de red: qué enseña con datos reales,
 * qué manda al registrador, cuándo guarda y cuándo se detiene. Lo que se prueba es lo que
 * la persona ve y lo que sale del teléfono; los píxeles se miran en un navegador.
 */
vi.setConfig({ testTimeout: 30_000 })
const ESPERA = { timeout: 12_000 }
const HOY = '2026-10-01'
const USUARIO = 'u-prueba'

const ve: LoQuePraxisVe = {
  activo: {
    numero: 6, fechaInicio: '2026-09-28', cadenciaDias: 7,
    sesiones: [{
      id: 's1', nombre: 'PIERNA A', dia: 'jueves', fecha: HOY, preparacion: [], bloquesCardio: [],
      ejercicios: [{ id: 'e1', nombre: 'SENTADILLA TRASERA', categoria: 'PIERNA', prescripcion: '40KG A 8 REPS; 3 SERIES', cargaKg: 40, sets: 3, rango: '8-10', repsDiana: 8, rirObjetivo: 2, descansoMin: 2, cues: '', series: [] }],
    }],
  },
  cerrados: [], perfil: { objetivos: 'Ganar fuerza' }, adherencias: [], hidratacionHoyMl: 0, comida: null, falta: ['plan_de_comida'],
  checkins: [
    { fecha: fechaMenos(HOY, 1), horasSueno: 6, calidadSueno: 'MALA', cansancio: 'MUCHO', estres: 'MUCHO', dolor: 0, comentarios: 'frase real de ayer' },
    { fecha: fechaMenos(HOY, 3), horasSueno: 8, calidadSueno: 'BUENA', dolor: 0 },
  ],
}
const veVacio: LoQuePraxisVe = { activo: null, cerrados: [], perfil: null, checkins: [], adherencias: [], hidratacionHoyMl: 0, comida: null, falta: ['plan_activo', 'perfil', 'checkins', 'plan_de_comida'] }

const propuestaSeries = {
  ok: true as const, mensajeId: 'm-1',
  propuesta: { accion: 'tarjeta' as const, registros: [{ campo: 'adherencia' as const, fecha: HOY, estado: 'si' as const, confianza: 'alta' as const }], descartado: [], notas_coach: [], citas_invalidas: [] },
  tarjeta: {
    tipo: 'confirmacion' as const, titulo: 'SENTADILLA TRASERA', lineas: [{ tarjeta_id: 'm-1:0', texto: 'SENTADILLA TRASERA · serie 1 · 40 kg × 12', editable: true }],
    avisos: ['Quedan 2 series de SENTADILLA TRASERA'], descartado: [], botones: [{ id: 'guardar' as const, texto: 'Guardar', primario: true }], requiereConfirmarSesion: false, guardable: true,
  },
}

function crear(extra: Partial<ConexionPraxis> = {}, datos: LoQuePraxisVe = ve) {
  const c = {
    usuarioId: USUARIO,
    hoy: HOY,
    leer: vi.fn(() => datos),
    proponer: vi.fn(async (): Promise<RespuestaDelRegistrador> => propuestaSeries),
    guardar: vi.fn(async (): Promise<RespuestaDeGuardar> => ({ ok: true, resultados: [{ indice: 0, campo: 'series', estado: 'guardado' }] })),
    preguntar: vi.fn(async (): Promise<ResultadoDejarPregunta> => ({ ok: true, destinatario: 'coach' })),
    preguntas: vi.fn(async (): Promise<PreguntaConRespuesta[]> => []),
    irAlFormulario: vi.fn(),
    ...extra,
  }
  return c
}

function montar(c: ConexionPraxis, trato: Trato = 'tu') {
  const r = render(
    <MemoryRouter>
      <PraxisCosmos trato={trato} conexion={c} />
    </MemoryRouter>,
  )
  const raiz = r.container.querySelector('.praxis') as HTMLElement
  const $ = (s: string) => raiz.querySelector(s) as HTMLElement
  return { ...r, raiz, $ }
}

/** Abre la sala con los permisos ya dados y deja a Praxis esperando lo que la persona escriba. */
async function abrir(u: ReturnType<typeof userEvent.setup>) {
  await u.click(screen.getByRole('button', { name: 'Hablar con Praxis' }))
  await waitFor(() => expect((document.querySelector('#frase')?.textContent || '').length).toBeGreaterThan(5), ESPERA)
}
async function decirle(u: ReturnType<typeof userEvent.setup>, $: (s: string) => HTMLElement, frase: string) {
  await u.type($('#entrada'), `${frase}{Enter}`)
}

beforeEach(() => {
  localStorage.clear()
  // Los permisos ya dados por esta persona, en SU espacio del navegador.
  localStorage.setItem(`praxis.u.${USUARIO}.permisos`, JSON.stringify({ cConversacion: true, cRiesgo: true, fecha: HOY, version: 'v2' }))
  window.matchMedia = ((consulta: string) => ({
    matches: consulta.includes('prefers-reduced-motion'), media: consulta, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => vi.restoreAllMocks())

describe('Praxis conectada · datos reales, nada de ejemplo', () => {
  it('no queda ni un rótulo ni un dato de ejemplo, ni el selector de demostración', () => {
    const { raiz, $ } = montar(crear())
    expect(raiz.textContent).not.toMatch(/ejemplo|EJEMPLO|PROTOTIPO|celular cargando|reunión larga|semana pesada|La pierna salió bien/)
    expect($('#demoSel')).toBeNull()
    expect(raiz.querySelector('[data-esc]')).toBeNull()
    expect($('#btnMic').hidden).toBe(true)
    expect($('#btnRapido').hidden).toBe(true)
    expect(screen.getByText('Solo el equipo')).toBeInTheDocument()
  })

  it('la semana y el contador son los check-ins de la persona con sesión', () => {
    const { $, raiz } = montar(crear())
    expect($('#contador').textContent).toBe('2 firmas en 14 días')
    expect($('#salaFecha').textContent).toBe('JUE 1 OCT')
    expect($('#semRango').textContent).toBe('25 SEP – 1 OCT')
    const dias = Array.from(raiz.querySelectorAll('#partitura button.dia')).map((b) => b.getAttribute('aria-label') || '')
    expect(dias).toHaveLength(7)
    expect(dias[5]).toContain('dormí mal')
    expect(dias[6]).toContain('Sin registro el jueves (hoy)')
    expect($('#miniRotulo').textContent).toBe('TU FIRMA DE AYER · MIÉ 30')
  })

  it('cuando falta el check-in de hoy, lo dice', () => {
    const { $ } = montar(crear())
    expect($('#tarjetaTxt').textContent).toContain('Aún no tengo tu check-in de hoy')
  })

  it('sin ningún dato de la persona no inventa una semana: todo son huecos y lo dice', async () => {
    const u = userEvent.setup()
    const { $, raiz } = montar(crear({}, veVacio))
    expect($('#contador').textContent).toBe('0 firmas en 14 días')
    expect(raiz.querySelectorAll('#partitura .firma-tinta')).toHaveLength(0)
    expect($('#miniRotulo').textContent).toBe('SIN FIRMA · JUE 1')
    await abrir(u)
    await waitFor(() => expect($('#frase').textContent).toContain('Aún no tengo ese dato: no veo un plan activo tuyo.'), ESPERA)
  })

  it('lo que guarda este navegador es de ESA persona: otra no hereda sus permisos', async () => {
    const u = userEvent.setup()
    const otra = crear({ usuarioId: 'u-otra' })
    montar(otra)
    await u.click(screen.getByRole('button', { name: 'Hablar con Praxis' }))
    expect(await screen.findByRole('button', { name: 'Acepto y empiezo' })).toBeInTheDocument()
  })

  it('nunca nombra a nadie: ni en la portada, ni en la privacidad, ni en la sala', async () => {
    const u = userEvent.setup()
    const { raiz } = montar(crear())
    await abrir(u)
    expect(raiz.textContent).not.toMatch(/Bryan|Manuela/)
  })
})

describe('Praxis conectada · lo que se escribe va al registrador y se guarda solo al confirmar', () => {
  it('manda la frase, enseña la propuesta y NO guarda hasta el toque', async () => {
    const u = userEvent.setup()
    const c = crear()
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'le metí 40 kilos, 12 en la sentadilla')

    await waitFor(() => expect(c.proponer).toHaveBeenCalledTimes(1), ESPERA)
    expect(vi.mocked(c.proponer).mock.calls[0][0]).toBe('le metí 40 kilos, 12 en la sentadilla')
    const guardarBtn = await screen.findByRole('button', { name: 'Guardar' }, ESPERA)
    expect(screen.getByText('SENTADILLA TRASERA · serie 1 · 40 kg × 12')).toBeInTheDocument()
    expect(screen.getByText('Quedan 2 series de SENTADILLA TRASERA')).toBeInTheDocument()
    expect(c.guardar).not.toHaveBeenCalled()

    await u.click(guardarBtn)
    await waitFor(() => expect(c.guardar).toHaveBeenCalledTimes(1), ESPERA)
    expect(vi.mocked(c.guardar).mock.calls[0][0]).toEqual({ mensajeId: 'm-1', registros: propuestaSeries.propuesta.registros, confirmaSesion: false })
    expect(await screen.findByText('Guardado: series.', undefined, ESPERA)).toBeInTheDocument()
  })

  it('al tocar una de las sentadillas de «¿cuál fue?», vuelve la frase de antes CON el ejercicio elegido, no la misma duda', async () => {
    // La prueba de Bryan del 2-oct: dos sentadillas en el plan, tocaba una y Praxis preguntaba lo mismo otra vez.
    const dos: LoQuePraxisVe = {
      ...ve,
      activo: {
        ...ve.activo!,
        sesiones: [{
          ...ve.activo!.sesiones[0],
          ejercicios: [
            { ...ve.activo!.sesiones[0].ejercicios[0], id: 'e-bulgara', nombre: 'Sentadilla búlgara (unilateral, con pausa)' },
            { ...ve.activo!.sesiones[0].ejercicios[0], id: 'e-goblet', nombre: 'Sentadilla goblet con mancuerna' },
          ],
        }],
      },
    }
    const pregunta: RespuestaDelRegistrador = {
      ok: true, mensajeId: 'm-1',
      propuesta: { accion: 'preguntar', registros: [], descartado: [], notas_coach: [], citas_invalidas: [] },
      tarjeta: {
        tipo: 'pregunta', titulo: '', lineas: [], avisos: [], descartado: [], botones: [], requiereConfirmarSesion: false, guardable: false,
        pregunta: { texto: '¿Cuál fue: Sentadilla búlgara (unilateral, con pausa) o Sentadilla goblet con mancuerna?', opciones: ['Sentadilla búlgara (unilateral, con pausa)', 'Sentadilla goblet con mancuerna'] },
      },
    }
    const proponer = vi.fn<ConexionPraxis['proponer']>()
    proponer.mockResolvedValueOnce(pregunta).mockResolvedValue(propuestaSeries)
    const u = userEvent.setup()
    const c = crear({ proponer }, dos)
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'hice 4 series de sentadilla con 60')

    await u.click(await screen.findByRole('button', { name: 'Sentadilla goblet con mancuerna' }, ESPERA))
    await waitFor(() => expect(proponer).toHaveBeenCalledTimes(2), ESPERA)
    expect(proponer.mock.calls[1][0]).toBe('hice 4 series de sentadilla con 60')
    expect(proponer.mock.calls[1][2]).toMatchObject({ pantallaEjercicioId: 'e-goblet' })
    expect(await screen.findByRole('button', { name: 'Guardar' }, ESPERA)).toBeInTheDocument()
  })

  it('«Descartar» no guarda nada', async () => {
    const u = userEvent.setup()
    const c = crear()
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'le metí 40 kilos, 12 en la sentadilla')
    await u.click(await screen.findByRole('button', { name: 'Descartar' }, ESPERA))
    expect(c.guardar).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
    await waitFor(() => expect($('#frase').textContent).toContain('no guardé nada'), ESPERA)
  })

  it('dos toques seguidos en «Guardar» mandan una sola vez', async () => {
    const u = userEvent.setup()
    let soltar: (r: RespuestaDeGuardar) => void = () => {}
    const c = crear({ guardar: vi.fn(() => new Promise<RespuestaDeGuardar>((res) => { soltar = res })) })
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'le metí 40 kilos, 12 en la sentadilla')
    const boton = await screen.findByRole('button', { name: 'Guardar' }, ESPERA)
    await u.click(boton)
    await u.click(boton)
    expect(c.guardar).toHaveBeenCalledTimes(1)
    soltar({ ok: true, resultados: [{ indice: 0, campo: 'series', estado: 'guardado' }] })
  })

  it('si el servidor no guardó algo, no dice «guardado»', async () => {
    const u = userEvent.setup()
    const c = crear({ guardar: vi.fn(async (): Promise<RespuestaDeGuardar> => ({ ok: true, resultados: [{ indice: 0, campo: 'checkin', estado: 'pendiente_prerrequisito', motivo: 'P2' }] })) })
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'dormí seis horas')
    await u.click(await screen.findByRole('button', { name: 'Guardar' }, ESPERA))
    expect(await screen.findByText(/Tu check-in todavía no se puede guardar desde Praxis/, undefined, ESPERA)).toBeInTheDocument()
    expect($('#frase').textContent).toContain('No todo quedó guardado')
    expect(screen.queryByText(/^Guardado:/)).not.toBeInTheDocument()
  })

  it('con el registrador sin desplegar lo dice, y no inventa una tarjeta', async () => {
    const u = userEvent.setup()
    const c = crear({ proponer: vi.fn(async (): Promise<RespuestaDelRegistrador> => ({ ok: false, motivo: 'no_desplegada' })) })
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'le metí 40 kilos a la sentadilla')
    await waitFor(() => expect($('#frase').textContent).toContain('mi registrador todavía no está encendido'), ESPERA)
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
    expect(c.guardar).not.toHaveBeenCalled()
  })
})

describe('Praxis conectada · seguridad primero', () => {
  it('una frase de riesgo NO llega al registrador: se detiene y enseña la Quieta con los números verificados', async () => {
    const u = userEvent.setup()
    const c = crear()
    const { $, raiz } = montar(c)
    await abrir(u)
    await decirle(u, $, 'le metí 40 a la sentadilla pero no quiero vivir más')

    const panel = raiz.querySelector('.quieta') as HTMLElement
    expect(panel).not.toBeNull()
    expect(c.proponer).not.toHaveBeenCalled()
    expect(c.preguntar).not.toHaveBeenCalled()
    const numeros = Array.from(panel.querySelectorAll('a[href^="tel:"]')).map((a) => (a.getAttribute('href') || '').slice(4))
    expect(numeros).toEqual(['123', '106'])
    for (const n of numeros) expect(NUMEROS_VERIFICADOS).toContain(n)
    expect($('#muelle').hidden).toBe(true)
  })

  it('la Quieta conectada no promete un aviso que no existe', async () => {
    const u = userEvent.setup()
    const { $, raiz } = montar(crear())
    await abrir(u)
    await decirle(u, $, 'me quiero morir')
    const panel = raiz.querySelector('.quieta') as HTMLElement
    expect(panel.textContent).not.toMatch(/Bryan|ya recibió|recibe tu frase/)
    expect(panel.textContent).toContain('Desde aquí todavía no se le avisa a nadie')
    expect(panel.textContent).toContain('llama al 123')
  })

  it.each([
    ['mi esposo me pegó anoche', '155'],
    ['le pegan a mi hijo en el colegio', '141'],
  ])('«%s» lleva a la línea %s, y siempre con el 123', async (frase, linea) => {
    const u = userEvent.setup()
    const c = crear()
    const { $, raiz } = montar(c)
    await abrir(u)
    await decirle(u, $, frase)
    expect(raiz.querySelector(`.quieta a[href="tel:${linea}"]`)).not.toBeNull()
    expect(raiz.querySelector('.quieta a[href="tel:123"]')).not.toBeNull()
    expect(c.proponer).not.toHaveBeenCalled()
  })

  it('lo ambiguo se pregunta; con «No», la frase no viaja a ningún lado y la conversación sigue', async () => {
    const u = userEvent.setup()
    const c = crear()
    const { $, raiz } = montar(c)
    await abrir(u)
    await decirle(u, $, 'ya no puedo más con todo')
    expect($('#frase').textContent).toContain('¿Estás pensando en hacerte daño?')
    await u.click(screen.getByRole('button', { name: 'No' }))
    expect(raiz.querySelector('.quieta')).toBeNull()
    expect(c.proponer).not.toHaveBeenCalled()

    await decirle(u, $, 'tomé dos vasos de agua')
    await waitFor(() => expect(c.proponer).toHaveBeenCalledTimes(1), ESPERA)
    expect(vi.mocked(c.proponer).mock.calls[0][0]).toBe('tomé dos vasos de agua')
  })

  it('con «Sí» a la pregunta de cuidado, la Quieta', async () => {
    const u = userEvent.setup()
    const c = crear()
    const { $, raiz } = montar(c)
    await abrir(u)
    await decirle(u, $, 'no aguanto más')
    await u.click(screen.getByRole('button', { name: 'Sí' }))
    expect(raiz.querySelector('.quieta a[href="tel:123"]')).not.toBeNull()
    expect(c.proponer).not.toHaveBeenCalled()
  })

  it('lo de salud no se registra ni llega al modelo', async () => {
    const u = userEvent.setup()
    const c = crear()
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'me duele la rodilla, hice 3 series de 10')
    await waitFor(() => expect($('#frase').textContent).toBe(SALUD_SIN_REGISTRO.tu), ESPERA)
    expect(c.proponer).not.toHaveBeenCalled()
    expect(c.guardar).not.toHaveBeenCalled()
  })

  it('si el servidor marca violencia de pareja, la Quieta lleva a la 155 (la misma línea que habría elegido la pantalla)', async () => {
    const u = userEvent.setup()
    const c = crear({ proponer: vi.fn(async (): Promise<RespuestaDelRegistrador> => ({
      ok: true, mensajeId: 'm-3',
      propuesta: { accion: 'derivar', motivo: 'clinico', filtro: 'crisis', urgencia: 'alta', riesgo: { tipo: 'quieta', linea: 'pareja' }, registros: [], descartado: [], notas_coach: [], citas_invalidas: [] },
      tarjeta: { tipo: 'derivacion', titulo: '', lineas: [], avisos: [], descartado: [], botones: [], requiereConfirmarSesion: false, guardable: false },
    })) })
    const { $, raiz } = montar(c)
    await abrir(u)
    await decirle(u, $, 'una frase que el diccionario de la pantalla no conoce')
    await waitFor(() => expect(raiz.querySelector('.quieta a[href="tel:155"]')).not.toBeNull(), ESPERA)
  })

  it('si el servidor deriva por crisis algo que la pantalla dejó pasar, también la Quieta', async () => {
    const u = userEvent.setup()
    const c = crear({ proponer: vi.fn(async (): Promise<RespuestaDelRegistrador> => ({
      ok: true, mensajeId: 'm-2',
      propuesta: { accion: 'derivar', motivo: 'clinico', filtro: 'crisis', urgencia: 'alta', registros: [], descartado: [], notas_coach: [], citas_invalidas: [] },
      tarjeta: { tipo: 'derivacion', titulo: '', lineas: [], avisos: [], descartado: [], botones: [], requiereConfirmarSesion: false, guardable: false },
    })) })
    const { $, raiz } = montar(c)
    await abrir(u)
    await decirle(u, $, 'una frase que el diccionario de la pantalla no conoce')
    await waitFor(() => expect(raiz.querySelector('.quieta a[href="tel:123"]')).not.toBeNull(), ESPERA)
  })
})

describe('Praxis conectada · la demostración de la Quieta y quien no tiene formulario', () => {
  it('la demostración de la Quieta tampoco nombra a nadie ni habla de ejemplo, y trae los números', async () => {
    const u = userEvent.setup()
    const { $, raiz } = montar(crear())
    await u.click($('#btnDemoQuieta'))
    const panel = raiz.querySelector('.quieta') as HTMLElement
    expect(panel).not.toBeNull()
    expect(panel.textContent).toContain('Demostración')
    expect(panel.textContent).not.toMatch(/Bryan|Manuela|ejemplo|prototipo/i)
    expect(panel.querySelector('a[href="tel:123"]')).not.toBeNull()
    expect(panel.querySelector('a[href="tel:106"]')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Salir de la demostración' })).toBeInTheDocument()
  })

  it('la demostración no deja Praxis detenida: al salir, se puede hablar', async () => {
    const u = userEvent.setup()
    const { $ } = montar(crear())
    await u.click($('#btnDemoQuieta'))
    await u.click(screen.getByRole('button', { name: 'Salir de la demostración' }))
    expect($('#tarjetaTxt').textContent).not.toContain('se detuvo')
    expect(screen.getByRole('button', { name: 'Hablar con Praxis' })).toBeInTheDocument()
  })

  it('a quien no tiene formulario (el coach) no se le ofrece', async () => {
    const u = userEvent.setup()
    const c = crear({ irAlFormulario: null })
    const { $ } = montar(c)
    expect($('#btnPrefieroForm').hidden).toBe(true)
    expect($('#btnForm').hidden).toBe(true)
    expect($('#tarjetaTxt').textContent).toContain('Aún no tengo tu check-in de hoy.')
    expect($('#tarjetaTxt').textContent).not.toContain('formulario')
    await abrir(u)
    await decirle(u, $, 'me duele la rodilla')
    await waitFor(() => expect($('#frase').textContent).toBe(SALUD_SIN_REGISTRO.tu), ESPERA)
    expect(screen.queryByRole('button', { name: 'Abrir el formulario' })).not.toBeInTheDocument()
  })

  it('a quien sí lo tiene, «Abrir el formulario» lo lleva', async () => {
    const u = userEvent.setup()
    const c = crear()
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, 'me duele la rodilla')
    await u.click(await screen.findByRole('button', { name: 'Abrir el formulario' }, ESPERA))
    expect(c.irAlFormulario).toHaveBeenCalledTimes(1)
  })
})

describe('Praxis conectada · el plan y la pregunta en espera', () => {
  it('una pregunta del plan se contesta con lo que ve, sin llamar a ningún modelo', async () => {
    const u = userEvent.setup()
    const c = crear()
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, '¿qué me toca hoy?')
    await waitFor(() => expect($('#frase').textContent).toContain('Hoy te toca PIERNA A: SENTADILLA TRASERA.'), ESPERA)
    expect(c.proponer).not.toHaveBeenCalled()
    expect(await screen.findByText('M6 · PIERNA A', undefined, ESPERA)).toBeInTheDocument()
  })

  it('pedir un cambio no cambia nada: Praxis no toca cargas ni el plan', async () => {
    const u = userEvent.setup()
    const c = crear()
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, '¿me subes el peso de la sentadilla?')
    await waitFor(() => expect($('#frase').textContent).toContain('Yo no cambio cargas ni tu plan: eso lo decide tu coach.'), ESPERA)
    expect($('#frase').textContent).toContain('¿Se lo pregunto a tu coach? Te aviso cuando responda.')
    expect(c.proponer).not.toHaveBeenCalled()
    expect(c.guardar).not.toHaveBeenCalled()
  })

  it('cuando no sabe, ofrece preguntar SIN nombres, y sin el «sí» no manda nada', async () => {
    const u = userEvent.setup()
    const c = crear()
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, '¿por qué esta semana es tan dura?')
    await waitFor(() => expect($('#frase').textContent).toContain('¿Se lo pregunto a tu coach? Te aviso cuando responda.'), ESPERA)
    expect($('#frase').textContent).not.toMatch(/Bryan|Manuela/)
    expect(c.preguntar).not.toHaveBeenCalled()
    await u.click(await screen.findByRole('button', { name: 'No, gracias' }, ESPERA))
    expect(c.preguntar).not.toHaveBeenCalled()
  })

  it('con el «sí» deja la pregunta en espera, con lo que le faltó', async () => {
    const u = userEvent.setup()
    const c = crear()
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, '¿por qué esta semana es tan dura?')
    await u.click(await screen.findByRole('button', { name: 'Sí, pregúntale' }, ESPERA))
    await waitFor(() => expect(c.preguntar).toHaveBeenCalledTimes(1), ESPERA)
    expect(vi.mocked(c.preguntar).mock.calls[0][0]).toEqual({ frase: '¿por qué esta semana es tan dura?', queFalto: 'porque_no_escrito', citas: [] })
    await waitFor(() => expect($('#frase').textContent).toContain('le dejé tu pregunta a tu coach'), ESPERA)
  })

  it('una pregunta de comida va a «tu nutricionista»', async () => {
    const u = userEvent.setup()
    const { $ } = montar(crear())
    await abrir(u)
    await decirle(u, $, '¿la creatina engorda?')
    await waitFor(() => expect($('#frase').textContent).toContain('¿Se lo pregunto a tu nutricionista? Te aviso cuando responda.'), ESPERA)
  })

  it('si la bandeja todavía no existe, dice que NO la mandó', async () => {
    const u = userEvent.setup()
    const c = crear({ preguntar: vi.fn(async (): Promise<ResultadoDejarPregunta> => ({ ok: false, motivo: 'no_disponible' })) })
    const { $ } = montar(c)
    await abrir(u)
    await decirle(u, $, '¿por qué esta semana es tan dura?')
    await u.click(await screen.findByRole('button', { name: 'Sí, pregúntale' }, ESPERA))
    await waitFor(() => expect($('#frase').textContent).toContain('No la mandé'), ESPERA)
    expect($('#frase').textContent).not.toContain('le dejé tu pregunta')
  })

  it('al abrir, dice las respuestas que llegaron y las preguntas que siguen en espera', async () => {
    const u = userEvent.setup()
    const c = crear({ preguntas: vi.fn(async (): Promise<PreguntaConRespuesta[]> => [
      { id: 'p1', pregunta: '¿Por qué bajó el press?', destinatario: 'coach', estado: 'respondida', respuesta: 'Para volver a la reserva que buscamos.', venceEn: '', creadoEn: '' },
      { id: 'p2', pregunta: '¿Puedo cambiar el arroz?', destinatario: 'nutricionista', estado: 'abierta', respuesta: null, venceEn: '', creadoEn: '' },
    ]) })
    montar(c)
    await abrir(u)
    expect(await screen.findByText('Para volver a la reserva que buscamos.', undefined, ESPERA)).toBeInTheDocument()
    expect(screen.getByText('Respondió tu coach')).toBeInTheDocument()
    expect(screen.getByText(/«¿Puedo cambiar el arroz\?» sigue en espera: tu nutricionista todavía no ha respondido/)).toBeInTheDocument()
  })
})

describe('Praxis conectada · en usted', () => {
  it('habla de usted y no mezcla', async () => {
    const u = userEvent.setup()
    localStorage.setItem(`praxis.u.${USUARIO}.permisos`, JSON.stringify({ cConversacion: true, cRiesgo: true, fecha: HOY, version: 'v2' }))
    const { $, raiz } = montar(crear(), 'usted')
    expect($('#tarjetaTxt').textContent).toContain('Aún no tengo su check-in de hoy')
    await abrir(u)
    await waitFor(() => expect($('#frase').textContent).toContain('Cuénteme qué quiere anotar'), ESPERA)
    expect(raiz.textContent).not.toMatch(/tu check-in|Cuéntame|tu plan/)
  })
})
