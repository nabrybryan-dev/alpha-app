import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { BarraCoach } from './BarraCoach'

const pintar = (props: Partial<Parameters<typeof BarraCoach>[0]> = {}) =>
  render(
    <MemoryRouter>
      <BarraCoach
        iniciales="SC"
        noLeidos={0}
        ultimoTexto={undefined}
        onEnviar={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  )

describe('BarraCoach', () => {
  it('invita a escribirle al coach', () => {
    pintar()
    expect(screen.getByText(/escríbele a tu coach/i)).toBeInTheDocument()
  })

  it('muestra el contador y el último mensaje cuando hay sin leer', () => {
    pintar({ noLeidos: 3, ultimoTexto: 'Subiste bien esta semana' })
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText(/subiste bien/i)).toBeInTheDocument()
  })

  it('envía el texto escrito', async () => {
    const onEnviar = vi.fn()
    pintar({ onEnviar })
    await userEvent.type(screen.getByPlaceholderText(/mensaje/i), 'me duele el hombro')
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }))
    expect(onEnviar).toHaveBeenCalledWith({ texto: 'me duele el hombro', archivo: undefined })
  })

  it('no envía nada si no hay texto ni archivo', async () => {
    const onEnviar = vi.fn()
    pintar({ onEnviar })
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }))
    expect(onEnviar).not.toHaveBeenCalled()
  })

  /**
   * El fallo que estamos arreglando: hasta ahora se aceptaba cualquier archivo y
   * se enviaba solo su NOMBRE. Nada que no se pueda mandar entra aqui.
   */
  it('rechaza un video demasiado grande antes de enviarlo', async () => {
    const onEnviar = vi.fn()
    pintar({ onEnviar })
    const grande = new File(['x'], 'v.mp4', { type: 'video/mp4' })
    Object.defineProperty(grande, 'size', { value: 40_000_000 })
    await userEvent.upload(screen.getByLabelText(/foto o video/i), grande)
    expect(screen.getByRole('alert')).toHaveTextContent(/25 MB/)
    expect(onEnviar).not.toHaveBeenCalled()
  })

  it('deja quitar un archivo ya elegido', async () => {
    pintar()
    const foto = new File(['x'], 'sentadilla.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText(/foto o video/i), foto)
    expect(screen.getByText('sentadilla.jpg')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /quitar/i }))
    expect(screen.queryByText('sentadilla.jpg')).not.toBeInTheDocument()
  })
})
