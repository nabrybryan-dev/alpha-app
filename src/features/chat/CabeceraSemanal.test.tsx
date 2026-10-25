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
    expect(await screen.findByText('Tu revisión en audio llega el viernes.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Vídeo de tu revisión semanal')).not.toBeInTheDocument()
  })

  it('con enlace, monta el reproductor con esa dirección', async () => {
    render(<CabeceraSemanal traerEnlace={async () => ({ url: 'https://ejemplo/cabecera.mp4', tipo: 'video' })} />)
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
      expect(screen.getByText('Tu revisión en audio llega el viernes.')).toBeInTheDocument(),
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

  it('con audio ofrece el reproductor y avisa que el mensaje y la voz son generados', async () => {
    render(<CabeceraSemanal traerEnlace={async () => ({ url: 'https://ejemplo/revision.mp3', tipo: 'audio' })} />)
    const audio = await screen.findByLabelText('Audio de tu revisión semanal')
    expect(audio).toHaveAttribute('src', 'https://ejemplo/revision.mp3')
    expect(
      screen.getByText('Mensaje automático con voz generada a partir de la voz de Bryan.'),
    ).toBeInTheDocument()
  })

  it('no dice que una persona lo revisó: desde la firma automática sería falso', async () => {
    // Decisión de Bryan del 21-oct: los mensajes semanales salen solos, sin revisión humana. La
    // cabecera no puede afirmar lo contrario a quien lo oye.
    const { container } = render(
      <CabeceraSemanal traerEnlace={async () => ({ url: 'https://ejemplo/revision.mp3', tipo: 'audio' })} />,
    )
    await screen.findByLabelText('Audio de tu revisión semanal')
    expect(container.textContent ?? '').not.toMatch(/revisi[oó]n humana|revisad[oa] por|aprobad[oa] por/i)
  })
})
