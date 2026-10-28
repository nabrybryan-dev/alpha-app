import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PanelCalibracion } from './PanelCalibracion'

/**
 * «Tu ojo» entrena a estimar sin báscula, y su buscador enseñaba kcal/100 g
 * aunque la nutricionista hubiera apagado el contador. La hoja es la misma que
 * la del diario, así que el interruptor tiene que atravesar este panel.
 */
describe('PanelCalibracion · contador de kcal', () => {
  it('con el contador apagado su buscador no enseña kcal y sigue encontrando', async () => {
    const usuario = userEvent.setup()
    render(<PanelCalibracion pruebas={[]} diasPesando={0} verKcal={false} onRegistrar={vi.fn()} />)

    await usuario.click(screen.getByRole('button', { name: /hacer una prueba/i }))
    await usuario.type(screen.getByLabelText('Nombre del alimento'), 'arroz')

    expect(screen.queryByText(/kcal/i)).toBeNull()
    expect(screen.getAllByRole('button', { name: /arroz/i }).length).toBeGreaterThan(0)
  })
})
