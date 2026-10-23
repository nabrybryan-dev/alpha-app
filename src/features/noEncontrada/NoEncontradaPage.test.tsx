import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import NoEncontradaPage from './NoEncontradaPage'

function Sonda() {
  return <output aria-label="ruta actual">{useLocation().pathname}</output>
}

function montar() {
  return render(
    <MemoryRouter initialEntries={['/esta-pagina-no-existe']}>
      <Sonda />
      <Routes>
        <Route path="/" element={<p>Pantalla de Hoy</p>} />
        <Route path="*" element={<NoEncontradaPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('pantalla «no encontrada»', () => {
  it('dice «Esta página no existe»', () => {
    montar()
    expect(screen.getByRole('heading', { name: 'Esta página no existe' })).toBeInTheDocument()
  })

  it('tiene un botón a Hoy que lleva a «/»', async () => {
    montar()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ir a Hoy' }))
    expect(screen.getByLabelText('ruta actual')).toHaveTextContent('/')
    expect(screen.getByText('Pantalla de Hoy')).toBeInTheDocument()
  })

  it('el botón mide 44 px de alto para el pulgar', () => {
    montar()
    expect(screen.getByRole('button', { name: 'Ir a Hoy' }).className).toMatch(/min-h-\[44px\]/)
  })
})
