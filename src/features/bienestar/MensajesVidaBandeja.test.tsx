import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MensajesVidaBandeja } from './MensajesVidaBandeja'
import * as mensajesVida from '../../data/vida/mensajesVida'
import type { MensajeVida } from '../../data/vida/mensajesVida'

vi.mock('../../data/vida/mensajesVida', async () => {
  const real = await vi.importActual<typeof mensajesVida>('../../data/vida/mensajesVida')
  return { ...real, mensajesVidaDe: vi.fn() }
})

const ASESORADA = 'u-valentina'

function mensaje(extra: Partial<MensajeVida> = {}): MensajeVida {
  return {
    id: 'mv-1',
    usuarioId: ASESORADA,
    texto: 'Sal a caminar 10 minutos antes de las 10am.',
    tipo: 'prescripcion_vida',
    enviarDespuesDe: '2026-09-27T10:00:00Z',
    enviadoEn: null,
    detenidoEn: null,
    creadoEn: '2026-09-27T08:00:00Z',
    ...extra,
  }
}

describe('MensajesVidaBandeja', () => {
  it('sin mensajes, no pinta nada — ni un "no tienes mensajes"', async () => {
    vi.mocked(mensajesVida.mensajesVidaDe).mockResolvedValue([])
    const { container } = render(<MensajesVidaBandeja usuarioId={ASESORADA} />)

    await waitFor(() => expect(mensajesVida.mensajesVidaDe).toHaveBeenCalledWith(ASESORADA))
    expect(container).toBeEmptyDOMElement()
  })

  it('pinta el texto de cada mensaje que llega', async () => {
    vi.mocked(mensajesVida.mensajesVidaDe).mockResolvedValue([mensaje()])
    render(<MensajesVidaBandeja usuarioId={ASESORADA} />)

    expect(await screen.findByText(/sal a caminar 10 minutos/i)).toBeTruthy()
  })

  it('un mensaje de ayuda_animo lleva su distintivo', async () => {
    vi.mocked(mensajesVida.mensajesVidaDe).mockResolvedValue([
      mensaje({ tipo: 'ayuda_animo', texto: 'Si necesitas hablar con alguien, Línea 106.' }),
    ])
    render(<MensajesVidaBandeja usuarioId={ASESORADA} />)

    await screen.findByText(/línea 106/i)
    expect(screen.getByText(/ayuda/i)).toBeTruthy()
  })
})
