import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Con la bandera ENCENDIDA (simulada: en el código sigue en false).
vi.mock('./banderas', () => ({ PRAXIS_UN_TOQUE_ACTIVO: true, PRAXIS_UN_TOQUE_CHARLA: false }))

import { BottomNav } from '../../../components/ui/BottomNav'
import { CapaPraxis, ID_DE_LA_CAPA } from './CapaPraxis'
import { _reiniciarCapaParaPruebas, capaAbierta } from './estadoCapa'
import { TEXTOS_PENDIENTES as P } from './textos'

afterEach(() => _reiniciarCapaParaPruebas())

function pantalla() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <BottomNav espacios="staff" />
      <CapaPraxis
        perfil={{ rol: 'asesorado', capacidades: new Set() }}
        pantallaActual="/"
        navegar={() => {}}
        alAvisarCoachDeSalud={() => {}}
        alAbrirCheckin={() => {}}
      />
    </MemoryRouter>,
  )
}

describe('Praxis a un toque: bandera encendida', () => {
  it('el botón de Praxis de la barra deja de ser un enlace y es un botón con aria-expanded', () => {
    const { container } = pantalla()
    expect(container.querySelector('a[href="/praxis"]')).toBeNull()
    const b = screen.getByRole('button', { name: P.botonCerrado })
    expect(b).toHaveAttribute('aria-expanded', 'false')
    expect(b).toHaveAttribute('aria-controls', ID_DE_LA_CAPA)
  })

  it('UN toque abre la capa y otro toque la cierra', async () => {
    const u = userEvent.setup()
    pantalla()
    await u.click(screen.getByRole('button', { name: P.botonCerrado }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(capaAbierta()).toBe(true)
    const abierto = screen.getByRole('button', { name: P.botonAbierto })
    expect(abierto).toHaveAttribute('aria-expanded', 'true')
    await u.click(abierto)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(capaAbierta()).toBe(false)
  })

  it('al cerrar con Escape el foco vuelve al botón de la barra', async () => {
    const u = userEvent.setup()
    pantalla()
    const b = screen.getByRole('button', { name: P.botonCerrado })
    await u.click(b)
    await u.keyboard('{Escape}')
    await act(async () => {})
    expect(screen.getByRole('button', { name: P.botonCerrado })).toHaveFocus()
  })

  it('las otras pestañas de la barra siguen siendo enlaces', () => {
    pantalla()
    expect(screen.getByRole('link', { name: 'Equipo' })).toHaveAttribute('href', '/equipo')
  })
})
