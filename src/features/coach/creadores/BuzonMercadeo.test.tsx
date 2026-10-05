import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PreguntaMercadeo } from '../../../data/consola/mercadeo'

const estado = {
  rol: 'nutricionista' as 'nutricionista' | 'coach',
  lectura: { ok: true, datos: [] } as { ok: true; datos: PreguntaMercadeo[] } | { ok: false; error: string },
  responder: vi.fn(),
  mover: vi.fn(),
  lecturas: 0,
}

vi.mock('../../../app/SessionProvider', () => ({
  useSesionOpcional: () => ({
    usuario: { id: estado.rol === 'coach' ? 'u-bryan' : 'u-manuela', nombre: 'Prueba', rol: estado.rol, avatarIniciales: 'PP' },
  }),
}))

vi.mock('../../../data/consola/mercadeo', async (original) => {
  const real = await original<typeof import('../../../data/consola/mercadeo')>()
  return {
    ...real,
    preguntasDeMercadeo: () => {
      estado.lecturas++
      return Promise.resolve(estado.lectura)
    },
    responderBuzon: (...a: unknown[]) => estado.responder(...a),
    moverRegla: (...a: unknown[]) => estado.mover(...a),
  }
})

const { BuzonMercadeo } = await import('./BuzonMercadeo')

const hoy = new Date().toLocaleDateString('en-CA')
const enDias = (n: number) => new Date(Date.now() + n * 86_400_000).toLocaleDateString('en-CA')

function pregunta(p: Partial<PreguntaMercadeo> = {}): PreguntaMercadeo {
  return {
    id: 'p-1',
    codigo: 'P-01',
    texto: '¿Qué creador colombiano corta mejor el ritmo en los primeros 2 segundos?',
    tema: 'corte',
    uso: 'regla',
    destinatariaId: 'u-manuela',
    enviadaEn: '2026-09-28T10:00:00Z',
    venceEn: enDias(5),
    estado: 'pendiente',
    respuesta: null,
    respondidaEn: null,
    reglaEstado: 'sin_regla',
    reglaCodigo: null,
    reglaEnunciado: null,
    reglaVigenteDesde: null,
    reglaRevisarAntesDe: null,
    referencias: [],
    ...p,
  }
}

const ref = (n: number, tipo: 'reel' | 'curso' = 'reel') => ({
  id: `r-${n}`, orden: n, tipo, url: `https://instagram.com/reel/${n}`, urlNormalizada: `https://instagram.com/reel/${n}`, nota: `corte al segundo ${n}`,
})

beforeEach(() => {
  estado.rol = 'nutricionista'
  estado.lectura = { ok: true, datos: [] }
  estado.responder = vi.fn().mockResolvedValue({ ok: true, id: 'p-1' })
  estado.mover = vi.fn().mockResolvedValue({ ok: true, id: 'p-1' })
  estado.lecturas = 0
})

describe('los tres estados de la lectura', () => {
  it('cargando, y luego el vacío confirmado', async () => {
    render(<BuzonMercadeo />)
    expect(screen.getByText('Cargando el buzón…')).toBeInTheDocument()
    expect(await screen.findByText('No tienes preguntas por responder.')).toBeInTheDocument()
  })

  it('un error NO se dice «sin preguntas»: se dice error y se puede reintentar', async () => {
    estado.lectura = { ok: false, error: 'permiso denegado' }
    render(<BuzonMercadeo />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo leer el buzón de mercadeo (permiso denegado)')
    expect(screen.queryByText('No tienes preguntas por responder.')).not.toBeInTheDocument()
    estado.lectura = { ok: true, datos: [pregunta()] }
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText(/corta mejor el ritmo/)).toBeInTheDocument()
  })
})

