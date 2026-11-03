import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { aprobarParametrosPlan, leerParametrosAprobados, reiniciarDemoParametros } from '../../../data/consola/parametrosAprobados'
import { diferenciaParametros } from '../../../domain/consolaCoach/planRenovado'
import { SeccionParametros } from './SeccionParametros'

// Los tests corren siempre en modo demo: sin red, la aprobacion vive en memoria.

const DIEZ: Record<string, unknown> = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`p${i + 1}`, i + 1]))

function contenido(valores: Record<string, unknown>) {
  return { parametros_para_decidir: { ...valores, aprobacion: { estado: 'pendiente' } } }
}

function pintar(opciones: { id?: string; valores?: Record<string, unknown>; pendiente?: boolean; permiso?: boolean } = {}) {
  const c = contenido(opciones.valores ?? DIEZ)
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
    expect(guardada.ok && guardada.aprobacion?.parametros).toEqual(DIEZ)
  })

  it('si cambia un valor, la aprobacion esta vencida y se puede aprobar de nuevo', async () => {
    await aprobarParametrosPlan('ape-1', DIEZ)
    pintar({ valores: { ...DIEZ, p2: 99 } })
    await waitFor(() => expect(estadoVisible()).toHaveTextContent('Vencida: cambió un valor, vuelve a aprobar'))
    expect(boton()).toBeEnabled()
  })

  it('con los mismos valores en otro orden sigue vigente', async () => {
    await aprobarParametrosPlan('ape-1', Object.fromEntries(Object.entries(DIEZ).reverse()))
    pintar()
    await waitFor(() => expect(estadoVisible()).toHaveTextContent('Aprobados'))
  })

  it('no se arrastra a un plan nuevo aunque los valores sean identicos', async () => {
    await aprobarParametrosPlan('ape-viejo', DIEZ)
    pintar({ id: 'ape-nuevo' })
    await waitFor(() => expect(estadoVisible()).toHaveTextContent('Sin aprobar'))
    expect(boton()).toBeEnabled()
  })

  it('sin permiso: deshabilitado y con el motivo a la vista', async () => {
    pintar({ permiso: false })
    await waitFor(() => expect(estadoVisible()).toHaveTextContent('Sin aprobar'))
    expect(boton()).toBeDisabled()
    expect(screen.getByText(/Solo la coach puede aprobar parámetros/)).toBeInTheDocument()
  })

  it('plan ya decidido: deshabilitado y con el motivo a la vista', async () => {
    pintar({ pendiente: false })
    await waitFor(() => expect(estadoVisible()).toHaveTextContent('Sin aprobar'))
    expect(boton()).toBeDisabled()
    expect(screen.getByText(/El plan ya está decidido/)).toBeInTheDocument()
  })

  it('con fila muestra «Aprobados el <fecha>»', async () => {
    await aprobarParametrosPlan('ape-1', DIEZ)
    pintar()
    await waitFor(() => expect(estadoVisible()).toHaveTextContent(/^Aprobados el .+ de \d{4}$/))
  })

  it('un plan con 9 o con 11 parametros, o sin ninguno, no se puede aprobar y dice por que', async () => {
    const nueve: Record<string, unknown> = { ...DIEZ }
    delete nueve.p10
    for (const valores of [nueve, { ...DIEZ, p11: 11 }]) {
      const { unmount } = pintar({ valores })
      await waitFor(() => expect(estadoVisible()).toHaveTextContent('Sin aprobar'))
      expect(boton()).toBeDisabled()
      expect(screen.getByText(/El plan no trae los diez parámetros/)).toBeInTheDocument()
      unmount()
    }
  })
})
