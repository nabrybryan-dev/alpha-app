import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../data/dbInstance'
import type { AvisoPraxis } from '../../../data/consola/avisosPraxis'

/**
 * El módulo «Avisos de Praxis» de la consola del coach (migración 0108). Lo que importa:
 *   - lo ve quien ocupa el puesto de coach, y NADIE más (un asesorado ni lo pinta ni lo consulta);
 *   - dice quién, a qué hora, qué tipo de señal y de dónde vino, y NUNCA una frase;
 *   - el aviso se queda hasta que el coach lo marca «Atendido»; los atendidos se ocultan;
 *   - sin la migración dice una sola línea y la consola no se rompe.
 */
const sesion = { rol: 'coach' as string, id: 'u-coach-prueba' }
const capacidades = { cargando: false, lista: new Set<string>() }

vi.mock('../../../app/SessionProvider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../app/SessionProvider')>()),
  useSesionOpcional: () => ({ usuario: { id: sesion.id, rol: sesion.rol, nombre: 'Prueba' }, esNube: true }),
}))

vi.mock('./useCapacidades', () => ({
  useCapacidades: () => ({
    cargando: capacidades.cargando,
    usuarioId: sesion.id,
    tiene: (c: string) => capacidades.lista.has(c),
  }),
}))

const datos = {
  avisosPendientes: vi.fn(),
  avisosAtendidos: vi.fn(),
  marcarAvisoAtendido: vi.fn(),
}

vi.mock('../../../data/consola/avisosPraxis', () => ({
  avisosPendientes: (...a: unknown[]) => datos.avisosPendientes(...a),
  avisosAtendidos: (...a: unknown[]) => datos.avisosAtendidos(...a),
  marcarAvisoAtendido: (...a: unknown[]) => datos.marcarAvisoAtendido(...a),
}))

const { AvisosPraxis } = await import('./AvisosPraxis')

const personas = db.usuarios.entrenan()
const [PERSONA_A, PERSONA_B] = [personas[0], personas[1]]

function aviso(parcial: Partial<AvisoPraxis> = {}): AvisoPraxis {
  return {
    id: 'av-1',
    usuarioId: PERSONA_A.id,
    creadoEn: new Date().toISOString(),
    origen: 'praxis',
    nivel: 'vida',
    atendidoEn: null,
    atendidoPor: null,
    ...parcial,
  }
}

