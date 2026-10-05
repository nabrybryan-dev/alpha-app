import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const estadoCapacidades = {
  cargando: false,
  puede: false,
}

vi.mock('./useCapacidades', () => ({
  useCapacidades: () => ({
    cargando: estadoCapacidades.cargando,
    usuarioId: 'u-actor',
    tiene: (capacidad: string) => (capacidad === 'responder_por_asesorado' ? estadoCapacidades.puede : false),
  }),
}))

const responderMock = vi.fn()

vi.mock('../../../data/consola/responderComoStaff', () => ({
  responderComoStaff: (...args: unknown[]) => responderMock(...args),
}))

const { ResponderComoStaff } = await import('./ResponderComoStaff')

beforeEach(() => {
  estadoCapacidades.cargando = false
  estadoCapacidades.puede = false
  responderMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ResponderComoStaff', () => {
  it('sin la capacidad, el botón está deshabilitado y un clic no llama a la RPC', () => {
    render(<ResponderComoStaff cuestionarioId="q-1" nombrePersona="Laura" />)
    const boton = screen.getByRole('button', { name: 'Responder como coach' })
    expect(boton).toBeDisabled()
    fireEvent.click(boton)
    expect(responderMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Guardar respuesta' })).not.toBeInTheDocument()
  })

  it('con la capacidad, pide confirmación antes de enviar (no llama a la RPC solo al escribir)', () => {
    estadoCapacidades.puede = true
    render(<ResponderComoStaff cuestionarioId="q-1" nombrePersona="Laura" />)

    fireEvent.click(screen.getByRole('button', { name: 'Responder como coach' }))
    fireEvent.change(screen.getByLabelText(/Lo que dijo Laura/), { target: { value: 'sí pudo entrenar' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar respuesta' }))

    // Todavía no se envió: hace falta el paso de confirmación, dentro de la página.
    expect(responderMock).not.toHaveBeenCalled()
    expect(screen.getByText(/¿Confirmas enviar esta respuesta a nombre de/)).toBeInTheDocument()
  })

  it('al confirmar, llama a la RPC con el cuestionario_id y la respuesta correctos', async () => {
    estadoCapacidades.puede = true
    responderMock.mockResolvedValue({ ok: true })
    render(<ResponderComoStaff cuestionarioId="q-42" nombrePersona="Laura" />)

    fireEvent.click(screen.getByRole('button', { name: 'Responder como coach' }))
    fireEvent.change(screen.getByLabelText(/Lo que dijo Laura/), { target: { value: 'sí pudo entrenar' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar respuesta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y enviar' }))

    await waitFor(() => expect(responderMock).toHaveBeenCalledTimes(1))
    expect(responderMock).toHaveBeenCalledWith('q-42', { texto: 'sí pudo entrenar' })
    await waitFor(() => expect(screen.getByText('Respondida por el equipo.')).toBeInTheDocument())
  })

  it('un error de la base se muestra con un mensaje claro, sin marcar como respondida', async () => {
    estadoCapacidades.puede = true
    responderMock.mockResolvedValue({ ok: false, error: 'No tienes permiso para responder por el asesorado.' })
    render(<ResponderComoStaff cuestionarioId="q-1" nombrePersona="Laura" />)

    fireEvent.click(screen.getByRole('button', { name: 'Responder como coach' }))
    fireEvent.change(screen.getByLabelText(/Lo que dijo Laura/), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar respuesta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y enviar' }))

    await waitFor(() =>
      expect(screen.getByText('No tienes permiso para responder por el asesorado.')).toBeInTheDocument(),
    )
    expect(screen.queryByText('Respondida por el equipo.')).not.toBeInTheDocument()
  })
})
