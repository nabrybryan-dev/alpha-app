import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

const f = vi.hoisted(() => ({
  capacidad: true, estado: 'propuesto', liberada: false,
  rpc: vi.fn(), select: vi.fn(), eq: vi.fn(), single: vi.fn(),
}))
vi.mock('../../../../data/supabase', () => ({ modoNube: true, supabase: () => ({
  from: (tabla: string) => { expect(tabla).toBe('microciclos'); return { select: f.select } }, rpc: f.rpc,
}) }))
vi.mock('../useCapacidades', () => ({ useCapacidades: () => ({
  cargando: false, tiene: (c: string) => f.capacidad && c === 'liberar_prescripcion',
}) }))
vi.mock('../usePersona', () => ({ usePersona: () => ({
  hoy: '2026-11-02', activo: undefined, plan: { estado: 'listo', valor: null },
  historial: { estado: 'listo', valor: [{ id: 'propuesta-inventada', numero: 2, fechaInicio: '2026-11-02', estado: f.estado, sesiones: [] }] },
}) }))
vi.mock('../ficha/SeccionPlan', () => ({ SeccionAdherenciaHistorial: () => null }))
const { MicrociclosTab } = await import('./MicrociclosTab')
const datosServidor = { numero: 2, sesiones: [], marca: 'fixture-inventado' }

beforeEach(() => {
  vi.clearAllMocks()
  f.capacidad = true; f.estado = 'propuesto'; f.liberada = false
  f.select.mockReturnValue({ eq: f.eq })
  f.eq.mockReturnValue({ single: f.single })
  f.single.mockImplementation(async () => ({ data: { datos: datosServidor, estado: f.estado }, error: null }))
  f.rpc.mockImplementation(async (nombre: string) => {
    if (nombre === 'microciclo_liberado') return { data: f.liberada, error: null }
    if (nombre === 'huella_microciclo') return { data: 'HUELLA-DEL-SERVIDOR', error: null }
    if (nombre === 'liberar_microciclo') { f.liberada = true; return { data: null, error: null } }
    if (nombre === 'activar_microciclo') { f.estado = 'activo'; return { data: null, error: null } }
    throw new Error(`RPC inesperada ${nombre}`)
  })
})

