import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EstadoAvisos } from '../avisos/estadoAvisos'

/**
 * «YO» (decisión de Bryan, 28-oct): avisos, buzón de comentarios y cambio de clave. NADA de salud.
 * El estado de los avisos y el cambio de clave se sustituyen en su capa más baja; el buzón es el real.
 */
const estado = { avisos: 'sin-preguntar' as EstadoAvisos }
const activar = vi.fn(async () => {
  estado.avisos = 'activo'
  return estado.avisos
})
const apagar = vi.fn(async () => {
  estado.avisos = 'apagado'
  return estado.avisos
})
vi.mock('../avisos/estadoAvisos', () => ({
  CLAVE_VISTO: 'alpha-aviso-preguntado',
  leerEstadoAvisos: () => Promise.resolve(estado.avisos),
  activarAvisos: (id: string) => activar(id),
  apagarAvisos: (id: string) => apagar(id),
}))

const actualizar = vi.fn(async (_: { password: string }) => ({ error: null as { message: string } | null }))
vi.mock('../../data/supabase', () => ({
  modoNube: true,
  supabase: () => ({ auth: { updateUser: (d: { password: string }) => actualizar(d) } }),
}))
vi.mock('../../app/SessionProvider', () => ({
  useSesion: () => ({ usuario: { id: 'u-valentina', nombre: 'Valentina', rol: 'asesorado', avatarIniciales: 'VC' } }),
}))

const { default: YoPage } = await import('./YoPage')

function montar() {
  return render(
    <MemoryRouter initialEntries={['/yo']}>
      <YoPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  estado.avisos = 'sin-preguntar'
  activar.mockClear()
  apagar.mockClear()
  actualizar.mockClear()
})

describe('Yo', () => {
  it('lleva las tres cosas y ninguna de salud', async () => {
    montar()
    expect(await screen.findByRole('switch', { name: 'Avisos en el teléfono' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Tus comentarios sobre la app' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cambiar la clave' })).toBeInTheDocument()
    expect(screen.queryByText(/check-in|kcal|peso|plan de nutrición/i)).not.toBeInTheDocument()
  })

  it('sin preguntar: el interruptor está apagado, lo dice, y al tocarlo pide el permiso', async () => {
    montar()
    const sw = await screen.findByRole('switch', { name: 'Avisos en el teléfono' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText(/Aún no has decidido/)).toBeInTheDocument()
    await userEvent.click(sw)
    expect(activar).toHaveBeenCalledWith('u-valentina')
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Avisos en el teléfono' })).toHaveAttribute('aria-checked', 'true'))
    expect(screen.getByText(/Activados/)).toBeInTheDocument()
  })

  it('activo: al tocarlo se apagan', async () => {
    estado.avisos = 'activo'
    montar()
    const sw = await screen.findByRole('switch', { name: 'Avisos en el teléfono' })
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'true'))
    await userEvent.click(sw)
    expect(apagar).toHaveBeenCalledWith('u-valentina')
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Avisos en el teléfono' })).toHaveAttribute('aria-checked', 'false'))
  })

  it('bloqueado en el navegador: no se puede encender desde aquí y se dice cómo', async () => {
    estado.avisos = 'bloqueado'
    montar()
    const sw = await screen.findByRole('switch', { name: 'Avisos en el teléfono' })
    await waitFor(() => expect(sw).toBeDisabled())
    expect(screen.getByText(/Bloqueados en tu navegador/)).toBeInTheDocument()
  })

  it('cambiar la clave: pide las dos iguales y de 6 o más; con una buena la guarda', async () => {
    montar()
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'abcdef')
    await userEvent.type(screen.getByLabelText('Repite la contraseña'), 'abcdeg')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(await within(screen.getByRole('region', { name: 'Clave' })).findByRole('alert')).toHaveTextContent('no coinciden')
    expect(actualizar).not.toHaveBeenCalled()

    await userEvent.clear(screen.getByLabelText('Repite la contraseña'))
    await userEvent.type(screen.getByLabelText('Repite la contraseña'), 'abcdef')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(actualizar).toHaveBeenCalledWith({ password: 'abcdef' })
    expect(await within(screen.getByRole('region', { name: 'Clave' })).findByRole('status')).toHaveTextContent(/actualizada/)
  })

  it('si Supabase rechaza la clave, lo dice y no da por hecho el cambio', async () => {
    actualizar.mockResolvedValueOnce({ error: { message: 'clave débil' } })
    montar()
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'abcdef')
    await userEvent.type(screen.getByLabelText('Repite la contraseña'), 'abcdef')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(await within(screen.getByRole('region', { name: 'Clave' })).findByRole('alert')).toHaveTextContent('clave débil')
    expect(screen.queryByText(/actualizada/)).not.toBeInTheDocument()
  })
})
