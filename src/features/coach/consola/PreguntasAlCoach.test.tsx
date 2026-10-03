import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RespuestaCoach } from '../../../data/consola/respuestasCoach'
import type { PreguntaDeLaCadena } from '../../../domain/consolaCoach/preguntasDeLaCadena'

/**
 * «Preguntas de la cadena para ti» (migración 0110). Lo que importa:
 *   - la pregunta se ve con persona, paso y fecha; con opciones declaradas, botones A/B/C; sin ellas, un campo libre;
 *   - al guardar se llama a la RPC con el id estable y la pregunta pasa al padre como respondida;
 *   - un asesorado no ve controles; con la migración sin aplicar se ven las preguntas y el aviso, sin botón de guardar;
 *   - un fallo de la base se dice, no se finge guardado.
 */
const sesion = { rol: 'coach' as string, id: 'u-coach' }

vi.mock('../../../app/SessionProvider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../app/SessionProvider')>()),
  useSesionOpcional: () => ({ usuario: { id: sesion.id, rol: sesion.rol, nombre: 'Prueba' }, esNube: true }),
}))

vi.mock('./useCapacidades', () => ({
  useCapacidades: () => ({ cargando: false, usuarioId: sesion.id, tiene: () => false }),
}))

const datos = { responder: vi.fn() }
vi.mock('../../../data/consola/respuestasCoach', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../data/consola/respuestasCoach')>()),
  responderPreguntaCoach: (...a: unknown[]) => datos.responder(...a),
}))

const { PreguntasAlCoach } = await import('./PreguntasAlCoach')

const ID = 'cp-0123456789abcdef'

function pregunta(extra: Partial<PreguntaDeLaCadena> = {}): PreguntaDeLaCadena {
  return {
    id: ID, texto: '¿Con qué volumen vuelve tras la descarga?', opciones: null, paso: 2, usuarioId: 'u-1',
    fecha: '2026-10-01T10:00:00Z', ...extra,
  }
}

function montar(over: Record<string, unknown> = {}) {
  const onRespondida = vi.fn()
  const r = render(
    <PreguntasAlCoach
      pendientes={[pregunta()]}
      respondidas={[]}
      estado={{ tipo: 'listo' }}
      nombreDe={() => 'Tatiana'}
      onRespondida={onRespondida}
      {...over}
    />,
  )
  return { ...r, onRespondida }
}

beforeEach(() => {
  sesion.rol = 'coach'
  datos.responder.mockReset().mockResolvedValue({ ok: true })
})
afterEach(() => vi.restoreAllMocks())

