/**
 * La prueba de la costura, que es el criterio de aceptación del contrato:
 * **cambiar el vídeo no obliga a tocar ni una línea de la pantalla.** Aquí se
 * le cambia por tres cosas distintas —ninguno, uno, y uno que revienta— sin
 * tocar `CabeceraSemanal.tsx`.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CabeceraSemanal } from './CabeceraSemanal'

describe('la cabecera de la revisión semanal', () => {
  afterEach(cleanup)

  it('sin vídeo todavía, lo dice en vez de dejar un hueco negro', async () => {
    render(<CabeceraSemanal traerEnlace={async () => null} />)
    expect(await screen.findByText('Tu revisión en vídeo llega el domingo.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Vídeo de tu revisión semanal')).not.toBeInTheDocument()
  })

  it('con enlace, monta el reproductor con esa dirección', async () => {
    render(<CabeceraSemanal traerEnlace={async () => ({ url: 'https://ejemplo/cabecera.mp4' })} />)
    const video = await screen.findByLabelText('Vídeo de tu revisión semanal')
    expect(video).toHaveAttribute('src', 'https://ejemplo/cabecera.mp4')
  })

  it('si el enlace falla, la pantalla sigue viva y la conversación no se bloquea', async () => {
    render(
      <CabeceraSemanal
        traerEnlace={async () => {
          throw new Error('el cajón no contestó')
        }}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('Tu revisión en vídeo llega el domingo.')).toBeInTheDocument(),
    )
  })

  it('guarda el hueco de la tarjeta con los números de la persona', async () => {
    render(
      <CabeceraSemanal traerEnlace={async () => null}>
        <p>Tu semana, Valentina</p>
      </CabeceraSemanal>,
    )
    const region = screen.getByRole('region', { name: 'Tu revisión de la semana' })
    expect(region).toContainElement(screen.getByText('Tu semana, Valentina'))
  })
})
