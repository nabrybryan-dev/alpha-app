/**
 * La prueba de la costura, que es el criterio de aceptación del contrato:
 * **cambiar el vídeo no obliga a tocar ni una línea de la pantalla.** Aquí se
 * le cambia por tres cosas distintas —ninguno, uno, y uno que revienta— sin
 * tocar `CabeceraSemanal.tsx`.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

  it('con audio ofrece el reproductor y avisa que la voz es generada', async () => {
    render(<CabeceraSemanal traerEnlace={async () => ({ url: 'https://ejemplo/revision.mp3', tipo: 'audio' })} />)
    const audio = await screen.findByLabelText('Audio de tu revisión semanal')
    expect(audio).toHaveAttribute('src', 'https://ejemplo/revision.mp3')
    expect(screen.getByText(/Voz generada a partir de su voz/)).toBeInTheDocument()
  })

  describe('leer el resumen y volver a oír', () => {
    const conGuion = async () => ({
      url: 'https://ejemplo/revision.mp3',
      tipo: 'audio' as const,
      guion: 'Esta semana subiste la carga en remo.',
    })

    it('con el texto de la revisión ofrece «Leer el resumen», que lo despliega y se vuelve «Ocultar el resumen»', async () => {
      render(<CabeceraSemanal traerEnlace={conGuion} />)
      const boton = await screen.findByRole('button', { name: 'Leer el resumen' })
      expect(boton).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByText('Esta semana subiste la carga en remo.')).not.toBeInTheDocument()

      fireEvent.click(boton)
      expect(screen.getByText('Esta semana subiste la carga en remo.')).toBeInTheDocument()
      const ocultar = screen.getByRole('button', { name: 'Ocultar el resumen' })
      expect(ocultar).toHaveAttribute('aria-expanded', 'true')

      fireEvent.click(ocultar)
      expect(screen.queryByText('Esta semana subiste la carga en remo.')).not.toBeInTheDocument()
    })

    it('sin texto no hay botón: no se inventa un resumen', async () => {
      render(<CabeceraSemanal traerEnlace={async () => ({ url: 'https://ejemplo/r.mp3', tipo: 'audio' })} />)
      await screen.findByLabelText('Audio de tu revisión semanal')
      expect(screen.queryByRole('button', { name: /resumen/i })).not.toBeInTheDocument()
    })

    it('un texto en blanco tampoco cuenta como texto', async () => {
      render(<CabeceraSemanal traerEnlace={async () => ({ url: 'https://ejemplo/r.mp3', tipo: 'audio', guion: '   ' })} />)
      await screen.findByLabelText('Audio de tu revisión semanal')
      expect(screen.queryByRole('button', { name: /resumen/i })).not.toBeInTheDocument()
    })

    it('«Volver a oír» aparece al terminar de escuchar y reinicia la reproducción', async () => {
      const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
      render(<CabeceraSemanal traerEnlace={conGuion} />)
      const audio = (await screen.findByLabelText('Audio de tu revisión semanal')) as HTMLAudioElement
      expect(screen.queryByRole('button', { name: 'Volver a oír' })).not.toBeInTheDocument()

      fireEvent.ended(audio)
      const volver = screen.getByRole('button', { name: 'Volver a oír' })
      audio.currentTime = 30
      fireEvent.click(volver)
      expect(audio.currentTime).toBe(0)
      expect(play).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('button', { name: 'Volver a oír' })).not.toBeInTheDocument()
      play.mockRestore()
    })
  })
})