it('libera con los datos y la huella del servidor, y solo entonces permite activar', async () => {
  const user = userEvent.setup()
  render(<MicrociclosTab usuarioId="persona-inventada" />)
  expect(screen.queryByRole('button', { name: 'Activar' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Liberar' }))
  await screen.findByRole('button', { name: 'Activar' })
  expect(screen.queryByRole('button', { name: 'Liberar' })).toBeNull()
  expect(f.select).toHaveBeenCalledWith('datos, estado')
  expect(f.eq).toHaveBeenCalledWith('id', 'propuesta-inventada')
  expect(f.rpc).toHaveBeenCalledWith('huella_microciclo', { p_datos: datosServidor })
  expect(f.rpc).toHaveBeenCalledWith('liberar_microciclo', { p_propuesta_id: 'propuesta-inventada', p_huella: 'HUELLA-DEL-SERVIDOR' })
  await user.click(screen.getByRole('button', { name: 'Activar' }))
  await screen.findByRole('status')
  expect(f.rpc).toHaveBeenCalledWith('activar_microciclo', { p_propuesta_id: 'propuesta-inventada' })
})

it.each(['sin capacidad', 'activo', 'cerrado'])('no muestra Liberar: %s', async (caso) => {
  f.capacidad = caso !== 'sin capacidad'
  f.estado = caso === 'sin capacidad' ? 'propuesto' : caso
  render(<MicrociclosTab usuarioId="persona-inventada" />)
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Liberar' })).toBeNull())
  expect(f.rpc).not.toHaveBeenCalledWith('liberar_microciclo', expect.anything())
})

it('sin capacidad no muestra Activar aunque la liberación esté vigente', async () => {
  f.capacidad = false; f.liberada = true
  render(<MicrociclosTab usuarioId="persona-inventada" />)
  await waitFor(() => expect(f.rpc).toHaveBeenCalledWith('microciclo_liberado', expect.anything()))
  expect(screen.queryByRole('button', { name: 'Activar' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Liberar' })).toBeNull()
})

it('no activa si la liberación dejó de estar vigente', async () => {
  f.liberada = true
  render(<MicrociclosTab usuarioId="persona-inventada" />)
  const boton = await screen.findByRole('button', { name: 'Activar' })
  f.liberada = false
  await userEvent.click(boton)
  expect(await screen.findByRole('alert')).toHaveTextContent('La liberación no quedó vigente.')
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Activar' })).toBeNull())
  expect(f.rpc).not.toHaveBeenCalledWith('activar_microciclo', expect.anything())
})

it.each(['huella_microciclo', 'liberar_microciclo', 'activar_microciclo', 'microciclo_liberado'])('muestra el error literal de %s', async (rpcFallida) => {
  const original = f.rpc.getMockImplementation()!
  f.liberada = rpcFallida === 'activar_microciclo'
  f.rpc.mockImplementation(async (nombre: string, ...args: unknown[]) => nombre === rpcFallida
    ? { data: null, error: { code: '42501', message: 'mensaje literal de la base' } }
    : original(nombre, ...args))
  render(<MicrociclosTab usuarioId="persona-inventada" />)
  if (rpcFallida !== 'microciclo_liberado') await userEvent.click(await screen.findByRole('button', { name: rpcFallida === 'activar_microciclo' ? 'Activar' : 'Liberar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('42501: mensaje literal de la base')
  expect(screen.queryByRole('status')).toBeNull()
})


it('CANDADO: activar sin error pero sin estado activo avisa y no anuncia exito', async () => {
  f.liberada = true
  const original = f.rpc.getMockImplementation()!
  f.rpc.mockImplementation(async (nombre: string, ...args: unknown[]) => nombre === 'activar_microciclo'
    ? { data: null, error: null } : original(nombre, ...args))
  render(<MicrociclosTab usuarioId="persona-inventada" />)
  await userEvent.click(await screen.findByRole('button', { name: 'Activar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se activó: la base respondió sin activar la propuesta.')
  expect(screen.queryByRole('status')).toBeNull()
  expect(f.select).toHaveBeenCalledWith('estado')
})

it('liberar sin error pero sin vigencia avisa y no muestra Activar', async () => {
  const original = f.rpc.getMockImplementation()!
  f.rpc.mockImplementation(async (nombre: string, ...args: unknown[]) => nombre === 'liberar_microciclo'
    ? { data: null, error: null } : original(nombre, ...args))
  render(<MicrociclosTab usuarioId="persona-inventada" />)
  await userEvent.click(screen.getByRole('button', { name: 'Liberar' }))
  await waitFor(() => expect(f.rpc.mock.calls.filter(([nombre]) => nombre === 'microciclo_liberado')).toHaveLength(2))
  expect(await screen.findByRole('alert')).toHaveTextContent('La liberación no quedó vigente.')
  expect(screen.queryByRole('button', { name: 'Activar' })).toBeNull()
})

it('recomprueba el estado cambiado en servidor antes de pedir huella o liberar', async () => {
  f.single.mockResolvedValue({ data: { datos: datosServidor, estado: 'activo' }, error: null })
  render(<MicrociclosTab usuarioId="persona-inventada" />)
  await userEvent.click(screen.getByRole('button', { name: 'Liberar' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Liberar' })).not.toBeDisabled())
  expect(f.rpc).not.toHaveBeenCalledWith('huella_microciclo', expect.anything())
  expect(f.rpc).not.toHaveBeenCalledWith('liberar_microciclo', expect.anything())
  expect(await screen.findByRole('alert')).toHaveTextContent('La propuesta ya no está en estado propuesto.')
})

it('activar comprueba la capacidad de nuevo en el manejador', async () => {
  f.liberada = true
  render(<MicrociclosTab usuarioId="persona-inventada" />)
  const boton = await screen.findByRole('button', { name: 'Activar' })
  f.capacidad = false
  await userEvent.click(boton)
  expect(f.rpc.mock.calls.filter(([nombre]) => nombre === 'microciclo_liberado')).toHaveLength(1)
  expect(f.rpc).not.toHaveBeenCalledWith('activar_microciclo', expect.anything())
})

it('Activar muestra el error literal del recheck de vigencia y no activa', async () => {
  f.liberada = true
  render(<MicrociclosTab usuarioId="persona-inventada" />)
  const boton = await screen.findByRole('button', { name: 'Activar' })
  f.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'recheck denegado' } })
  await userEvent.click(boton)
  expect(await screen.findByRole('alert')).toHaveTextContent('42501: recheck denegado')
  expect(f.rpc).not.toHaveBeenCalledWith('activar_microciclo', expect.anything())
})

it.each(['Liberar', 'Activar'])('dos clics reales en el mismo tick en %s envian una sola RPC', async (accion) => {
  f.liberada = accion === 'Activar'
  const original = f.rpc.getMockImplementation()!
  let resolver!: (valor: { data: null; error: null }) => void
  const pendiente = new Promise<{ data: null; error: null }>((resolve) => { resolver = resolve })
  const rpcAccion = accion === 'Activar' ? 'activar_microciclo' : 'liberar_microciclo'
  f.rpc.mockImplementation((nombre: string, ...args: unknown[]) => nombre === rpcAccion ? pendiente : original(nombre, ...args))
  render(<MicrociclosTab usuarioId="persona-inventada" />)
  const boton = await screen.findByRole('button', { name: accion })
  // Eventos DOM reales, sin esperar el render entre ellos: disabled aun no se ha pintado.
  act(() => { boton.click(); boton.click() })
  await waitFor(() => expect(f.rpc.mock.calls.filter(([nombre]) => nombre === rpcAccion)).toHaveLength(1))
  expect(boton).toBeDisabled()
  await act(async () => { resolver({ data: null, error: null }); await pendiente })
  expect(f.rpc.mock.calls.filter(([nombre]) => nombre === rpcAccion)).toHaveLength(1)
})
