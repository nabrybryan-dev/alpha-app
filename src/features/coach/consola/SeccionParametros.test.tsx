import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { aprobarParametrosPlan, leerParametrosAprobados, reiniciarDemoParametros } from '../../../data/consola/parametrosAprobados'
import { diferenciaParametros } from '../../../domain/consolaCoach/planRenovado'
import { SeccionParametros } from './SeccionParametros'

// Los tests corren siempre en modo demo: sin red, la aprobacion vive en memoria.

function contenido(valores: Record<string, unknown>) {
  return { parametros_para_decidir: { ...valores, aprobacion: { estado: 'pendiente' } } }
}

function pintar(opciones: { id?: string; valores?: Record<string, unknown>; pendiente?: boolean; permiso?: boolean } = {}) {
  const c = contenido(opciones.valores ?? { frecuencia_semanal: 4, pasos_dia: 8000 })
  return render(
    <SeccionParametros
      p={diferenciaParametros(null, c)}
      contenido={c}
      contexto={{ planRenovadoId: opciones.id ?? 'ape-1', pendiente: opciones.pendiente ?? true, permiso: opciones.permiso ?? true }}
    />,
  )
}

const estadoVisible = () => screen.getByTestId('estado-aprobacion-parametros')
const boton = () => screen.getByRole('button', { name: 'Aprobar parámetros' })

beforeEach(() => reiniciarDemoParametros())

describe('Aprobar parametros', () => {
  it('sin aprobacion: dice «Sin aprobar», el boton esta habilitado y mide al menos 44 px', async () => {
    pintar()
    await waitFor(() => expect(estadoVisible()).toHaveTextContent('Sin aprobar'))
    expect(boton()).toBeEnabled()
    expect(boton().className).toContain('min-h-[44px]')
    expect(estadoVisible()).toHaveAttribute('aria-live', 'polite')
  })

  it('un toque no firma: pide confirmacion y cancelar no guarda nada', async () => {
    const u = userEvent.setup()
    pintar()
    await waitFor(() => expect(boton()).toBeEnabled())
    await u.click(boton())
    expect(screen.getByText(/NO aprueba el plan/)).toBeInTheDocument()
    expect(await leerParametrosAprobados('ape-1')).toEqual({ ok: true, aprobacion: null })
    await u.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(await leerParametrosAprobados('ape-1')).toEqual({ ok: true, aprobacion: null })
    expect(estadoVisible()).toHaveTextContent('Sin aprobar')
  })

  it('confirmar guarda: pasa a «Aprobados» y el boton se deshabilita con su motivo', async () => {
    const u = userEvent.setup()
    pintar()
    await waitFor(() => expect(boton()).toBeEnabled())
    await u.click(boton())
    await u.click(screen.getByRole('button', { name: 'Confirmar parámetros' }))
    await waitFor(() => expect(estadoVisible()).toHaveTextContent('Aprobados'))
    expect(boton()).toBeDisabled()
    expect(screen.getByText(/ya están aprobados/)).toBeInTheDocument()
    const guardada = await leerParametrosAprobados('ape-1')
    expect(guardada.ok && guardada.aprobacion?.parametros).toEqual({ frecuencia_semanal: 4, pasos_dia: 8000 })
  })

  it('si cambia un valor, la aprobacion esta vencida y se puede aprobar de nuevo', async () => {
    await aprobarParametrosPlan('ape-1', { frecuencia_semanal: 4, pasos_dia: 8000 })
    pintar({ valores: { frecuencia_semanal: 4, pasos_dia: 9000 } })
    await waitFor(() => expect(estadoVisible()).toHaveTextContent('Vencida: cambió un valor, vuelve a aprobar'))
    expect(boton()).toBeEnabled()
  })

  it('con los mismos valores en otro orden sigue vigente', async () => {
    await aprobarParametrosPlan('ape-1', { pasos_dia: 8000, frecuencia_semanal: 4 })
    pintar()
    await waitFor(() => expect(estadoVisible()).toHaveTextContent('Aprobados'))
  })

  it('no se arrastra a un plan nuevo aunque los valores sean identicos', async () => {
    await aprobarParametrosPlan('ape-viejo', { frecuencia_semanal: 4, pasos_dia: 8000 })
    pintar({ id: 'ape-nuevo' })
    await waitFor(() => expect(estadoVisible()).toHaveTextContent('Sin aprobar'))
    expect(boton()).toBeEnabled()
  })

  it('sin permiso: deshabilitado y con el motivo a la vista', async () => {
    pintar({ permiso: false })
    await waitFor(() => expect(estadoVisible()).toHaveTextContent('Sin aprobar'))
    expect(boton()).toBeDisabled()
    expect(screen.getByText(/capacidad «aprobar plan estratégico»/)).toBeInTheDocument()
  })

  it('plan ya decidido: deshabilitado y con el motivo a la vista', async () => {
    pintar({ pendiente: false })
    await waitFor(() => expect(estadoVisible()).toHaveTextContent('Sin aprobar'))
    expect(boton()).toBeDisabled()
    expect(screen.getByText(/El plan ya está decidido/)).toBeInTheDocument()
  })
})
