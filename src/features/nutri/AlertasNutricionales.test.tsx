import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reiniciarDb } from '../../data/mockDb'

const traer = vi.fn()
vi.mock('../../data/nube/alertasNutricion', async (original) => ({
  ...(await original<typeof import('../../data/nube/alertasNutricion')>()),
  traerAlertasNutricion: () => traer(),
}))

import { AlertasNutricionales } from './AlertasNutricionales'

const pintar = () =>
  render(
    <MemoryRouter>
      <AlertasNutricionales />
    </MemoryRouter>,
  )

beforeEach(() => {
  reiniciarDb()
  traer.mockReset()
})

describe('AlertasNutricionales (apagadas por defecto)', () => {
  it('sin alertas (interruptor apagado o nada que avisar) no pinta nada', async () => {
    traer.mockResolvedValue([])
    const { container } = pintar()
    await waitFor(() => expect(traer).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('si la lectura falla, no pinta nada y no rompe la pantalla', async () => {
    traer.mockRejectedValue(new Error('red'))
    const { container } = pintar()
    await waitFor(() => expect(traer).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('con alertas abiertas, dice quién, qué alerta y por qué, y enlaza a su ficha de nutrición', async () => {
    traer.mockResolvedValue([
      {
        id: 'a1',
        asesoradoId: 'u-valentina',
        clave: 'hambre_sostenida',
        detalle: 'Hambre insostenible sostenida: se cumplieron 2 días (desde el 2026-10-27).',
        creadaEn: '2026-10-28T10:00:00Z',
      },
    ])
    pintar()
    const region = await screen.findByRole('region', { name: 'Alertas nutricionales' })
    expect(region).toHaveTextContent('Valentina')
    expect(region).toHaveTextContent('Hambre sostenida')
    expect(region).toHaveTextContent('se cumplieron 2 días')
    expect(screen.getByRole('link', { name: /Ver a Valentina/ })).toHaveAttribute(
      'href',
      '/equipo-nutricion?persona=u-valentina',
    )
  })
})
