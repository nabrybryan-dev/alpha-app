import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { TarjetasPraxis } from './TarjetasPraxis'

/**
 * LAS TARJETAS 3D DE PRAXIS (paso 8).
 *
 * No hay ninguna al abrir. Salen cuando la conversación nombra su tema, como mucho tres,
 * y llevan a una pantalla que ya existe. Con una frase de crisis se retiran y no vuelven:
 * la Quieta manda sobre cualquier atajo.
 */
function pintar() {
  return render(
    <MemoryRouter initialEntries={['/praxis']}>
      <Routes>
        <Route path="/praxis" element={<TarjetasPraxis />} />
        <Route path="/bienestar" element={<p>Pantalla Bienestar</p>} />
        <Route path="/progreso" element={<p>Pantalla Progreso</p>} />
        <Route path="/chat" element={<p>Pantalla Chat</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function dice(texto: string) {
  act(() => {
    window.dispatchEvent(new CustomEvent('praxis:frasa', { detail: { texto } }))
  })
}

function crisis() {
  act(() => {
    window.dispatchEvent(new CustomEvent('praxis:quieta'))
  })
}

describe('TarjetasPraxis', () => {
  it('al abrir no hay ninguna tarjeta', () => {
    pintar()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('nombrar el dolor las hace salir, y el toque abre lo suyo', async () => {
    pintar()
    dice('me duele el hombro derecho')
    const dolor = screen.getByRole('button', { name: /Me duele algo/ })
    expect(screen.getByRole('button', { name: /Escribir a mi coach/ })).toBeInTheDocument()

    await userEvent.click(dolor)

    expect(screen.getByText('Pantalla Bienestar')).toBeInTheDocument()
  })

  it('«cómo voy» lleva a Progreso', async () => {
    pintar()
    dice('¿cómo voy esta semana?')
    await userEvent.click(screen.getByRole('button', { name: /¿Cómo voy\?/ }))
    expect(screen.getByText('Pantalla Progreso')).toBeInTheDocument()
  })

  it('nunca enseña más de tres', () => {
    pintar()
    dice('me duele la rodilla, quiero ver mi progreso y hablar con mi coach')
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('con una frase de crisis se retiran todas y no vuelven', () => {
    pintar()
    dice('me duele la rodilla')
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0)

    crisis()

    expect(screen.queryAllByRole('button')).toHaveLength(0)
    dice('me duele la rodilla otra vez')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