describe('la tarjeta', () => {
  it('muestra la pregunta, la persona, el paso y la fecha', () => {
    montar()
    expect(screen.getByText('¿Con qué volumen vuelve tras la descarga?')).toBeInTheDocument()
    expect(screen.getByText('Tatiana')).toBeInTheDocument()
    expect(screen.getByText('② Planificación')).toBeInTheDocument()
    expect(screen.getByLabelText('1 sin responder')).toBeInTheDocument()
  })

  it('sin opciones declaradas: campo de respuesta, sin botones A/B/C', () => {
    montar()
    expect(screen.queryByRole('group', { name: 'Opciones de respuesta' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Tu respuesta')).toBeInTheDocument()
  })

  it('con opciones: un botón por opción', () => {
    montar({ pendientes: [pregunta({ opciones: ['A · 45', 'B · 25', 'C · otro'] })] })
    const grupo = screen.getByRole('group', { name: 'Opciones de respuesta' })
    expect(within(grupo).getAllByRole('button').map((b) => b.textContent)).toEqual(['A · 45', 'B · 25', 'C · otro'])
  })

  it('sin nada que responder no se puede guardar', () => {
    montar()
    expect(screen.getByRole('button', { name: /Guardar la respuesta/ })).toBeDisabled()
  })
})

describe('responder', () => {
  it('con una opción: llama a la RPC con el id, la persona, el paso y el texto, y avisa al padre', async () => {
    const { onRespondida } = montar({ pendientes: [pregunta({ opciones: ['A · 45', 'B · 25'] })] })
    await userEvent.click(screen.getByRole('button', { name: 'B · 25' }))
    await userEvent.click(screen.getByRole('button', { name: /Guardar la respuesta/ }))
    await waitFor(() => expect(onRespondida).toHaveBeenCalledTimes(1))
    expect(datos.responder).toHaveBeenCalledWith({
      idPregunta: ID, usuarioId: 'u-1', paso: 2, texto: '¿Con qué volumen vuelve tras la descarga?', respuesta: 'B · 25',
    })
    expect(onRespondida.mock.calls[0][0]).toMatchObject({ idPregunta: ID, respuesta: 'B · 25' })
  })

  it('con respuesta libre', async () => {
    const { onRespondida } = montar()
    await userEvent.type(screen.getByLabelText('Tu respuesta'), '30 series')
    await userEvent.click(screen.getByRole('button', { name: /Guardar la respuesta/ }))
    await waitFor(() => expect(onRespondida).toHaveBeenCalled())
    expect(datos.responder.mock.calls[0][0].respuesta).toBe('30 series')
  })

  it('si la base la rechaza lo dice y NO la da por respondida', async () => {
    datos.responder.mockResolvedValue({ ok: false, error: 'caída', sinMigracion: false })
    const { onRespondida } = montar()
    await userEvent.type(screen.getByLabelText('Tu respuesta'), 'x')
    await userEvent.click(screen.getByRole('button', { name: /Guardar la respuesta/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se guardó: caída')
    expect(onRespondida).not.toHaveBeenCalled()
  })
})

describe('quién y con qué migración', () => {
  it('un asesorado ve la pregunta pero no tiene dónde responder', () => {
    sesion.rol = 'asesorado'
    montar()
    expect(screen.getByText('¿Con qué volumen vuelve tras la descarga?')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Guardar la respuesta/ })).not.toBeInTheDocument()
  })

  it('la nutricionista también responde', () => {
    sesion.rol = 'nutricionista'
    montar()
    expect(screen.getByRole('button', { name: /Guardar la respuesta/ })).toBeInTheDocument()
  })

  it('migración sin aplicar: las preguntas se ven, con el aviso, y sin guardar', () => {
    montar({ estado: { tipo: 'sin_tabla' } })
    expect(screen.getByText('¿Con qué volumen vuelve tras la descarga?')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('migración 0110')
    expect(screen.queryByRole('button', { name: /Guardar la respuesta/ })).not.toBeInTheDocument()
  })

  it('no poder leer las respondidas se dice, no se calla', () => {
    montar({ estado: { tipo: 'error', error: 'caída' } })
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo saber cuáles ya respondiste (caída)')
  })
})

describe('respondidas', () => {
  const hecha: RespuestaCoach = {
    idPregunta: ID, usuarioId: 'u-1', paso: 2, texto: '¿Con qué volumen vuelve?', respuesta: 'B · 25',
    respondidoPor: 'c-1', quien: 'Bryan', respondidoEn: '2026-10-03T10:00:00Z',
  }

  it('quedan en «respondidas», con quién la dio, y no en pendientes', async () => {
    montar({ pendientes: [], respondidas: [hecha] })
    expect(screen.getByText('No hay preguntas de la cadena sin responder.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /ver respondidas \(1\)/ }))
    const lista = screen.getByRole('list', { name: 'Preguntas respondidas' })
    expect(lista).toHaveTextContent('B · 25')
    expect(lista).toHaveTextContent('Bryan')
  })

  it('sin pendientes ni respondidas no pinta nada', () => {
    const { container } = montar({ pendientes: [], respondidas: [] })
    expect(container).toBeEmptyDOMElement()
  })
})