describe('Manuela responde', () => {
  async function formulario() {
    estado.lectura = { ok: true, datos: [pregunta()] }
    render(<BuzonMercadeo />)
    return within(await screen.findByRole('form', { name: 'Responder P-01' }))
  }

  it('sin respuesta no se envía y dice qué falta', async () => {
    const f = await formulario()
    fireEvent.click(f.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe tu respuesta.')
    expect(estado.responder).not.toHaveBeenCalled()
  })

  it('un contacto en el texto se avisa antes de enviar (ni @ ni teléfonos)', async () => {
    const f = await formulario()
    fireEvent.change(f.getByLabelText('Tu respuesta'), { target: { value: 'Escríbele a @creador' } })
    fireEvent.click(f.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/trae un @ o un correo/)
    expect(estado.responder).not.toHaveBeenCalled()
  })

  it('una referencia pide enlace https y una nota', async () => {
    const f = await formulario()
    fireEvent.change(f.getByLabelText('Tu respuesta'), { target: { value: 'Cortan al segundo 1' } })
    fireEvent.click(f.getByRole('button', { name: /Añadir una referencia/ }))
    fireEvent.change(f.getByLabelText('Enlace de la referencia 1'), { target: { value: 'http://ejemplo.test/reel' } })
    fireEvent.click(f.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La referencia 1 necesita un enlace que empiece por https://')
    fireEvent.change(f.getByLabelText('Enlace de la referencia 1'), { target: { value: 'https://instagram.com/reel/A' } })
    fireEvent.click(f.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La referencia 1 necesita una nota')
    expect(estado.responder).not.toHaveBeenCalled()
  })

  it('manda la respuesta con sus referencias y recarga', async () => {
    const f = await formulario()
    fireEvent.change(f.getByLabelText('Tu respuesta'), { target: { value: 'Cortan al segundo 1' } })
    fireEvent.click(f.getByRole('button', { name: /Añadir una referencia/ }))
    fireEvent.change(f.getByLabelText('Tipo de la referencia 1'), { target: { value: 'carrusel' } })
    fireEvent.change(f.getByLabelText('Enlace de la referencia 1'), { target: { value: 'https://instagram.com/p/A' } })
    fireEvent.change(f.getByLabelText('Nota de la referencia 1'), { target: { value: 'lámina 2 con la promesa' } })
    fireEvent.click(f.getByRole('button', { name: 'Enviar' }))
    await waitFor(() => expect(estado.responder).toHaveBeenCalledTimes(1))
    expect(estado.responder).toHaveBeenCalledWith('p-1', 'Cortan al segundo 1', [
      { tipo: 'carrusel', url: 'https://instagram.com/p/A', nota: 'lámina 2 con la promesa' },
    ])
    await waitFor(() => expect(estado.lecturas).toBeGreaterThan(1))
  })

  it('si la base rechaza, lo dice y CONSERVA lo escrito', async () => {
    estado.responder = vi.fn().mockResolvedValue({ ok: false, error: 'esa pregunta caducó' })
    const f = await formulario()
    fireEvent.change(f.getByLabelText('Tu respuesta'), { target: { value: 'Cortan al segundo 1' } })
    fireEvent.click(f.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('esa pregunta caducó')
    expect(f.getByLabelText('Tu respuesta')).toHaveValue('Cortan al segundo 1')
  })

  it('una pregunta vencida no se puede responder y se dice', async () => {
    estado.lectura = { ok: true, datos: [pregunta({ venceEn: enDias(-1) })] }
    render(<BuzonMercadeo />)
    expect(await screen.findByText(/venció el .* sin respuesta/)).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Responder P-01' })).not.toBeInTheDocument()
  })

  it('una respondida muestra su respuesta, sus enlaces y el estado de la regla, sin controles', async () => {
    estado.lectura = {
      ok: true,
      datos: [pregunta({ estado: 'respondida', respuesta: 'Cortan al segundo 1', referencias: [ref(1)], reglaEstado: 'propuesta', reglaCodigo: 'R-01', reglaEnunciado: 'Cortar al segundo 1' })],
    }
    render(<BuzonMercadeo />)
    expect(await screen.findByText('Cortan al segundo 1')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Referencias de P-01' })).toHaveTextContent('instagram.com/reel/1')
    expect(screen.getByText(/Regla: Propuesta/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Aprobar/ })).not.toBeInTheDocument()
  })
})

describe('el coach mueve la regla', () => {
  const respondida = (refs: ReturnType<typeof ref>[], extra: Partial<PreguntaMercadeo> = {}) =>
    pregunta({ estado: 'respondida', respuesta: 'Cortan al segundo 1', referencias: refs, ...extra })

  it('«Aprobar como vigente» no se puede con menos de 3 referencias distintas y dice cuántas faltan', async () => {
    estado.rol = 'coach'
    estado.lectura = { ok: true, datos: [respondida([ref(1), ref(2), ref(3, 'curso')])] }
    render(<BuzonMercadeo />)
    fireEvent.change(await screen.findByLabelText(/Enunciado de la regla/), { target: { value: 'Cortar al segundo 1' } })
    expect(screen.getByRole('button', { name: 'Aprobar como vigente' })).toBeDisabled()
    expect(screen.getByText(/Faltan 1\./)).toBeInTheDocument()
  })

  it('con 3 referencias y un enunciado, aprueba: manda el estado vigente y el enunciado', async () => {
    estado.rol = 'coach'
    estado.lectura = { ok: true, datos: [respondida([ref(1), ref(2), ref(3)])] }
    render(<BuzonMercadeo />)
    fireEvent.change(await screen.findByLabelText(/Enunciado de la regla/), { target: { value: 'Cortar al segundo 1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar como vigente' }))
    await waitFor(() => expect(estado.mover).toHaveBeenCalledWith('p-1', 'vigente', 'Cortar al segundo 1'))
    await waitFor(() => expect(estado.lecturas).toBeGreaterThan(1))
  })

  it('un enunciado con @ no se puede mandar', async () => {
    estado.rol = 'coach'
    estado.lectura = { ok: true, datos: [respondida([ref(1), ref(2), ref(3)])] }
    render(<BuzonMercadeo />)
    fireEvent.change(await screen.findByLabelText(/Enunciado de la regla/), { target: { value: 'Cortar como @creador' } })
    expect(screen.getByRole('button', { name: 'Aprobar como vigente' })).toBeDisabled()
  })

  it('si la base rechaza el cambio, lo dice', async () => {
    estado.rol = 'coach'
    estado.mover = vi.fn().mockResolvedValue({ ok: false, error: 'una regla vigente pide 3 referencias distintas (hay 2)' })
    estado.lectura = { ok: true, datos: [respondida([ref(1), ref(2), ref(3)])] }
    render(<BuzonMercadeo />)
    fireEvent.change(await screen.findByLabelText(/Enunciado de la regla/), { target: { value: 'Cortar al segundo 1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar como vigente' }))
    expect(await screen.findByText(/una regla vigente pide 3 referencias/)).toBeInTheDocument()
  })

  it('una regla vigente pasada de su fecha de revisión se ve CADUCADA', async () => {
    estado.rol = 'coach'
    estado.lectura = {
      ok: true,
      datos: [respondida([ref(1), ref(2), ref(3)], { reglaEstado: 'vigente', reglaCodigo: 'R-01', reglaEnunciado: 'Cortar al segundo 1', reglaRevisarAntesDe: enDias(-1), reglaVigenteDesde: enDias(-61) })],
    }
    render(<BuzonMercadeo />)
    expect(await screen.findByText('Caducada')).toBeInTheDocument()
  })

  it('una regla vigente dentro de plazo dice hasta cuándo', async () => {
    estado.rol = 'coach'
    const hasta = enDias(30)
    estado.lectura = {
      ok: true,
      datos: [respondida([ref(1), ref(2), ref(3)], { reglaEstado: 'vigente', reglaCodigo: 'R-01', reglaEnunciado: 'Cortar al segundo 1', reglaRevisarAntesDe: hasta, reglaVigenteDesde: hoy })],
    }
    render(<BuzonMercadeo />)
    expect(await screen.findByText(new RegExp(`se revisa antes del ${hasta}`))).toBeInTheDocument()
  })

  it('una pregunta de solo contexto no ofrece regla', async () => {
    estado.rol = 'coach'
    estado.lectura = { ok: true, datos: [respondida([], { uso: 'solo_contexto' })] }
    render(<BuzonMercadeo />)
    expect(await screen.findByText(/solo contexto: explica, no genera regla/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Aprobar/ })).not.toBeInTheDocument()
  })

  it('el coach no ve el formulario de respuesta de Manuela', async () => {
    estado.rol = 'coach'
    estado.lectura = { ok: true, datos: [pregunta()] }
    render(<BuzonMercadeo />)
    expect(await screen.findByText(/Esperando la respuesta de Manuela/)).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Responder P-01' })).not.toBeInTheDocument()
  })
})
