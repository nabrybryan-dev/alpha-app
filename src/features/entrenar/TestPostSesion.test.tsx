import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TestPostSesion } from './TestPostSesion'
import { reflexionSesion } from './reflexionSesion'

/**
 * El RPE de la sesión va de 1 a 10. Hasta el 2026-10-02 el selector ofrecía 6 a 10 y una
 * asesorada con techo clínico de RPE 5 (lupus) no podía anotar ninguna sesión: todas las
 * opciones quedaban por encima de su límite.
 */
describe('TestPostSesion · RPE de 1 a 10', () => {
  afterEach(cleanup)

  it('ofrece los diez valores, del 1 al 10', () => {
    render(<TestPostSesion onGuardar={vi.fn()} sesionId="s1" />)
    const grupo = screen.getByRole('group', { name: /Qué tan dura estuvo la sesión/ })
    const textos = Array.from(grupo.querySelectorAll('button')).map((b) => b.textContent)
    expect(textos).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
  })

  it('guarda un RPE 3 tal cual, sin subirlo a 6', () => {
    const onGuardar = vi.fn()
    render(<TestPostSesion onGuardar={onGuardar} sesionId="s1" />)
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: 'NORMAL' }))
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar sesión' }))
    expect(onGuardar).toHaveBeenCalledTimes(1)
    expect(onGuardar.mock.calls[0][0]).toMatchObject({ rpeSesion: 3, prsEntrada: 6 })
  })

  it('sin elegir el RPE no deja finalizar', () => {
    render(<TestPostSesion onGuardar={vi.fn()} sesionId="s1" />)
    fireEvent.click(screen.getByRole('button', { name: 'NORMAL' }))
    expect((screen.getByRole('button', { name: 'Finalizar sesión' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('las diez opciones van en una cuadrícula de cinco columnas (dos filas tocables)', () => {
    render(<TestPostSesion onGuardar={vi.fn()} sesionId="s1" />)
    const boton = screen.getByRole('button', { name: '1' })
    expect(boton.parentElement?.className).toContain('grid-cols-5')
  })
})

describe('reflexionSesion · esfuerzos bajos', () => {
  it('un RPE 1 a 5 recibe una reflexión (no cae en la de «fuerte»)', () => {
    expect(reflexionSesion(2, 7)).toMatch(/suave/i)
    expect(reflexionSesion(5, 7)).not.toMatch(/TODO|fuerte/)
  })
})
