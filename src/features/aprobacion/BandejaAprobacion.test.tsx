import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { DomingoDeFirma } from '../../domain/aprobacion/puerta'
import { BandejaAprobacion, type BorradorPendiente } from './BandejaAprobacion'

/**
 * La bandeja no decide nada —eso es de `domain/aprobacion/puerta.ts`— pero sí tiene que
 * DECIR lo que la puerta decidió, y decirlo con su motivo. Una puerta que se abre sola y en
 * silencio es la forma de enterarse por un asesorado.
 */

const limpio = (fecha: string): DomingoDeFirma => ({
  fecha,
  borradores: 6,
  aprobadosSinTocar: 6,
  corregidos: 0,
})

const BORRADOR: BorradorPendiente = {
  id: 'b1',
  para: 'Valentina',
  texto: 'Esta semana hiciste 4 de 5 sesiones.',
}

describe('la bandeja de firma', () => {
  it('con la puerta cerrada dice CUÁNTO falta, no solo que está cerrada', () => {
    render(
      <BandejaAprobacion
        pendientes={[BORRADOR]}
        historial={[limpio('2026-08-23'), limpio('2026-08-30')]}
        onAprobar={() => {}}
        onCorregir={() => {}}
      />,
    )
    expect(document.querySelector('[data-puerta="cerrada"]')).not.toBeNull()
    expect(screen.getByText(/2 de 4 domingos/)).toBeTruthy()
  })

  it('y distingue «faltan domingos» de «quedaron sin mirar»', () => {
    // Son dos cosas que llevan a acciones distintas: la primera es esperar, la segunda es
    // que la bandeja se quedó a medias. Si las dos dijeran «cerrada», no serviría de nada.
    const sinMirar: DomingoDeFirma = {
      fecha: '2026-09-06',
      borradores: 23,
      aprobadosSinTocar: 17,
      corregidos: 0,
    }
    render(
      <BandejaAprobacion
        pendientes={[]}
        historial={[limpio('2026-08-16'), limpio('2026-08-23'), limpio('2026-08-30'), sinMirar]}
        onAprobar={() => {}}
        onCorregir={() => {}}
      />,
    )
    expect(screen.getByText(/sin abrir/)).toBeTruthy()
  })

  it('con la puerta abierta lo dice, y dice cómo se cierra', () => {
    render(
      <BandejaAprobacion
        pendientes={[]}
        historial={['2026-08-16', '2026-08-23', '2026-08-30', '2026-09-06'].map(limpio)}
        onAprobar={() => {}}
        onCorregir={() => {}}
      />,
    )
    expect(document.querySelector('[data-puerta="abierta"]')).not.toBeNull()
    expect(screen.getByText(/vuelve a cerrarse/)).toBeTruthy()
  })

  it('AVISA de que un borrador lleva la cara y la voz', () => {
    // Aprobar un texto es aprobar unas palabras. Aprobar esto es dejar salir tu cara y tu
    // voz clonadas diciéndole números a alguien. Si la bandeja no lo distingue, se firma
    // igual de rápido lo uno que lo otro.
    render(
      <BandejaAprobacion
        pendientes={[{ ...BORRADOR, conVideo: true }]}
        historial={[]}
        onAprobar={() => {}}
        onCorregir={() => {}}
      />,
    )
    expect(screen.getByText(/tu cara y tu voz/)).toBeTruthy()
  })

  it('firmar y corregir avisan con el borrador que toca', async () => {
    const aprobar = vi.fn()
    const corregir = vi.fn()
    const usuario = userEvent.setup()
    render(
      <BandejaAprobacion
        pendientes={[BORRADOR]}
        historial={[]}
        onAprobar={aprobar}
        onCorregir={corregir}
      />,
    )
    await usuario.click(screen.getByRole('button', { name: 'Sale tal cual' }))
    await usuario.click(screen.getByRole('button', { name: 'Corregir' }))
    expect(aprobar).toHaveBeenCalledWith('b1')
    expect(corregir).toHaveBeenCalledWith('b1')
  })

  it('sin borradores lo dice, en vez de dejar el hueco en blanco', () => {
    render(
      <BandejaAprobacion pendientes={[]} historial={[]} onAprobar={() => {}} onCorregir={() => {}} />,
    )
    expect(document.querySelector('[data-vacia]')).not.toBeNull()
  })
})
