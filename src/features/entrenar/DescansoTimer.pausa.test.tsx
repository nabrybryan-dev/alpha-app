/**
 * ⚠️ ESTOS TESTS FALLAN A PROPÓSITO. Documentan fallos REALES que NO están
 * arreglados (auditoría de carreras y estado compartido, 2026-07-27).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * EL FALLO
 * ────────────────────────────────────────────────────────────────────────────
 * `SesionPage.tsx:513` monta el descanso con `key={descanso.hasta}`, y
 * `SesionPage.tsx:517` (`onMas15`) cambia justamente `hasta`. Cambiar la `key`
 * DESMONTA y vuelve a montar el componente, así que se pierde todo su estado
 * interno — y ese estado no es decorativo: `DescansoTimer.tsx:36-41` guarda ahí
 * si el descanso está en pausa (`pausado`) y cuánto tiempo lleva pausado
 * (`desfaseMs`), que es lo único que compensa el reloj de pared mientras la
 * cuenta atrás está congelada.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * QUÉ LE PASA A LA PERSONA QUE ENTRENA
 * ────────────────────────────────────────────────────────────────────────────
 * Está descansando entre series de hip thrust. Le entra un mensaje, pausa el
 * descanso y contesta un minuto. Vuelve, ve que necesita un poco más y toca
 * "+15s".
 *
 *   - La pausa se cancela sola (el letrero "en pausa" desaparece) sin que ella
 *     haya tocado el botón de pausa.
 *   - Y el minuto que estuvo pausada se le descuenta de golpe: pide 15 segundos
 *     más y el descanso salta de 1:40 a 0:55.
 *
 * Es la misma familia que el bug del proveedor de sesión: estado vivo que se
 * pierde porque algo remonta el componente por debajo.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DescansoTimer } from './DescansoTimer'

const BASE = new Date('2026-07-27T10:00:00Z').getTime()

function avanzar(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

/**
 * Réplica exacta de cómo `SesionPage` monta el descanso (líneas 511-518),
 * incluida la `key`.
 */
function ZonaDeDescanso() {
  const [descanso, setDescanso] = useState({ hasta: BASE + 120_000, totalSeg: 120 })
  return (
    <DescansoTimer
      key={descanso.hasta}
      hasta={descanso.hasta}
      totalSeg={descanso.totalSeg}
      onCerrar={() => {}}
      onMas15={() => setDescanso((d) => ({ hasta: d.hasta + 15_000, totalSeg: d.totalSeg + 15 }))}
    />
  )
}

describe('pedir +15 s con el descanso en pausa', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(BASE)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('+15s NO debe cancelar la pausa que la persona puso', () => {
    render(<ZonaDeDescanso />)
    avanzar(20_000) // 1:40
    fireEvent.click(screen.getByRole('button', { name: 'Pausar descanso' }))
    avanzar(60_000) // contesta el mensaje

    fireEvent.click(screen.getByRole('button', { name: '+15s' }))

    expect(screen.getByText('Descanso · en pausa')).toBeInTheDocument()
  })

  it('+15s NO debe descontar el tiempo que el descanso estuvo en pausa', () => {
    render(<ZonaDeDescanso />)
    avanzar(20_000) // 1:40
    fireEvent.click(screen.getByRole('button', { name: 'Pausar descanso' }))
    avanzar(60_000) // 60 s en pausa: no deben contar
    expect(screen.getByText('1:40')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '+15s' }))

    // 1:40 congelado + 15 s pedidos = 1:55.
    expect(screen.getByText('1:55')).toBeInTheDocument()
  })
})

/**
 * ⚠️ TAMBIÉN FALLA A PROPÓSITO, pero este solo afecta al desarrollo.
 *
 * `DescansoTimer.tsx:49-55` mete efectos secundarios DENTRO del actualizador de
 * estado: `setPausado((p) => { … desfaseMs.current += … })`. React invoca los
 * actualizadores dos veces bajo `<StrictMode>` en desarrollo (y `main.tsx:7`
 * envuelve toda la app en StrictMode), así que el tiempo pausado se acredita
 * DOS veces: 30 s de pausa se convierten en 60 s de descanso extra.
 *
 * En el build de producción StrictMode no duplica nada, así que a los 19
 * asesorados NO les pasa. Se deja documentado porque es exactamente el patrón
 * "no idempotente ante doble ejecución" que buscaba esta auditoría, y porque
 * hace que probar la pausa en `npm run dev` dé números que no son los reales.
 */
describe('pausa/reanudación bajo StrictMode (solo desarrollo)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(BASE)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('el tiempo pausado NO debe acreditarse dos veces', () => {
    render(
      <StrictMode>
        <DescansoTimer hasta={BASE + 120_000} totalSeg={120} onCerrar={vi.fn()} onMas15={vi.fn()} />
      </StrictMode>,
    )
    avanzar(20_000) // 1:40
    fireEvent.click(screen.getByRole('button', { name: 'Pausar descanso' }))
    avanzar(30_000) // 30 s en pausa
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar descanso' }))
    avanzar(15_000) // 15 s corriendo

    // 20 + 15 = 35 s efectivos → 120 - 35 = 85 s → "1:25".
    // Con la pausa acreditada dos veces sale "1:55".
    expect(screen.getByText('1:25')).toBeInTheDocument()
  })
})
