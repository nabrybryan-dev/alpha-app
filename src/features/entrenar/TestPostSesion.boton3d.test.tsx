import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TestPostSesion } from './TestPostSesion'

describe('TestPostSesion — la acción principal es el botón con cuerpo', () => {
  afterEach(cleanup)

  it('«Finalizar sesión» lleva btn-3d, nace apagado y, completo, guarda igual que antes', () => {
    const onGuardar = vi.fn()
    render(<TestPostSesion onGuardar={onGuardar} sesionId="s1" />)
    const finalizar = screen.getByRole('button', { name: 'Finalizar sesión' })
    expect(finalizar).toHaveClass('btn-3d')
    expect(finalizar).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: 'NORMAL' }))
    expect(finalizar).toBeEnabled()
    fireEvent.click(finalizar)
    expect(onGuardar).toHaveBeenCalledTimes(1)
  })
})
