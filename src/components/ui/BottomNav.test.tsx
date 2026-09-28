import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { BottomNav } from './BottomNav'

function etiquetas(espacios?: 'asesorado' | 'staff') {
  render(
    <MemoryRouter>
      <BottomNav espacios={espacios} />
    </MemoryRouter>,
  )
  return screen.getAllByRole('link').map((l) => [l.textContent, l.getAttribute('href')])
}

describe('BottomNav', () => {
  it('el asesorado conserva sus cinco pestañas de siempre', () => {
    expect(etiquetas()).toEqual([
      ['Hoy', '/'],
      ['Entrenar', '/entrenar'],
      ['Bienestar', '/bienestar'],
      ['Nutrición', '/nutricion'],
      ['Progreso', '/progreso'],
    ])
  })

  it('el staff que entrena (Manuela) ve sus cuatro espacios', () => {
    expect(etiquetas('staff')).toEqual([
      ['Mi día', '/'],
      ['Mi entreno', '/entrenar'],
      ['Equipo', '/equipo'],
      ['Estrategia', '/coach/creadores'],
    ])
  })
})
