import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, hoyIso } from '../../../data/dbInstance'
import { reiniciarDb } from '../../../data/mockDb'
import { ChequeoDeHoyConPiel } from './ChequeoDeHoyConPiel'

/**
 * El check-in de Hoy como en «Alpha · Rediseño» (maqueta 7, `card slim`, `salida.html:1291`): una fila con título, línea
 * y botón «Hacerlo» que abre el formulario en una hoja. Solo para la cuenta con el diseño final; las demás conservan el
 * formulario en línea de siempre (`ChequeoDeHoy`).
 */
const U = 'u-valentina'
const pintar = (disenoFinal: boolean, clasico = false) =>
  render(
    <MemoryRouter>
      <ChequeoDeHoyConPiel usuarioId={U} hoy={hoyIso()} disenoFinal={disenoFinal} clasico={clasico} />
    </MemoryRouter>,
  )

beforeEach(() => {
  localStorage.clear()
  reiniciarDb()
})

describe('check-in de Hoy con la piel de la maqueta', () => {
  it('pendiente: una fila con «Hacerlo» y sin el formulario a la vista', () => {
    pintar(true)
    expect(screen.getByText('Check-in de hoy')).toBeInTheDocument()
    expect(screen.getByText(/Pendiente · 1 minuto/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hacerlo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Guardar check-in/ })).not.toBeInTheDocument()
  })

  it('«Hacerlo» abre el MISMO formulario en una hoja', async () => {
    pintar(true)
    await userEvent.click(screen.getByRole('button', { name: 'Hacerlo' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Guardar check-in/ })).toBeInTheDocument()
  })

  it('hecho: la fila dice «Registrado» con sus tres datos y ofrece verlo, no volver a llenarlo', () => {
    db.bienestar.guardar({ id: 'ck-fila', usuarioId: U, fecha: hoyIso(), horasSueno: 7, estres: 'POCO', dolor: 5 })
    pintar(true)
    expect(screen.getByText(/Registrado/)).toBeInTheDocument()
    expect(screen.getByText(/7 h/)).toBeInTheDocument()
    expect(screen.getByText(/5\/10/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hacerlo' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver' })).toBeInTheDocument()
  })

  it('a medias no se dice «Registrado»: sigue pendiente', () => {
    db.bienestar.guardar({ id: 'ck-medias', usuarioId: U, fecha: hoyIso(), calidadSueno: 'MALA', parcial: true })
    pintar(true)
    expect(screen.queryByText(/Registrado/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hacerlo' })).toBeInTheDocument()
  })

  it('sin el diseño final, o en el Hoy del staff, queda el formulario en línea de siempre', () => {
    const sin = pintar(false)
    expect(screen.getByRole('region', { name: 'Chequeo de hoy' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Guardar check-in/ })).toBeInTheDocument()
    sin.unmount()
    pintar(true, true)
    expect(screen.getByRole('region', { name: 'Chequeo de hoy' })).toBeInTheDocument()
  })
})
