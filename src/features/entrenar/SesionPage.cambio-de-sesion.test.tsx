/**
 * ⚠️ ESTOS TESTS FALLAN A PROPÓSITO. Documentan un fallo REAL que NO está
 * arreglado (auditoría de carreras y estado compartido, 2026-07-27).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * EL FALLO
 * ────────────────────────────────────────────────────────────────────────────
 * La ruta `entrenar/sesion/:sesionId` monta SIEMPRE el mismo `<SesionPage />`.
 * Al pasar de una sesión a otra, React Router NO desmonta el componente: solo
 * cambia el parámetro. Pero todo el estado vivo de la pantalla se inicializa
 * con `useState(() => …)`, que solo corre en el PRIMER montaje:
 *
 *   - `SesionPage.tsx:66`  → `descanso`  (leído de `alpha-descanso-<sesionId>`)
 *   - `CronometroSesion.tsx:46` → `estado` (leído de `alpha-crono-<sesionId>`)
 *
 * Ninguno de los dos se vuelve a leer cuando cambia `sesionId`, y los efectos
 * que los persisten (`SesionPage.tsx:75-78`, `CronometroSesion.tsx:51-53`)
 * SÍ reaccionan al cambio de clave. Resultado: el estado de la sesión vieja se
 * ESCRIBE ENCIMA de la clave de la sesión nueva.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * QUÉ LE PASA A LA PERSONA QUE ENTRENA
 * ────────────────────────────────────────────────────────────────────────────
 * Está en el gimnasio y abre "UPPER A" por error (o hace el calentamiento ahí,
 * o simplemente mira la prescripción). Pasan cinco minutos. Se da cuenta de que
 * hoy le toca "LEG B", vuelve al microciclo y entra a LEG B.
 *
 *   1. El cronómetro de LEG B arranca marcando 00:05:00 en vez de 00:00:00, y
 *      queda guardado como si LEG B hubiera empezado hace cinco minutos. El
 *      PanelRitmo lee ese mismo cronómetro (`PanelRitmo.tsx:29`) y le dice que
 *      va tarde cuando acaba de empezar.
 *   2. Peor: si LEG B tenía un descanso a medias guardado (cerró la app entre
 *      series y volvió), al entrar desde otra sesión ese descanso se BORRA,
 *      porque el efecto escribe el `descanso` de la sesión vieja (null) sobre
 *      la clave de la nueva.
 */
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRouter } from '../../app/router'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'

// Dos sesiones SIN registrar del microciclo activo de la asesorada demo.
const SESION_A = 's-uppera-m22'
const SESION_B = 's-legb-m22'

const BASE = new Date('2026-07-27T10:00:00Z').getTime()
let ahora = BASE

function Navegador() {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate(`/entrenar/sesion/${SESION_B}`)}>
      ir-a-la-otra-sesion
    </button>
  )
}

function montarEn(sesionId: string) {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <MemoryRouter initialEntries={[`/entrenar/sesion/${sesionId}`]}>
          <Navegador />
          <AppRouter />
        </MemoryRouter>
      </SessionProvider>
    </ThemeProvider>,
  )
}

/** Mueve el reloj de pared y fuerza el refresco que hace la app al volver. */
function pasarMinutos(min: number) {
  ahora += min * 60_000
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

describe('cambiar de sesión sin salir de la pantalla de entreno', () => {
  beforeEach(() => {
    localStorage.clear()
    ahora = BASE
    vi.spyOn(Date, 'now').mockImplementation(() => ahora)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('el cronómetro NO debe arrastrar el tiempo de la sesión anterior', async () => {
    montarEn(SESION_A)
    // timeout holgado: aquí se resuelve el import perezoso de SesionPage.
    expect(await screen.findByText('00:00:00', undefined, { timeout: 5000 })).toBeInTheDocument()

    pasarMinutos(5)
    expect(screen.getByText('00:05:00')).toBeInTheDocument()

    // Se da cuenta de que hoy le toca la otra sesión y entra a ella.
    act(() => {
      screen.getByRole('button', { name: 'ir-a-la-otra-sesion' }).click()
    })
    expect(await screen.findByText('LEG B')).toBeInTheDocument()

    // La sesión nueva empieza ahora: su cronómetro tiene que estar en cero.
    expect(screen.getByText('00:00:00')).toBeInTheDocument()
  })

  it('el cronómetro guardado de la sesión nueva NO debe heredar el arranque de la vieja', async () => {
    montarEn(SESION_A)
    await screen.findByText('00:00:00')
    pasarMinutos(5)

    act(() => {
      screen.getByRole('button', { name: 'ir-a-la-otra-sesion' }).click()
    })
    await screen.findByText('LEG B')

    const guardado = localStorage.getItem(`alpha-crono-${SESION_B}`)
    const transcurrido = guardado
      ? Math.floor((ahora - (JSON.parse(guardado) as { desdeEpoch: number }).desdeEpoch) / 1000)
      : 0
    // Recién entrada a LEG B: como mucho, unos segundos.
    expect(transcurrido).toBeLessThan(60)
  })

  it('entrar desde otra sesión NO debe borrar el descanso a medias de la sesión nueva', async () => {
    // Ayer/hace un rato dejó LEG B con un descanso corriendo y cerró la app.
    localStorage.setItem(
      `alpha-descanso-${SESION_B}`,
      JSON.stringify({ hasta: BASE + 90_000, totalSeg: 180 }),
    )

    montarEn(SESION_A)
    await screen.findByText('00:00:00')

    act(() => {
      screen.getByRole('button', { name: 'ir-a-la-otra-sesion' }).click()
    })
    await screen.findByText('LEG B')

    expect(localStorage.getItem(`alpha-descanso-${SESION_B}`)).not.toBeNull()
  })
})
