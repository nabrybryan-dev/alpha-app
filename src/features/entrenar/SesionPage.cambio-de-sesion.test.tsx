/**
 * ✅ TESTS DE REGRESIÓN. Nacieron rojos, documentando un fallo real de la
 * auditoría de carreras y estado compartido (2026-07-27). **Ya está corregido**:
 * `SesionPage` envuelve la pantalla en `<SesionEnCurso key={sesionId} />`, que
 * fuerza el remontaje al cambiar de sesión (ver `SesionPage.tsx:65-82`).
 * Estos tests se quedan para que el fallo no vuelva.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * EL FALLO QUE DOCUMENTAN (histórico)
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

/**
 * Precalentar el import perezoso ANTES de renderizar.
 *
 * `AppRouter` monta `SesionPage` con `lazy()`, así que la primera aserción no
 * esperaba al cronómetro: esperaba a que resolviera un `import()` dinámico. Con
 * la suite entera en paralelo eso pasaba de los 5 s y el volcado del fallo lo
 * decía —el DOM seguía en «Cargando…», el fallback de Suspense—, pero como el
 * mensaje hablaba de `00:00:00` parecía cosa del cronómetro. Aislado no falla
 * nunca; solo bajo carga.
 *
 * Subir más el tiempo de espera no arregla nada: alarga la suite cuando falla y
 * sigue siendo una carrera. Teniendo el módulo ya en la caché, Suspense resuelve
 * en el primer microtask y la espera vuelve a medir lo que dice medir.
 */
async function precalentarSesionPage() {
  await import('./SesionPage')
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
  beforeEach(async () => {
    localStorage.clear()
    ahora = BASE
    vi.spyOn(Date, 'now').mockImplementation(() => ahora)
    await precalentarSesionPage()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('el cronómetro NO debe arrastrar el tiempo de la sesión anterior', async () => {
    montarEn(SESION_A)
    // El import perezoso ya viene precalentado, así que esto solo espera al
    // cronómetro. El margen se queda como red por si la suite va muy cargada.
    expect(await screen.findByText('00:00:00', undefined, { timeout: 5000 })).toBeInTheDocument()

    pasarMinutos(5)
    // `findByText` y no `getByText`: el refresco del cronómetro llega por evento,
    // y con la suite completa en paralelo el flush puede caer un tick más tarde.
    // Con la aserción sincrónica este test fallaba de forma intermitente.
    expect(await screen.findByText('00:05:00')).toBeInTheDocument()

    // Se da cuenta de que hoy le toca la otra sesión y entra a ella.
    act(() => {
      screen.getByRole('button', { name: 'ir-a-la-otra-sesion' }).click()
    })
    expect(await screen.findByText('LEG B')).toBeInTheDocument()

    // La sesión nueva empieza ahora: su cronómetro tiene que estar en cero.
    //
    // `findByText` y no `getByText`, por lo mismo que doce líneas más arriba: el
    // encabezado de LEG B aparece en cuanto remonta, pero el cronómetro se pinta
    // en el tick siguiente. Con la suite entera en paralelo ese tick llega tarde
    // y este test fallaba una de cada varias pasadas -sin que nada estuviera
    // roto-. Un rojo intermitente enseña a ignorar los rojos, que es como se
    // cuela el fallo de verdad.
    expect(await screen.findByText('00:00:00')).toBeInTheDocument()
    // Y el tiempo de la sesión vieja no puede seguir en pantalla: es el fallo
    // que estos tests existen para cazar, y esperar no lo puede disimular.
    expect(screen.queryByText('00:05:00')).not.toBeInTheDocument()
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
