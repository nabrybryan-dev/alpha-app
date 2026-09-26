import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrimerPlan } from '../../../data/consola/primerosPlanes'

const capacidades = { cargando: false, lista: new Set<string>() }

vi.mock('./useCapacidades', () => ({
  useCapacidades: () => ({
    cargando: capacidades.cargando,
    usuarioId: 'u-actor',
    tiene: (c: string) => capacidades.lista.has(c),
  }),
}))

const datos = {
  primerosPlanesPendientes: vi.fn(),
  decidirPrimerPlan: vi.fn(),
  planPropuesto: vi.fn(),
}

vi.mock('../../../data/consola/primerosPlanes', () => ({
  primerosPlanesPendientes: (...a: unknown[]) => datos.primerosPlanesPendientes(...a),
  decidirPrimerPlan: (...a: unknown[]) => datos.decidirPrimerPlan(...a),
  planPropuesto: (...a: unknown[]) => datos.planPropuesto(...a),
}))

const { BandejaPrimerosPlanes } = await import('./BandejaPrimerosPlanes')

function plan(parcial: Partial<PrimerPlan> = {}): PrimerPlan {
  return {
    id: 'ap-1',
    usuarioId: 'u-nueva',
    microcicloId: 'm-1',
    estado: 'propuesto',
    riesgo: 'bajo',
    motivoRiesgo: 'Cribado verde, sin medicación.',
    dudasPendientes: [],
    plazoHasta: new Date(Date.now() + 30 * 3600_000).toISOString(),
    decididoPor: null,
    motivo: null,
    decididoEn: null,
    motivoEspera: null,
    ...parcial,
  }
}

