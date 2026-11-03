import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Sesion } from '../../../../domain/types'
import { GuiaDePraxis, type GuiaDePraxisProps } from './GuiaDePraxis'
import { LLAVE_MODO_DE_LA_GUIA } from './modoDeLaGuia'

const sesion = { id: 's', nombre: 'FULL C', orden: 1, ejercicios: [] } as unknown as Sesion

function props(): GuiaDePraxisProps {
  return {
    estado: 'cua', sesion, semana: [sesion], series: {}, doloridas: [], porTrabajar: [], capa: 'musculo', rango: 'hoy',
    alIr: vi.fn(), alCambiarCapa: vi.fn(), alCambiarRango: vi.fn(), alVerMovimiento: vi.fn(),
  }
}

describe('la zona en versión simple o técnica', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('por defecto sale la técnica, igual que antes, con el interruptor en Técnico', () => {
    render(<GuiaDePraxis {...props()} />)
    expect(screen.getByText('Línea frontal superficial')).toBeInTheDocument()
    expect(screen.queryByText('Estira la rodilla, como al ponerte de pie')).toBeNull()
    expect(screen.getByRole('button', { name: 'Técnico' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Simple' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('Simple cambia el contenido a las palabras llanas y se recuerda', () => {
    const { unmount } = render(<GuiaDePraxis {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Simple' }))
    expect(screen.getByText('Estira la rodilla, como al ponerte de pie')).toBeInTheDocument()
    expect(screen.getByText(/sin conexión comprobada/)).toBeInTheDocument()
    expect(screen.getByText(/No está demostrado que la fuerza viaje/)).toBeInTheDocument()
    expect(screen.queryByText('Línea frontal superficial')).toBeNull()
    expect(localStorage.getItem(LLAVE_MODO_DE_LA_GUIA)).toBe('simple')
    unmount()
    render(<GuiaDePraxis {...props()} />)
    expect(screen.getByText('Estira la rodilla, como al ponerte de pie')).toBeInTheDocument()
  })

  it('volver a Técnico devuelve lo de hoy', () => {
    render(<GuiaDePraxis {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Simple' }))
    fireEvent.click(screen.getByRole('button', { name: 'Técnico' }))
    expect(screen.getByText('Línea frontal superficial')).toBeInTheDocument()
  })

  it('sin localStorage la zona se dibuja bien y en técnico', () => {
    const espia = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    render(<GuiaDePraxis {...props()} />)
    expect(screen.getByText('Línea frontal superficial')).toBeInTheDocument()
    espia.mockRestore()
  })
})