beforeEach(() => {
  sesion.rol = 'coach'
  capacidades.cargando = false
  capacidades.lista = new Set()
  datos.avisosPendientes.mockReset().mockResolvedValue({ ok: true, datos: [aviso()] })
  datos.avisosAtendidos.mockReset().mockResolvedValue({ ok: true, datos: [] })
  datos.marcarAvisoAtendido.mockReset().mockResolvedValue({ ok: true, id: 'av-1' })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('quién lo ve', () => {
  it('un asesorado no lo ve y no se consulta nada', () => {
    sesion.rol = 'asesorado'
    const { container } = render(<AvisosPraxis />)
    expect(container).toBeEmptyDOMElement()
    expect(datos.avisosPendientes).not.toHaveBeenCalled()
  })

  it('la nutricionista tampoco', () => {
    sesion.rol = 'nutricionista'
    const { container } = render(<AvisosPraxis />)
    expect(container).toBeEmptyDOMElement()
    expect(datos.avisosPendientes).not.toHaveBeenCalled()
  })

  it('un asesorado con la capacidad puesto_de_coach (la cuenta personal de Bryan) sí lo ve', async () => {
    sesion.rol = 'asesorado'
    capacidades.lista = new Set(['puesto_de_coach'])
    render(<AvisosPraxis />)
    expect(await screen.findByText(PERSONA_A.nombre)).toBeInTheDocument()
  })

  it('mientras se consulta la capacidad, un asesorado no ve nada', () => {
    sesion.rol = 'asesorado'
    capacidades.cargando = true
    capacidades.lista = new Set(['puesto_de_coach'])
    const { container } = render(<AvisosPraxis />)
    expect(container).toBeEmptyDOMElement()
    expect(datos.avisosPendientes).not.toHaveBeenCalled()
  })
})

describe('lo que dice cada aviso', () => {
  it('quién, la hora, el tipo de señal en palabras claras y de dónde vino', async () => {
    datos.avisosPendientes.mockResolvedValue({
      ok: true,
      datos: [
        aviso({ id: 'av-1', usuarioId: PERSONA_A.id, nivel: 'vida', origen: 'praxis' }),
        aviso({ id: 'av-2', usuarioId: PERSONA_B.id, nivel: 'salud', origen: 'ingreso' }),
      ],
    })
    render(<AvisosPraxis />)
    expect(await screen.findByText(PERSONA_A.nombre)).toBeInTheDocument()
    expect(screen.getByText(PERSONA_B.nombre)).toBeInTheDocument()
    expect(screen.getByText('Riesgo para su vida')).toBeInTheDocument()
    expect(screen.getByText('Señal de salud')).toBeInTheDocument()
    expect(screen.getByText('Registro de Praxis')).toBeInTheDocument()
    expect(screen.getByText('Cuestionario de ingreso')).toBeInTheDocument()
    expect(screen.getAllByText(/^Hoy \d/)).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Avisos de Praxis' })).toBeInTheDocument()
    expect(screen.getByLabelText('2 sin atender')).toBeInTheDocument()
  })

  it('un día anterior lleva el día además de la hora', async () => {
    datos.avisosPendientes.mockResolvedValue({
      ok: true,
      datos: [aviso({ creadoEn: new Date(Date.now() - 3 * 86_400_000).toISOString() })],
    })
    render(<AvisosPraxis />)
    await screen.findByText(PERSONA_A.nombre)
    expect(screen.queryByText(/^Hoy/)).not.toBeInTheDocument()
  })

  it('no muestra ninguna frase: no hay de dónde sacarla', async () => {
    const { container } = render(<AvisosPraxis />)
    await screen.findByText(PERSONA_A.nombre)
    expect(container.textContent).toMatch(/Aquí no está lo que escribieron/)
    expect(container.querySelectorAll('textarea,input')).toHaveLength(0)
  })

  it('ofrece abrir la ficha de la persona', async () => {
    const abrir = vi.fn()
    render(<AvisosPraxis onVerPersona={abrir} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Ver ficha' }))
    expect(abrir).toHaveBeenCalledWith(PERSONA_A.id)
  })
})

describe('atender', () => {
  it('«Atendido» llama a la base a nombre del coach y el aviso sale de los pendientes', async () => {
    render(<AvisosPraxis />)
    await userEvent.click(await screen.findByRole('button', { name: `Marcar atendido el aviso de ${PERSONA_A.nombre}` }))
    await waitFor(() => expect(screen.queryByText(PERSONA_A.nombre)).not.toBeInTheDocument())
    expect(datos.marcarAvisoAtendido).toHaveBeenCalledWith('av-1', sesion.id)
    expect(screen.getByText('Sin avisos de Praxis')).toBeInTheDocument()
  })

  it('si la base no lo deja, el aviso SIGUE ahí y se dice por qué', async () => {
    datos.marcarAvisoAtendido.mockResolvedValue({ ok: false, error: 'permission denied' })
    render(<AvisosPraxis />)
    await userEvent.click(await screen.findByRole('button', { name: /Marcar atendido/ }))
    expect(await screen.findByText(/No se pudo marcar: permission denied/)).toBeInTheDocument()
    expect(screen.getByText(PERSONA_A.nombre)).toBeInTheDocument()
  })

  it('solo sale el que se marcó; el otro queda', async () => {
    datos.avisosPendientes.mockResolvedValue({
      ok: true,
      datos: [aviso({ id: 'av-1', usuarioId: PERSONA_A.id }), aviso({ id: 'av-2', usuarioId: PERSONA_B.id, nivel: 'cuidado' })],
    })
    render(<AvisosPraxis />)
    await userEvent.click(await screen.findByRole('button', { name: `Marcar atendido el aviso de ${PERSONA_A.nombre}` }))
    await waitFor(() => expect(screen.queryByText(PERSONA_A.nombre)).not.toBeInTheDocument())
    expect(screen.getByText(PERSONA_B.nombre)).toBeInTheDocument()
  })
})

describe('los atendidos se ocultan', () => {
  it('no se piden hasta que se abre «ver atendidos», y se pueden volver a ocultar', async () => {
    datos.avisosAtendidos.mockResolvedValue({
      ok: true,
      datos: [aviso({ id: 'av-9', usuarioId: PERSONA_B.id, nivel: 'pareja', atendidoEn: new Date().toISOString(), atendidoPor: sesion.id })],
    })
    render(<AvisosPraxis />)
    await screen.findByText(PERSONA_A.nombre)
    expect(datos.avisosAtendidos).not.toHaveBeenCalled()
    expect(screen.queryByText('Violencia de pareja')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'ver atendidos' }))
    const lista = await screen.findByRole('list', { name: 'Avisos atendidos' })
    expect(within(lista).getByText('Violencia de pareja')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'ocultar atendidos' }))
    expect(screen.queryByRole('list', { name: 'Avisos atendidos' })).not.toBeInTheDocument()
  })

  it('sin pendientes sigue habiendo enlace a los atendidos', async () => {
    datos.avisosPendientes.mockResolvedValue({ ok: true, datos: [] })
    render(<AvisosPraxis />)
    expect(await screen.findByText('Sin avisos de Praxis')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ver atendidos' })).toBeInTheDocument()
  })
})

