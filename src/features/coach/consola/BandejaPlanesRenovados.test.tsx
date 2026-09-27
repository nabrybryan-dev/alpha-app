import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlanRenovado } from '../../../data/consola/planesRenovados'

const capacidades = { cargando: false, lista: new Set<string>() }

vi.mock('./useCapacidades', () => ({
  useCapacidades: () => ({
    cargando: capacidades.cargando,
    usuarioId: 'u-actor',
    tiene: (c: string) => capacidades.lista.has(c),
  }),
}))

const datos = {
  planesRenovadosPendientes: vi.fn(),
  decidirPlanEstrategico: vi.fn(),
  borradorYVigente: vi.fn(),
}

vi.mock('../../../data/consola/planesRenovados', () => ({
  planesRenovadosPendientes: (...a: unknown[]) => datos.planesRenovadosPendientes(...a),
  decidirPlanEstrategico: (...a: unknown[]) => datos.decidirPlanEstrategico(...a),
  borradorYVigente: (...a: unknown[]) => datos.borradorYVigente(...a),
}))

const { BandejaPlanesRenovados } = await import('./BandejaPlanesRenovados')

function plan(parcial: Partial<PlanRenovado> = {}): PlanRenovado {
  return {
    id: 'ape-1',
    usuarioId: 'u-renueva',
    planId: 'p-2',
    hash: 'h2',
    estado: 'propuesto',
    riesgo: 'bajo',
    clinico: false,
    motivoRiesgo: 'Adherencia alta, sin cambios de salud.',
    dudasPendientes: [],
    justificacion: [{ decision: 'Subir a 4 días', evidencia: 'adherencia 95 % en M4' }],
    supuestos: [],
    preguntasParaBryan: [],
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
  capacidades.lista = new Set(['leer_entrenamiento', 'aprobar_plan_estrategico'])
  datos.planesRenovadosPendientes.mockReset().mockResolvedValue([plan()])
  datos.decidirPlanEstrategico.mockReset()
  datos.borradorYVigente.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('BandejaPlanesRenovados', () => {
  it('sin la capacidad no se pinta ni consulta nada (aprobar_primer_plan no basta)', () => {
    capacidades.lista = new Set(['leer_entrenamiento', 'aprobar_primer_plan'])
    const { container } = render(<BandejaPlanesRenovados />)
    expect(container).toBeEmptyDOMElement()
    expect(datos.planesRenovadosPendientes).not.toHaveBeenCalled()
  })

  it('muestra quién, el riesgo, la cuenta atrás y lo que pasa al vencer', async () => {
    render(<BandejaPlanesRenovados />)
    expect(await screen.findByText('Asesorado')).toBeInTheDocument()
    expect(screen.getByText('Riesgo bajo')).toBeInTheDocument()
    expect(screen.getByText(/quedan 1 d/)).toBeInTheDocument()
    expect(screen.getByText(/pasa solo al vencer/)).toBeInTheDocument()
  })

  it('aprobar pide confirmación en sitio, nunca confirm()', async () => {
    const confirmNavegador = vi.spyOn(window, 'confirm')
    datos.decidirPlanEstrategico.mockResolvedValue({ ok: true, plan: plan({ estado: 'aprobado' }) })
    const usuario = userEvent.setup()
    render(<BandejaPlanesRenovados />)
    await usuario.click(await screen.findByRole('button', { name: 'Aprobar' }))
    expect(datos.decidirPlanEstrategico).not.toHaveBeenCalled()
    expect(screen.getByText(/Reemplaza al vigente/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Confirmar aprobación' }))
    expect(datos.decidirPlanEstrategico).toHaveBeenCalledWith('ape-1', 'aprobar', '')
    expect(await screen.findByRole('status')).toHaveTextContent(/ya es el plan vigente/)
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument()
    expect(confirmNavegador).not.toHaveBeenCalled()
  })

  it('rechazar exige motivo antes de llamar a la base', async () => {
    datos.decidirPlanEstrategico.mockResolvedValue({ ok: true, plan: plan({ estado: 'rechazado', motivo: 'x' }) })
    const usuario = userEvent.setup()
    render(<BandejaPlanesRenovados />)
    await usuario.click(await screen.findByRole('button', { name: 'Rechazar' }))
    await usuario.click(screen.getByRole('button', { name: 'Confirmar rechazo' }))
    expect(screen.getByText('Escribe el motivo del rechazo.')).toBeInTheDocument()
    expect(datos.decidirPlanEstrategico).not.toHaveBeenCalled()
    await usuario.type(screen.getByLabelText(/Motivo del rechazo/), 'Sube volumen sin datos')
    await usuario.click(screen.getByRole('button', { name: 'Confirmar rechazo' }))
    expect(datos.decidirPlanEstrategico).toHaveBeenCalledWith('ape-1', 'rechazar', 'Sube volumen sin datos')
  })

  it('lo clínico no se ofrece para aprobar sin autorizar_excepcion; con ella, sí', async () => {
    datos.planesRenovadosPendientes.mockResolvedValue([plan({ clinico: true })])
    const { unmount } = render(<BandejaPlanesRenovados />)
    expect(await screen.findByRole('button', { name: 'Aprobar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeEnabled()
    expect(screen.getByText('Clínico')).toBeInTheDocument()
    expect(screen.getByText(/lo aprueba Bryan/)).toBeInTheDocument()
    unmount()
    capacidades.lista.add('autorizar_excepcion')
    render(<BandejaPlanesRenovados />)
    expect(await screen.findByRole('button', { name: 'Aprobar' })).toBeEnabled()
  })

  it('enseña las preguntas para Bryan con la opción recomendada', async () => {
    datos.planesRenovadosPendientes.mockResolvedValue([
      plan({ preguntasParaBryan: [{ pregunta: '¿Mantener 3 días?', opciones: ['Sí', 'No'] }] }),
    ])
    render(<BandejaPlanesRenovados />)
    expect(await screen.findByText('¿Mantener 3 días?')).toBeInTheDocument()
    expect(screen.getByText('Sí (recomendada) · No')).toBeInTheDocument()
    expect(screen.getByText(/no pasa solo/)).toBeInTheDocument()
  })

  it('«Ver el borrador» lee borrador y vigente al abrirlo y enseña la diferencia y la justificación', async () => {
    datos.borradorYVigente.mockResolvedValue({
      ok: true,
      datos: {
        vigente: {
          version: 1,
          contenido: {
            objetivo_largo_plazo: 'Perder 5 kg',
            cabecera: ['Microciclo', 'Foco'],
            filas: { '1': { columnas: { Microciclo: 'M1', Foco: 'Base' } } },
            reglas: [{ texto: 'Regla que se deroga' }],
          },
        },
        borrador: {
          version: 2,
          contenido: {
            objetivo_largo_plazo: 'Perder 5 kg',
            cabecera: ['Microciclo', 'Foco'],
            filas: {
              '1': { columnas: { Microciclo: 'M1', Foco: 'Base' } },
              '2': { columnas: { Microciclo: 'M2', Foco: 'Fuerza' } },
            },
            reglas: [{ texto: 'Regla nueva' }],
            reglas_derogadas: [{ texto: 'Regla que se deroga', sustitucion: 'La reemplaza la nueva' }],
          },
        },
      },
    })
    const usuario = userEvent.setup()
    render(<BandejaPlanesRenovados />)
    await usuario.click(await screen.findByRole('button', { name: 'Ver el borrador y qué cambia' }))
    expect(datos.borradorYVigente).toHaveBeenCalledWith('u-renueva', 'p-2')
    expect(await screen.findByText(/Borrador · versión 2/)).toBeInTheDocument()
    expect(screen.getByText('Fuerza')).toBeInTheDocument()
    expect(screen.getByText('Añadida', { selector: 'td' })).toBeInTheDocument()
    expect(screen.getByText('Regla nueva')).toBeInTheDocument()
    expect(screen.getByText('Regla que se deroga')).toBeInTheDocument()
    expect(screen.getByText(/Sustituye: La reemplaza la nueva/)).toBeInTheDocument()
    expect(screen.getByText('Subir a 4 días')).toBeInTheDocument()
  })

  it('sin pendientes dice de dónde llegan', async () => {
    datos.planesRenovadosPendientes.mockResolvedValue([])
    render(<BandejaPlanesRenovados />)
    await waitFor(() => expect(screen.getByText(/No hay planes renovados esperando/)).toBeInTheDocument())
  })
})
