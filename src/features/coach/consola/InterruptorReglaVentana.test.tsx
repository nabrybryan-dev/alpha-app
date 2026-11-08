import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EstadoRegla } from '../../../data/consola/reglaVentana'

const datos = vi.hoisted(() => ({
  leerReglaVentana: vi.fn(),
  cambiarReglaVentana: vi.fn(),
}))

vi.mock('../../../data/consola/reglaVentana', () => ({
  leerReglaVentana: (...a: unknown[]) => datos.leerReglaVentana(...a),
  cambiarReglaVentana: (...a: unknown[]) => datos.cambiarReglaVentana(...a),
}))

const { InterruptorReglaVentana } = await import('./InterruptorReglaVentana')

const apagada: EstadoRegla = { encendida: false, ultimoCambio: null }
const encendida: EstadoRegla = {
  encendida: true,
  ultimoCambio: { encendida: true, por: 'u-1', porNombre: 'Staff de prueba', en: '2026-11-07T15:00:00Z', nota: 'una semana' },
}

beforeEach(() => {
  datos.leerReglaVentana.mockReset().mockResolvedValue({ ok: true, estado: apagada })
  datos.cambiarReglaVentana.mockReset().mockResolvedValue({ ok: true })
})

describe('InterruptorReglaVentana', () => {
  it('dice lo que la regla hace de verdad: bajo o medio, nunca alto', async () => {
    render(<InterruptorReglaVentana />)
    expect(await screen.findByText('Apagada')).toBeTruthy()
    expect(screen.getByText(/Riesgo bajo o medio\. El riesgo alto nunca pasa solo/)).toBeTruthy()
    expect(screen.getByText('Nunca se ha cambiado desde la consola.')).toBeTruthy()
  })

  it('encender pide confirmación explícita antes de llamar a la base', async () => {
    render(<InterruptorReglaVentana />)
    fireEvent.click(await screen.findByRole('button', { name: 'Encender…' }))
    expect(datos.cambiarReglaVentana).not.toHaveBeenCalled()
    expect(screen.getByText(/se publicarán a la persona sin que nadie los firme/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(datos.cambiarReglaVentana).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Encender…' }))
    fireEvent.change(screen.getByLabelText('Nota (opcional)'), { target: { value: 'probamos' } })
    datos.leerReglaVentana.mockResolvedValue({ ok: true, estado: encendida })
    fireEvent.click(screen.getByRole('button', { name: 'Sí, encender' }))
    await waitFor(() => expect(datos.cambiarReglaVentana).toHaveBeenCalledWith(true, 'probamos'))
    expect(await screen.findByText('Encendida')).toBeTruthy()
  })

  it('encendida enseña quién y cuándo, y apaga sin confirmación', async () => {
    datos.leerReglaVentana.mockResolvedValue({ ok: true, estado: encendida })
    render(<InterruptorReglaVentana />)
    expect(await screen.findByText(/La encendió Staff de prueba el/)).toBeTruthy()
    expect(screen.getByText('Nota: una semana')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Apagar' }))
    await waitFor(() => expect(datos.cambiarReglaVentana).toHaveBeenCalledWith(false, ''))
  })

  it('un fallo al leer no se disfraza de «apagada»', async () => {
    datos.leerReglaVentana.mockResolvedValue({ ok: false, error: 'red caída' })
    render(<InterruptorReglaVentana />)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText('Apagada')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Encender…' })).toBeNull()
  })

  it('si la base rechaza el cambio, lo dice y no cambia el estado', async () => {
    datos.cambiarReglaVentana.mockResolvedValue({ ok: false, error: 'No tienes permiso para cambiar esta regla.' })
    render(<InterruptorReglaVentana />)
    fireEvent.click(await screen.findByRole('button', { name: 'Encender…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, encender' }))
    expect(await screen.findByText('No tienes permiso para cambiar esta regla.')).toBeTruthy()
    expect(screen.getByText('Apagada')).toBeTruthy()
  })
})
