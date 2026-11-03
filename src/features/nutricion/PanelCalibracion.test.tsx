import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { catalogoRepo } from '../../data/catalogo/catalogoRepo'
import { PanelCalibracion } from './PanelCalibracion'

/**
 * «Tu ojo» entrena a estimar sin báscula, y su buscador enseñaba kcal/100 g
 * aunque la nutricionista hubiera apagado el contador. La hoja es la misma que
 * la del diario, así que el interruptor tiene que atravesar este panel.
 *
 * La comprobación mira la CIFRA, no la palabra: si el rótulo «kcal» desaparece
 * pero el 130 sigue en la fila, la fuga clínica continúa.
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

  it('con el contador apagado no queda pintada la cifra de kcal de la fila', async () => {
    const usuario = userEvent.setup()
    const candidato = catalogoRepo.buscar('arroz', {}, 60).find((alimento) => {
      const kcal = Math.round(alimento.por100g.kcal ?? -1)
      if (kcal <= 0) return false
      return ![alimento.por100g.proteina_g, alimento.por100g.carbos_g, alimento.por100g.grasa_g].some(
        (macro) => macro !== null && Math.round(macro) === kcal,
      )
    })
    if (!candidato) throw new Error('no hay un arroz cuya kcal no coincida con un macro')

    render(<PanelCalibracion pruebas={[]} diasPesando={0} verKcal={false} onRegistrar={vi.fn()} />)
    await usuario.click(screen.getByRole('button', { name: /hacer una prueba/i }))
    await usuario.type(screen.getByLabelText('Nombre del alimento'), 'arroz')

    const fila = screen.getByText(candidato.nombre).closest('button') as HTMLElement
    expect(within(fila).queryByText(String(Math.round(candidato.por100g.kcal!)))).toBeNull()
  })
})
