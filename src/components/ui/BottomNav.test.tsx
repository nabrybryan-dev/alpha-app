import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { BottomNav } from './BottomNav'
import { BARRA_MAQUETA_ACTIVA, conPraxisAlCentro } from '../../domain/barraMaqueta'

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
  const tokens = readFileSync(join(__dirname, '../../styles/tokens.css'), 'utf8').replace(/\r\n/g, '\n')

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

describe('BottomNav: barra de la maqueta (B2, detrás de bandera)', () => {
  function pintar(espacios: 'asesorado' | 'staff', barraMaqueta?: boolean, ruta = '/') {
    return render(
      <MemoryRouter initialEntries={[ruta]}>
        <BottomNav espacios={espacios} barraMaqueta={barraMaqueta} />
      </MemoryRouter>,
    )
  }
  const lista = () => screen.getAllByRole('link').map((l) => [l.textContent, l.getAttribute('href')])

  it('la bandera viene apagada y la barra de hoy no cambia', () => {
    expect(BARRA_MAQUETA_ACTIVA).toBe(false)
    const { container } = pintar('staff')
    expect(container.querySelector('[data-barra="maqueta"]')).toBeNull()
    expect(container.querySelector('nav')?.className).toContain('flex justify-center px-3')
    expect(container.querySelector('.rounded-full.glass')).not.toBeNull()
  })

  it('encendida, el equipo ve las mismas seis pestañas con Praxis al centro', () => {
    pintar('staff', true)
    expect(lista()).toEqual([
      ['Mi día', '/'],
      ['Equipo', '/equipo'],
      ['Bandeja', '/bandeja'],
      ['Praxis', '/praxis'],
      ['Empresa', '/empresa'],
      ['Yo', '/mi-entreno'],
    ])
  })

  it('encendida, el asesorado conserva sus cinco pestañas y no ve Praxis', () => {
    pintar('asesorado', true)
    expect(lista()).toEqual([
      ['Hoy', '/'],
      ['Entrenar', '/entrenar'],
      ['Semana', '/semana'],
      ['Nutrición', '/nutricion'],
      ['Progreso', '/progreso'],
    ])
    expect(screen.queryByRole('link', { name: 'Praxis' })).not.toBeInTheDocument()
  })

  it('el indicador rojo solo se enciende en la pestaña activa y cada enlace lleva su nombre escrito', () => {
    const { container } = pintar('staff', true, '/equipo')
    const barra = container.querySelector('[data-barra="maqueta"]')
    expect(barra).not.toBeNull()
    const activos = barra!.querySelectorAll('[data-indicador="activo"]')
    expect(activos).toHaveLength(1)
    expect(activos[0].closest('a')).toHaveAttribute('href', '/equipo')
    expect(activos[0].className).toContain('bg-rojo')
    expect(barra!.querySelectorAll('[data-indicador="inactivo"]')).toHaveLength(5)
    for (const nombre of ['Mi día', 'Equipo', 'Bandeja', 'Praxis', 'Empresa', 'Yo']) {
      expect(screen.getByRole('link', { name: nombre })).toBeInTheDocument()
    }
  })

  it('respeta la zona segura de abajo y el movimiento reducido', () => {
    const { container } = pintar('staff', true)
    const barra = container.querySelector<HTMLElement>('[data-barra="maqueta"]')!
    // jsdom descarta en silencio los valores env(...) del estilo en línea: se comprueba en el código de la barra.
    const fuente = readFileSync(join(__dirname, 'BottomNav.tsx'), 'utf8')
    expect(fuente).toMatch(/paddingBottom:\s*'env\(safe-area-inset-bottom/)
    expect(barra.style.zIndex).toBe('var(--z-nav)')
    expect(container.querySelector('[data-indicador]')!.className).toContain('motion-reduce:transition-none')
  })

  it('conPraxisAlCentro no pierde ni inventa pestañas', () => {
    const rutas = ['/', '/a', '/b', '/c', '/praxis', '/d']
    const salida = conPraxisAlCentro(rutas.map((ruta) => ({ ruta })))
    expect(salida.map((p) => p.ruta).sort()).toEqual([...rutas].sort())
    expect(salida[3].ruta).toBe('/praxis')
    expect(conPraxisAlCentro([{ ruta: '/' }, { ruta: '/x' }]).map((p) => p.ruta)).toEqual(['/', '/x'])
  })
})
