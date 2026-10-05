import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MiComentario } from '../../../data/consola/comentarios'

const estado = {
  lectura: { ok: true, datos: [] } as { ok: true; datos: MiComentario[] } | { ok: false; error: string },
  enviar: vi.fn(),
  lecturas: 0,
}

vi.mock('../../../data/consola/comentarios', async (original) => {
  const real = await original<typeof import('../../../data/consola/comentarios')>()
  return {
    ...real,
    misComentarios: () => {
      estado.lecturas++
      return Promise.resolve(estado.lectura)
    },
    enviarComentario: (...a: unknown[]) => estado.enviar(...a),
  }
})

const { BuzonComentarios } = await import('./BuzonComentarios')

const comentario = (p: Partial<MiComentario> = {}): MiComentario => ({
  id: '1',
  creadoEn: '2026-09-28T10:00:00Z',
  tipo: 'falla',
  pantalla: '/hoy',
  texto: 'El video no carga con datos',
  estado: 'nuevo',
  ...p,
})

function pintar(ruta = '/entrenar/sesion/abc?token=secreto') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <BuzonComentarios />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  estado.lectura = { ok: true, datos: [] }
  estado.enviar = vi.fn().mockResolvedValue({ ok: true, id: '5' })
  estado.lecturas = 0
})

describe('los estados de lo que ya enviaste', () => {
  it('cargando, y luego el vacío confirmado', async () => {
    pintar()
    expect(screen.getByText('Cargando tus comentarios…')).toBeInTheDocument()
    expect(await screen.findByText('Todavía no has enviado comentarios.')).toBeInTheDocument()
  })

  it('un error al leer NO se dice «no has enviado»: se dice error y se reintenta', async () => {
    estado.lectura = { ok: false, error: 'permiso denegado' }
    pintar()
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron leer tus comentarios (permiso denegado)')
    expect(screen.queryByText('Todavía no has enviado comentarios.')).not.toBeInTheDocument()
    estado.lectura = { ok: true, datos: [comentario()] }
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('El video no carga con datos')).toBeInTheDocument()
  })

  it('cada comentario lleva su estado público, y solo ese', async () => {
    estado.lectura = {
      ok: true,
      datos: [
        comentario({ id: '3', estado: 'arreglado' }),
        comentario({ id: '2', texto: 'Quiero ver el RIR de la semana pasada', tipo: 'idea', estado: 'en_contrato' }),
        comentario({ id: '1', texto: 'Otro', estado: 'nuevo' }),
      ],
    }
    pintar()
    const lista = await screen.findByRole('list', { name: 'Tus comentarios enviados' })
    expect(lista).toHaveTextContent('ARREGLADO')
    expect(lista).toHaveTextContent('EN CONTRATO')
    expect(lista).toHaveTextContent('RECIBIDO')
    expect(lista).not.toHaveTextContent(/nuevo|en_contrato|arreglado/)
  })

  it('un texto ya purgado se dice, no se deja en blanco', async () => {
    estado.lectura = { ok: true, datos: [comentario({ texto: null })] }
    pintar()
    expect(await screen.findByText('(texto borrado)')).toBeInTheDocument()
  })
})

describe('enviar', () => {
  it('el aviso de que esto no es para salud ni urgencias está SIEMPRE, antes del botón', async () => {
    pintar()
    const aviso = await screen.findByText('Esto no es para salud ni urgencias: escríbele a tu coach. En una urgencia, llama al 123.')
    const boton = screen.getByRole('button', { name: 'Enviar comentario' })
    expect(aviso.compareDocumentPosition(boton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('sin texto no se envía', async () => {
    pintar()
    expect(await screen.findByRole('button', { name: 'Enviar comentario' })).toBeDisabled()
    expect(estado.enviar).not.toHaveBeenCalled()
  })

  it('manda el tipo, el texto y SOLO la ruta de la pantalla (sin consulta ni fragmento)', async () => {
    pintar('/entrenar/sesion/abc?token=secreto#parte')
    fireEvent.click(await screen.findByRole('button', { name: 'Una idea' }))
    fireEvent.change(screen.getByLabelText(/¿Qué pasó y en qué pantalla\?/), { target: { value: 'Quiero ver el RIR de la semana pasada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar comentario' }))
    await waitFor(() => expect(estado.enviar).toHaveBeenCalledTimes(1))
    const enviado = estado.enviar.mock.calls[0][0] as { tipo: string; pantalla: string; texto: string }
    expect(enviado.tipo).toBe('idea')
    expect(enviado.pantalla).toBe('/entrenar/sesion/abc')
    expect(JSON.stringify(enviado)).not.toContain('secreto')
    expect(enviado.texto).toBe('Quiero ver el RIR de la semana pasada')
  })

  it('al enviarse limpia el texto, lo confirma y vuelve a leer los comentarios', async () => {
    pintar()
    fireEvent.change(await screen.findByLabelText(/¿Qué pasó y en qué pantalla\?/), { target: { value: 'Se traba' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar comentario' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Recibido')
    expect(screen.getByLabelText(/¿Qué pasó y en qué pantalla\?/)).toHaveValue('')
    await waitFor(() => expect(estado.lecturas).toBeGreaterThan(1))
  })

  it('si el envío falla lo dice y CONSERVA lo escrito: no lo da por enviado', async () => {
    estado.enviar = vi.fn().mockResolvedValue({ ok: false, error: 'ya enviaste 10 comentarios hoy' })
    pintar()
    fireEvent.change(await screen.findByLabelText(/¿Qué pasó y en qué pantalla\?/), { target: { value: 'Se traba' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar comentario' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se envió: ya enviaste 10 comentarios hoy')
    expect(screen.getByLabelText(/¿Qué pasó y en qué pantalla\?/)).toHaveValue('Se traba')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
