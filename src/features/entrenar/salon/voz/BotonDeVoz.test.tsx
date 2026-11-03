import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BotonDeVoz } from './BotonDeVoz'

class Falso {
  static ultimo: Falso
  lang = ''
  interimResults = false
  continuous = true
  maxAlternatives = 0
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: { error?: string }) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn(() => this.onend?.())
  abort = vi.fn()
  constructor() {
    Falso.ultimo = this
  }
  decir(texto: string) {
    const resultado = Object.assign([{ transcript: texto }], { isFinal: true })
    this.onresult?.({ resultIndex: 0, results: [resultado] })
    this.onend?.()
  }
}

const ventana = window as unknown as { webkitSpeechRecognition?: unknown }

describe('el micrófono de la guía', () => {
  beforeEach(() => {
    ventana.webkitSpeechRecognition = Falso
  })
  afterEach(() => {
    delete ventana.webkitSpeechRecognition
  })

  it('sin reconocedor en el navegador no se pinta', () => {
    delete ventana.webkitSpeechRecognition
    const { container } = render(<BotonDeVoz alOir={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('no escucha hasta que lo tocan, y entrega lo dicho y enseña la respuesta', () => {
    const alOir = vi.fn(() => 'Cuádriceps')
    render(<BotonDeVoz alOir={alOir} />)
    expect(screen.queryByText('Te escucho…')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /orden a Praxis/ }))
    expect(Falso.ultimo.start).toHaveBeenCalled()
    expect(Falso.ultimo.lang).toBe('es-CO')
    expect(screen.getByText('Te escucho…')).toBeInTheDocument()
    act(() => Falso.ultimo.decir('muéstrame cuádriceps'))
    expect(alOir).toHaveBeenCalledWith('muéstrame cuádriceps')
    expect(screen.getByText('Cuádriceps')).toBeInTheDocument()
  })

  it('un segundo toque deja de escuchar', () => {
    render(<BotonDeVoz alOir={vi.fn(() => '')} />)
    fireEvent.click(screen.getByRole('button', { name: /orden a Praxis/ }))
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Dejar de escuchar' }))
    })
    expect(Falso.ultimo.stop).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /orden a Praxis/ })).toBeInTheDocument()
  })

  it('sin permiso de micrófono lo dice en vez de quedarse callado', () => {
    const alOir = vi.fn(() => '')
    render(<BotonDeVoz alOir={alOir} />)
    fireEvent.click(screen.getByRole('button', { name: /orden a Praxis/ }))
    act(() => {
      Falso.ultimo.onerror?.({ error: 'not-allowed' })
      Falso.ultimo.onend?.()
    })
    expect(alOir).not.toHaveBeenCalled()
    expect(screen.getByText(/micrófono/)).toBeInTheDocument()
  })

  it('al desmontar aborta: no se queda escuchando', () => {
    const { unmount } = render(<BotonDeVoz alOir={vi.fn(() => '')} />)
    fireEvent.click(screen.getByRole('button', { name: /orden a Praxis/ }))
    const rec = Falso.ultimo
    unmount()
    expect(rec.abort).toHaveBeenCalled()
  })
})
