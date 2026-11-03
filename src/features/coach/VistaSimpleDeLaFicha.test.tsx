import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/dbInstance'
import { VistaSimpleDeLaFicha } from './VistaSimpleDeLaFicha'

const ASESORADA = 'u-valentina'

function vistaSimpleGuardada() {
  return db.perfiles.byUsuario(ASESORADA)?.vistaSimple
}

/**
 * «Vista de la app» (maqueta 7, paso 10): un interruptor, no dos botones. Mismo dato
 * (`perfil.vistaSimple`), mismo camino de guardado (`db.perfiles.guardarVistaSimple`) y solo
 * el staff puede tocarlo (trigger `proteger_perfil`): lo que cambia es cómo se lee.
 */
describe('la vista simple de la ficha, en la pantalla del coach', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('ofrece un solo interruptor «Modo simple»', () => {
    render(<VistaSimpleDeLaFicha usuarioId={ASESORADA} vistaSimple={undefined} />)
    expect(screen.getByRole('switch', { name: 'Modo simple' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('sin dato, el interruptor está apagado: es la experiencia de siempre', () => {
    render(<VistaSimpleDeLaFicha usuarioId={ASESORADA} vistaSimple={undefined} />)
    expect(screen.getByRole('switch', { name: 'Modo simple' })).not.toBeChecked()
  })

  it('con la vista simple puesta, el interruptor está encendido', () => {
    render(<VistaSimpleDeLaFicha usuarioId={ASESORADA} vistaSimple={true} />)
    expect(screen.getByRole('switch', { name: 'Modo simple' })).toBeChecked()
  })

  // Revisión ciega del 25-oct (defecto 4): el estado local se copiaba una vez y no seguía a la
  // prop; al cambiar de persona se quedaba el interruptor de la anterior.
  it('sigue a la prop al cambiar de persona y al corregirse el dato', () => {
    const { rerender } = render(<VistaSimpleDeLaFicha usuarioId={ASESORADA} vistaSimple={true} />)
    expect(screen.getByRole('switch', { name: 'Modo simple' })).toBeChecked()
    rerender(<VistaSimpleDeLaFicha usuarioId="u-sara" vistaSimple={undefined} />)
    expect(screen.getByRole('switch', { name: 'Modo simple' })).not.toBeChecked()
    rerender(<VistaSimpleDeLaFicha usuarioId="u-sara" vistaSimple={true} />)
    expect(screen.getByRole('switch', { name: 'Modo simple' })).toBeChecked()
  })

  it('si el guardado falla, vuelve al valor real y lo dice (no enseña un estado falso)', async () => {
    const usuario = userEvent.setup()
    db.perfiles.guardarVistaSimple(ASESORADA, true)
    const espia = vi
      .spyOn(db.perfiles, 'guardarVistaSimple')
      .mockImplementation(() => {
        throw new Error('sin red')
      })
    try {
      render(<VistaSimpleDeLaFicha usuarioId={ASESORADA} vistaSimple={true} />)
      await usuario.click(screen.getByRole('switch', { name: 'Modo simple' }))
      expect(screen.getByRole('switch', { name: 'Modo simple' })).toBeChecked()
      expect(screen.getByRole('alert')).toHaveTextContent(/No se pudo guardar/)
      expect(vistaSimpleGuardada()).toBe(true)
    } finally {
      espia.mockRestore()
    }
  })

  it('guarda al tocar, por el mismo camino que el resto de la ficha', async () => {
    const usuario = userEvent.setup()
    db.perfiles.guardarVistaSimple(ASESORADA, undefined)
    render(<VistaSimpleDeLaFicha usuarioId={ASESORADA} vistaSimple={undefined} />)

    await usuario.click(screen.getByRole('switch', { name: 'Modo simple' }))
    expect(vistaSimpleGuardada()).toBe(true)

    await usuario.click(screen.getByRole('switch', { name: 'Modo simple' }))
    expect(vistaSimpleGuardada()).toBeUndefined()
  })

  it('no toca el resto de la ficha', async () => {
    const usuario = userEvent.setup()
    const antes = db.perfiles.byUsuario(ASESORADA)!
    render(<VistaSimpleDeLaFicha usuarioId={ASESORADA} vistaSimple={antes.vistaSimple} />)

    await usuario.click(screen.getByRole('switch', { name: 'Modo simple' }))
    const despues = db.perfiles.byUsuario(ASESORADA)!
    expect({ ...despues, vistaSimple: undefined }).toEqual({ ...antes, vistaSimple: undefined })
  })
})
