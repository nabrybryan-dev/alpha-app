import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RespuestaDelRegistrador } from '../../domain/praxis/conversacion'
import type { LoQuePraxisVe } from '../../domain/praxis/plan/listaBlanca'
import { PraxisCosmos } from './PraxisCosmos'
import type { ConexionPraxis } from './motor/conexion'

/**
 * Lo que la persona ve mientras el registrador piensa (Bryan, 3-oct: «en tiempo real»).
 * Regla: nada de silencio. En el instante en que la frase sale hacia el servidor, la pantalla
 * ya está en «piensa» (la onda cambia y el lector de pantalla lo anuncia). Sin frases de relleno
 * habladas: lo único que hay es el estado visual, y se quita cuando llega la respuesta.
 */
vi.setConfig({ testTimeout: 30_000 })
const HOY = '2026-10-01'
const USUARIO = 'u-espera'
const ve: LoQuePraxisVe = {
  activo: {
    numero: 6, fechaInicio: '2026-09-28', cadenciaDias: 7,
    sesiones: [{
      id: 's1', nombre: 'PIERNA A', dia: 'jueves', fecha: HOY, preparacion: [], bloquesCardio: [],
      ejercicios: [{ id: 'e1', nombre: 'SENTADILLA TRASERA', categoria: 'PIERNA', prescripcion: '40KG A 8 REPS; 3 SERIES', cargaKg: 40, sets: 3, rango: '8-10', repsDiana: 8, rirObjetivo: 2, descansoMin: 2 } as never],
    }],
  },
  cerrados: [], perfil: { objetivos: 'Ganar fuerza' }, adherencias: [], hidratacionHoyMl: 0, comida: null, falta: [], checkins: [],
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(`praxis.u.${USUARIO}.permisos`, JSON.stringify({ cConversacion: true, cRiesgo: true, fecha: HOY, version: 'v1' }))
  window.matchMedia = ((consulta: string) => ({
    matches: consulta.includes('prefers-reduced-motion'), media: consulta, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => vi.restoreAllMocks())

describe('Praxis · la espera del registrador no es silencio', () => {
  it('al mandar la frase, «piensa» ya está puesto ANTES de que la petición salga, y se quita al llegar la respuesta', async () => {
    const u = userEvent.setup()
    let liberar: (r: RespuestaDelRegistrador) => void = () => {}
    const alSalir: { busy: string | null; sr: string; t: number }[] = []
    const t0 = { v: 0 }
    const conexion: ConexionPraxis = {
      usuarioId: USUARIO, hoy: HOY, leer: vi.fn(() => ve),
      proponer: vi.fn(() => {
        // Lo que ve la persona en el instante exacto en que la frase sale del teléfono.
        alSalir.push({ busy: document.querySelector('#dicho')?.getAttribute('aria-busy') ?? null, sr: document.querySelector('#srPiensa')?.textContent ?? '', t: performance.now() - t0.v })
        return new Promise<RespuestaDelRegistrador>((r) => { liberar = r })
      }),
      guardar: vi.fn(), preguntar: vi.fn(), preguntas: vi.fn(async () => []), irAlFormulario: vi.fn(),
    } as unknown as ConexionPraxis
    const r = render(<MemoryRouter><PraxisCosmos trato="tu" conexion={conexion} /></MemoryRouter>)
    const raiz = r.container.querySelector('.praxis') as HTMLElement
    await u.click(screen.getByRole('button', { name: 'Hablar con Praxis' }))
    await waitFor(() => expect((document.querySelector('#frase')?.textContent || '').length).toBeGreaterThan(5), { timeout: 12_000 })

    const entrada = raiz.querySelector('#entrada') as HTMLElement
    await u.type(entrada, 'hice sentadilla 40 por 12')
    t0.v = performance.now()
    await u.keyboard('{Enter}')

    await waitFor(() => expect(conexion.proponer).toHaveBeenCalledTimes(1))
    expect(alSalir[0].busy).toBe('true')
    expect(alSalir[0].sr).toBe('Praxis está pensando')
    // Lo que se comprueba es el ORDEN («piensa» ya está puesto cuando la petición sale), no el reloj:
    // un tope en milisegundos falla en un servidor de pruebas cargado (107 ms en el CI del 3-oct)
    // sin que la pantalla haya cambiado.
    expect(alSalir[0].t).toBeGreaterThanOrEqual(0)

    // Sigue «piensa» mientras no hay respuesta, sin ninguna frase de relleno hablada.
    expect(raiz.querySelector('#dicho')?.getAttribute('aria-busy')).toBe('true')
    expect(raiz.querySelector('#srPiensa')?.textContent).toBe('Praxis está pensando')

    liberar({ ok: false, motivo: 'red' } as unknown as RespuestaDelRegistrador)
    await waitFor(() => expect(raiz.querySelector('#dicho')?.getAttribute('aria-busy')).toBeNull())
    expect(raiz.querySelector('#srPiensa')?.textContent).toBe('')
  })
})
