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

  it('el staff que entrena (Manuela) ve sus cinco espacios, en el orden de la maqueta', () => {
    expect(etiquetas('staff')).toEqual([
      ['Mi día', '/'],
      ['Mi entreno', '/mi-entreno'],
      ['Equipo', '/equipo'],
      ['Estrategias', '/coach/estrategias'],
      ['Administración', '/coach/administracion'],
    ])
  })

  it('cada espacio es un enlace real con su nombre escrito, no solo un icono', () => {
    render(
      <MemoryRouter>
        <BottomNav espacios="staff" />
      </MemoryRouter>,
    )
    for (const nombre of ['Mi día', 'Mi entreno', 'Equipo', 'Estrategias', 'Administración']) {
      expect(screen.getByRole('link', { name: nombre })).toBeInTheDocument()
    }
  })
})
