import { renderHook, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import { db, hoyIso } from '../../data/dbInstance'
import { reiniciarDb } from '../../data/mockDb'
import { XP_POR_ACCION } from '../../domain/gamification'
import { useGamificacion } from '../logros/useGamificacion'
import BienestarPage from './BienestarPage'

/**
 * EL CHECK-IN A MEDIAS (Bryan, 7-nov-2026): no se da por «Registrado» ni suma puntos hasta completarlo.
 * Seed ficticio de Valentina; nadie real.
 */
const PARCIAL = { id: 'ck-a-medias', usuarioId: 'u-valentina', calidadSueno: 'MALA' as const, parcial: true }

function pintar() {
  return render(
    <ThemeProvider><SessionProvider><MemoryRouter><BienestarPage /></MemoryRouter></SessionProvider></ThemeProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  reiniciarDb()
})

describe('Bienestar · check-in a medias', () => {
  it('no dice «Registrado»: avisa y deja el formulario abierto', () => {
    db.bienestar.guardar({ ...PARCIAL, fecha: hoyIso() })
    pintar()
    expect(screen.queryByText(/Registrado/)).not.toBeInTheDocument()
    expect(screen.getByText(/Tu check-in va a medias/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Guardar check-in/ })).toBeInTheDocument()
  })

  it('no suma puntos mientras siga a medias; completo, suma los 10 de siempre', () => {
    const antes = renderHook(() => useGamificacion('u-valentina')).result.current.xp
    db.bienestar.guardar({ ...PARCIAL, fecha: hoyIso() })
    expect(renderHook(() => useGamificacion('u-valentina')).result.current.xp).toBe(antes)
    db.bienestar.guardar({ ...PARCIAL, fecha: hoyIso(), parcial: false })
    expect(renderHook(() => useGamificacion('u-valentina')).result.current.xp).toBe(antes + XP_POR_ACCION.checkin)
  })
})
