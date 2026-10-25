import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { filtrarPorSombrero, type ConSombrero } from '../../domain/equipo/sombreros'
import { reiniciarFiltroParaPruebas } from './filtroSombreros'
import { Sombreros } from './Sombreros'

/**
 * La fila de chips «Todo · Entreno · Nutrición · Administración» del equipo. Tiene que
 * enseñar las cifras de lo pendiente, decir cuál está puesta sin depender del color y
 * dejar el filtro puesto al cambiar de pantalla.
 */

const CUENTA = { todo: 4, entreno: 1, nutricion: 2, administracion: 1 }

describe('la fila de los tres sombreros', () => {
  beforeEach(() => reiniciarFiltroParaPruebas())

  it('enseña los cuatro chips con su cifra, en el orden de la maqueta', () => {
    render(<Sombreros cuenta={CUENTA} />)
    const grupo = screen.getByRole('group', { name: 'Ver por sombrero' })
    const chips = Array.from(grupo.querySelectorAll('button')).map((b) => b.textContent?.replace(/\s+/g, ' ').trim())
    expect(chips).toEqual(['Todo 4', 'Entreno 1', 'Nutrición 2', 'Administración 1'])
  })

  it('empieza en «Todo», con su aria-pressed en true y los otros en false', () => {
    render(<Sombreros cuenta={CUENTA} />)
    expect(screen.getByRole('button', { name: /^Todo/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^Entreno/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('al tocar Nutrición, el filtro queda puesto y el chip lo dice', async () => {
    const usuario = userEvent.setup()
    render(<Sombreros cuenta={CUENTA} />)
    await usuario.click(screen.getByRole('button', { name: /^Nutrición/ }))
    expect(screen.getByRole('button', { name: /^Nutrición/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^Todo/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('volver a tocar el chip puesto no deja el filtro en el aire: sigue en ese sombrero', async () => {
    const usuario = userEvent.setup()
    render(<Sombreros cuenta={CUENTA} />)
    const nutricion = screen.getByRole('button', { name: /^Nutrición/ })
    await usuario.click(nutricion)
    await usuario.click(nutricion)
    expect(nutricion).toHaveAttribute('aria-pressed', 'true')
  })

  it('el filtro sigue puesto al desmontar y volver a montar (viaja entre pantallas)', async () => {
    const usuario = userEvent.setup()
    const primera = render(<Sombreros cuenta={CUENTA} />)
    await usuario.click(screen.getByRole('button', { name: /^Entreno/ }))
    primera.unmount()

    render(<Sombreros cuenta={CUENTA} />)
    expect(screen.getByRole('button', { name: /^Entreno/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('con el filtro puesto, la lista que se pinta es la suya y la seguridad no entra aquí', () => {
    const filas: (ConSombrero & { id: string })[] = [
      { id: 'firma', sombrero: 'nutricion' },
      { id: 'revision', sombrero: 'entreno' },
    ]
    expect(filtrarPorSombrero(filas, 'entreno').map((f) => f.id)).toEqual(['revision'])
  })
})
