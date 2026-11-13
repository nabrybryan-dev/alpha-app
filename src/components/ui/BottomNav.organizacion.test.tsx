import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { BottomNav } from './BottomNav'

const etiquetas = () => screen.getAllByRole('link').map((a) => a.textContent)

describe('la barra obedece lo que la persona organizó', () => {
  it('sin organización, la barra de siempre', () => {
    render(<MemoryRouter><BottomNav /></MemoryRouter>)
    expect(etiquetas()[0]).toBe('Hoy')
    expect(etiquetas()).toContain('Progreso')
  })

  it('esconde la pantalla escondida y Hoy sigue primero aunque otra suba', () => {
    render(<MemoryRouter><BottomNav organizacion={{ ocultas: new Set(['pantalla:/progreso']), movidas: { 'pantalla:/nutricion': -5 } }} /></MemoryRouter>)
    const e = etiquetas()
    expect(e).not.toContain('Progreso')
    expect(e[0]).toBe('Hoy')
    expect(e[1]).toBe('Nutrición')
  })
})
