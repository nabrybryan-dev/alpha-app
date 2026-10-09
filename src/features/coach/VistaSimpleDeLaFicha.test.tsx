import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/dbInstance'
import { VistaSimpleDeLaFicha } from './VistaSimpleDeLaFicha'

const ASESORADA = 'u-valentina'

function vistaSimpleGuardada() {
  return db.perfiles.byUsuario(ASESORADA)?.vistaSimple
}

describe('la vista simple de la ficha, en la pantalla del coach', () => {
  beforeEach(() => localStorage.clear())

  it('ofrece las dos opciones', () => {
    render(<VistaSimpleDeLaFicha usuarioId={ASESORADA} vistaSimple={undefined} />)
    const grupo = screen.getByRole('group', { name: 'Vista de la app' })
    const botones = Array.from(grupo.querySelectorAll('button')).map((b) => b.textContent)
    expect(botones).toEqual(['Normal (el salón)', 'Vista simple'])
  })

  it('sin dato, "Normal" es la pulsada: es la experiencia de siempre', () => {
    render(<VistaSimpleDeLaFicha usuarioId={ASESORADA} vistaSimple={undefined} />)
    expect(screen.getByRole('button', { name: 'Normal (el salón)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Vista simple' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('marca "Vista simple" cuando la ficha ya la tiene', () => {
    render(<VistaSimpleDeLaFicha usuarioId={ASESORADA} vistaSimple={true} />)
    expect(screen.getByRole('button', { name: 'Vista simple' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Normal (el salón)' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('guarda al tocar, por el mismo camino que el resto de la ficha', async () => {
    const usuario = userEvent.setup()
    db.perfiles.guardarVistaSimple(ASESORADA, undefined)
    render(<VistaSimpleDeLaFicha usuarioId={ASESORADA} vistaSimple={undefined} />)

    await usuario.click(screen.getByRole('button', { name: 'Vista simple' }))
    expect(vistaSimpleGuardada()).toBe(true)

    await usuario.click(screen.getByRole('button', { name: 'Normal (el salón)' }))
    expect(vistaSimpleGuardada()).toBeUndefined()
  })

  it('no toca el resto de la ficha', async () => {
    const usuario = userEvent.setup()
    const antes = db.perfiles.byUsuario(ASESORADA)!
    render(<VistaSimpleDeLaFicha usuarioId={ASESORADA} vistaSimple={antes.vistaSimple} />)

    await usuario.click(screen.getByRole('button', { name: 'Vista simple' }))
    const despues = db.perfiles.byUsuario(ASESORADA)!
    expect({ ...despues, vistaSimple: undefined }).toEqual({ ...antes, vistaSimple: undefined })
  })
})