beforeEach(() => {
  capacidades.cargando = false
  capacidades.lista = new Set(['leer_entrenamiento', 'aprobar_primer_plan'])
  datos.primerosPlanesPendientes.mockReset().mockResolvedValue([plan()])
  datos.decidirPrimerPlan.mockReset()
  datos.planPropuesto.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('BandejaPrimerosPlanes', () => {
  it('sin la capacidad no se pinta ni consulta nada', () => {
    capacidades.lista = new Set(['leer_entrenamiento'])
    const { container } = render(<BandejaPrimerosPlanes />)
    expect(container).toBeEmptyDOMElement()
    expect(datos.primerosPlanesPendientes).not.toHaveBeenCalled()
  })

  it('muestra quién, el riesgo y la cuenta atrás', async () => {
    render(<BandejaPrimerosPlanes />)
    expect(await screen.findByText('Persona nueva')).toBeInTheDocument()
    expect(screen.getByText('Riesgo bajo')).toBeInTheDocument()
    expect(screen.getByText(/quedan 1 d/)).toBeInTheDocument()
    expect(screen.getByText(/pasa solo al vencer/)).toBeInTheDocument()
  })

  it('aprobar pide confirmación en sitio, nunca confirm(), y deja la marca donde se pulsó', async () => {
    const confirmNavegador = vi.spyOn(window, 'confirm')
    datos.decidirPrimerPlan.mockResolvedValue({ ok: true, plan: plan({ estado: 'aprobado' }) })
    const usuario = userEvent.setup()
    render(<BandejaPrimerosPlanes />)
    await usuario.click(await screen.findByRole('button', { name: 'Aprobar' }))
    expect(datos.decidirPrimerPlan).not.toHaveBeenCalled()
    expect(screen.getByText(/¿Aprobar y publicar el primer plan/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Confirmar aprobación' }))
    expect(datos.decidirPrimerPlan).toHaveBeenCalledWith('ap-1', 'aprobar', '')
    expect(await screen.findByRole('status')).toHaveTextContent(/Aprobado y publicado/)
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument()
    expect(confirmNavegador).not.toHaveBeenCalled()
  })

  it('rechazar exige motivo antes de llamar a la base', async () => {
    datos.decidirPrimerPlan.mockResolvedValue({ ok: true, plan: plan({ estado: 'rechazado', motivo: 'x' }) })
    const usuario = userEvent.setup()
    render(<BandejaPrimerosPlanes />)
    await usuario.click(await screen.findByRole('button', { name: 'Rechazar' }))
    await usuario.click(screen.getByRole('button', { name: 'Confirmar rechazo' }))
    expect(screen.getByText('Escribe el motivo del rechazo.')).toBeInTheDocument()
    expect(datos.decidirPrimerPlan).not.toHaveBeenCalled()
    await usuario.type(screen.getByLabelText(/Motivo del rechazo/), 'Faltan los días que puede entrenar')
    await usuario.click(screen.getByRole('button', { name: 'Confirmar rechazo' }))
    expect(datos.decidirPrimerPlan).toHaveBeenCalledWith('ap-1', 'rechazar', 'Faltan los días que puede entrenar')
    expect(await screen.findByRole('status')).toHaveTextContent(/Rechazado/)
  })

  it('un riesgo alto no se ofrece para aprobar sin autorizar_excepcion, pero sí para rechazar', async () => {
    datos.primerosPlanesPendientes.mockResolvedValue([plan({ riesgo: 'alto' })])
    render(<BandejaPrimerosPlanes />)
    expect(await screen.findByRole('button', { name: 'Aprobar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeEnabled()
    expect(screen.getByText(/lo aprueba Bryan/)).toBeInTheDocument()
  })

  it('con autorizar_excepcion (Bryan) el riesgo alto sí se puede aprobar', async () => {
    capacidades.lista.add('autorizar_excepcion')
    datos.primerosPlanesPendientes.mockResolvedValue([plan({ riesgo: 'alto' })])
    render(<BandejaPrimerosPlanes />)
    expect(await screen.findByRole('button', { name: 'Aprobar' })).toBeEnabled()
  })

  it('el error del servidor se ve en la propia tarjeta', async () => {
    datos.decidirPrimerPlan.mockResolvedValue({ ok: false, error: 'Este plan lo aprueba Bryan' })
    const usuario = userEvent.setup()
    render(<BandejaPrimerosPlanes />)
    await usuario.click(await screen.findByRole('button', { name: 'Aprobar' }))
    await usuario.click(screen.getByRole('button', { name: 'Confirmar aprobación' }))
    expect(await screen.findByText('Este plan lo aprueba Bryan')).toBeInTheDocument()
  })

  it('«Ver el plan propuesto» lee el plan al abrirlo y lo resume', async () => {
    datos.planPropuesto.mockResolvedValue({
      ok: true,
      datos: { sesiones: [{ nombre: 'FULL BODY A', ejercicios: [{ nombre: 'Sentadilla goblet', sets: 3, rango: '10-12' }] }] },
    })
    const usuario = userEvent.setup()
    render(<BandejaPrimerosPlanes />)
    await usuario.click(await screen.findByRole('button', { name: 'Ver el plan propuesto' }))
    expect(datos.planPropuesto).toHaveBeenCalledWith('m-1')
    expect(await screen.findByText('Sentadilla goblet')).toBeInTheDocument()
    expect(screen.getByText('3 × 10-12')).toBeInTheDocument()
  })

  it('«Ver ficha» lleva a la persona', async () => {
    const onVerPersona = vi.fn()
    const usuario = userEvent.setup()
    render(<BandejaPrimerosPlanes onVerPersona={onVerPersona} />)
    await usuario.click(await screen.findByRole('button', { name: 'Ver ficha' }))
    expect(onVerPersona).toHaveBeenCalledWith('u-nueva')
  })

  it('sin pendientes dice de dónde llegan', async () => {
    datos.primerosPlanesPendientes.mockResolvedValue([])
    render(<BandejaPrimerosPlanes />)
    await waitFor(() => expect(screen.getByText(/No hay primeros planes esperando/)).toBeInTheDocument())
  })
})