describe('la migración sin aplicar y los fallos', () => {
  it('sin la tabla dice una sola línea y nada más', async () => {
    datos.avisosPendientes.mockResolvedValue({ ok: false, error: 'Could not find the table', sinTabla: true })
    const { container } = render(<AvisosPraxis />)
    expect(await screen.findByText('Avisos de Praxis: falta aplicar la migración 0108')).toBeInTheDocument()
    expect(container.textContent).toBe('Avisos de Praxis: falta aplicar la migración 0108')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('un fallo cualquiera NO se disfraza de «sin avisos»: avisa y deja reintentar', async () => {
    datos.avisosPendientes.mockResolvedValueOnce({ ok: false, error: 'JWT expired', sinTabla: false })
    render(<AvisosPraxis />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudieron leer los avisos de Praxis \(JWT expired\)/)
    expect(screen.queryByText('Sin avisos de Praxis')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText(PERSONA_A.nombre)).toBeInTheDocument()
  })
})

describe('arriba de todo en la consola', () => {
  it('está antes que la cartera y las pestañas', async () => {
    const { default: ConsolaCoachPage } = await import('./ConsolaCoachPage')
    render(<ConsolaCoachPage />)
    const modulo = await screen.findByRole('heading', { name: 'Avisos de Praxis' })
    const cartera = screen.getByRole('navigation', { name: 'Cartera de asesorados' })
    const pestanas = screen.getByRole('tablist', { name: 'Pestañas de la consola del coach' })
    expect(modulo.compareDocumentPosition(cartera) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(modulo.compareDocumentPosition(pestanas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('un asesorado que llegara a la consola no ve el módulo', async () => {
    sesion.rol = 'asesorado'
    const { default: ConsolaCoachPage } = await import('./ConsolaCoachPage')
    render(<ConsolaCoachPage />)
    await screen.findByRole('tablist', { name: 'Pestañas de la consola del coach' })
    expect(screen.queryByRole('heading', { name: 'Avisos de Praxis' })).not.toBeInTheDocument()
    expect(datos.avisosPendientes).not.toHaveBeenCalled()
  })
})
