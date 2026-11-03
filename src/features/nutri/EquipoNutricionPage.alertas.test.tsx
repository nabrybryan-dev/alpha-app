import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reiniciarDb } from '../../data/mockDb'

const traer = vi.fn()
const estado = { rol: 'coach' as 'coach' | 'nutricionista' }

vi.mock('../../app/SessionProvider', async (original) => ({
  ...(await original<typeof import('../../app/SessionProvider')>()),
  useSesion: () => ({ usuario: { id: 'u-x', nombre: 'Prueba', rol: estado.rol, avatarIniciales: 'PP' } }),
}))
vi.mock('../coach/consola/useCapacidades', () => ({
  useCapacidades: () => ({ cargando: false, tiene: () => false, usuarioId: 'u-x' }),
}))
vi.mock('../../data/nube/alertasNutricion', async (original) => ({
  ...(await original<typeof import('../../data/nube/alertasNutricion')>()),
  traerAlertasNutricion: () => traer(),
}))

import EquipoNutricionPage from './EquipoNutricionPage'

/**
 * Decisión de Bryan (29-oct): el detalle de las alertas nutricionales, con el nombre del asesorado,
 * lo ve SOLO la nutricionista. Un coach entra a esta página, pero no ve las alertas (ni las pide).
 */
const alerta = {
  id: 'a1',
  asesoradoId: 'u-valentina',
  clave: 'hambre_sostenida',
  detalle: 'Hambre insostenible sostenida: se cumplieron 2 días.',
  creadaEn: '2026-10-28T10:00:00Z',
}

const pintar = () =>
  render(
    <MemoryRouter initialEntries={['/equipo-nutricion']}>
      <EquipoNutricionPage />
    </MemoryRouter>,
  )

beforeEach(() => {
  reiniciarDb()
  traer.mockReset()
  traer.mockResolvedValue([alerta])
})

describe('EquipoNutricionPage: el detalle de las alertas es solo de la nutricionista', () => {
  it('un coach no ve las alertas ni las pide', async () => {
    estado.rol = 'coach'
    pintar()
    await screen.findByText(/Qué cifras ve cada asesorado|Equipo/i, {}, { timeout: 3000 }).catch(() => {})
    expect(screen.queryByRole('region', { name: 'Alertas nutricionales' })).toBeNull()
    expect(traer).not.toHaveBeenCalled()
  })

  it('la nutricionista sí las ve', async () => {
    estado.rol = 'nutricionista'
    pintar()
    const region = await screen.findByRole('region', { name: 'Alertas nutricionales' })
    await waitFor(() => expect(region).toHaveTextContent('Hambre sostenida'))
  })
})
