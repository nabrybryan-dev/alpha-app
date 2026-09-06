import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/dbInstance'
import { SexoDeLaFicha } from './SexoDeLaFicha'

const ASESORADA = 'u-valentina'

function sexoGuardado() {
  return db.perfiles.byUsuario(ASESORADA)?.sexo
}

describe('el sexo de la ficha, en la pantalla del coach', () => {
  beforeEach(() => localStorage.clear())

  it('ofrece las tres opciones con palabras, nunca con simbolos', () => {
    render(<SexoDeLaFicha usuarioId={ASESORADA} sexo={undefined} />)
    const grupo = screen.getByRole('group', { name: 'Sexo de la ficha' })
    const botones = Array.from(grupo.querySelectorAll('button')).map((b) => b.textContent)
    expect(botones).toEqual(['Hombre', 'Mujer', 'Sin indicar'])
    // Un simbolo lo dibuja el sistema operativo, distinto en cada telefono: el
    // guardian de emojis lo prohibe, y este test lo dice en el sitio donde se decide.
    expect(grupo.textContent).not.toMatch(/[♀♂]/)
  })

  it('marca la opcion que la ficha ya tiene', () => {
    render(<SexoDeLaFicha usuarioId={ASESORADA} sexo="mujer" />)
    expect(screen.getByRole('button', { name: 'Mujer' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Hombre' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Sin indicar' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('sin dato, «Sin indicar» es la pulsada: es una opcion, no la ausencia de las otras', () => {
    render(<SexoDeLaFicha usuarioId={ASESORADA} sexo={undefined} />)
    expect(screen.getByRole('button', { name: 'Sin indicar' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('guarda al tocar, por el mismo camino que el resto de la ficha', async () => {
    const usuario = userEvent.setup()
    db.perfiles.guardarSexo(ASESORADA, undefined)
    render(<SexoDeLaFicha usuarioId={ASESORADA} sexo={undefined} />)

    await usuario.click(screen.getByRole('button', { name: 'Hombre' }))
    expect(sexoGuardado()).toBe('hombre')

    await usuario.click(screen.getByRole('button', { name: 'Mujer' }))
    expect(sexoGuardado()).toBe('mujer')
  })

  it('«Sin indicar» lo quita de la ficha: el sujeto vuelve al de siempre', async () => {
    const usuario = userEvent.setup()
    db.perfiles.guardarSexo(ASESORADA, 'mujer')
    render(<SexoDeLaFicha usuarioId={ASESORADA} sexo="mujer" />)

    await usuario.click(screen.getByRole('button', { name: 'Sin indicar' }))
    expect(sexoGuardado()).toBeUndefined()
    // Quitado de verdad, no puesto a undefined: la ficha guardada es identica a
    // una que nunca lo tuvo.
    expect('sexo' in (db.perfiles.byUsuario(ASESORADA) ?? {})).toBe(false)
  })

  it('no toca el resto de la ficha', async () => {
    const usuario = userEvent.setup()
    const antes = db.perfiles.byUsuario(ASESORADA)!
    render(<SexoDeLaFicha usuarioId={ASESORADA} sexo={antes.sexo} />)

    await usuario.click(screen.getByRole('button', { name: 'Hombre' }))
    const despues = db.perfiles.byUsuario(ASESORADA)!
    expect({ ...despues, sexo: undefined }).toEqual({ ...antes, sexo: undefined })
  })
})
