import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
  it('el asesorado cambia Bienestar por Semana y conserva las otras cuatro', () => {
    expect(etiquetas()).toEqual([
      ['Hoy', '/'],
      ['Entrenar', '/entrenar'],
      ['Semana', '/semana'],
      ['Nutrición', '/nutricion'],
      ['Progreso', '/progreso'],
    ])
  })

  it('el staff ve los cinco espacios de la maqueta 7 y Praxis, en su orden', () => {
    expect(etiquetas('staff')).toEqual([
      ['Mi día', '/'],
      ['Equipo', '/equipo'],
      ['Bandeja', '/bandeja'],
      ['Empresa', '/empresa'],
      ['Praxis', '/praxis'],
      ['Yo', '/mi-entreno'],
    ])
  })

  it('cada espacio es un enlace real con su nombre escrito, no solo un icono', () => {
    render(
      <MemoryRouter>
        <BottomNav espacios="staff" />
      </MemoryRouter>,
    )
    for (const nombre of ['Mi día', 'Equipo', 'Bandeja', 'Empresa', 'Praxis', 'Yo']) {
      expect(screen.getByRole('link', { name: nombre })).toBeInTheDocument()
    }
  })

  it('Estrategias y Administración no desaparecen: se llega a ellas desde Empresa', () => {
    render(
      <MemoryRouter>
        <BottomNav espacios="staff" />
      </MemoryRouter>,
    )
    // La barra ya no las lleva como pestañas; su dirección propia sigue existiendo en las rutas
    // (Empresa las enlaza). Lo que se vigila aquí es que la barra no las prometa dos veces.
    expect(screen.queryByRole('link', { name: 'Estrategias' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Administración' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Empresa' })).toHaveAttribute('href', '/empresa')
  })
})

describe('BottomNav: agujero negro de Praxis', () => {
  const tokens = readFileSync(join(__dirname, '../../styles/tokens.css'), 'utf8').replace(/
/g, '
')

  it('Praxis (staff) pinta el agujero negro y sigue siendo enlace con nombre escrito', () => {
    render(
      <MemoryRouter>
        <BottomNav espacios="staff" />
      </MemoryRouter>,
    )
    const praxis = screen.getByRole('link', { name: 'Praxis' })
    expect(praxis).toHaveAttribute('href', '/praxis')
    expect(praxis.querySelector('svg .agujero-gira')).not.toBeNull()
    expect(praxis.querySelectorAll('ellipse')).toHaveLength(2)
  })

  it('el asesorado no ve la pestaña ni el agujero negro', () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('link', { name: 'Praxis' })).not.toBeInTheDocument()
    expect(document.querySelector('.agujero-gira')).toBeNull()
  })

  it('el giro existe y con movimiento reducido se apaga', () => {
    expect(tokens).toMatch(/\.agujero-gira\s*\{[^}]*animation:\s*agujero-gira 14s linear infinite/)
    const reducido = /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.agujero-gira\s*\{\s*animation:\s*none;/
    expect(tokens).toMatch(reducido)
  })
})
