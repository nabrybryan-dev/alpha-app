import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Perfil } from '../../domain/types'
import { BloqueActual } from './BloqueActual'

/** Lo que el coach cargó para alguien en déficit: las tres filas técnicas y su gasto por pasos. */
const PERFIL = {
  usuarioId: 'u-1',
  faseEnergetica: 'DÉFICIT',
  proteinaGkg: 2.2,
  pasosObjetivo: 8000,
  neat: { kcalDia: 250, kcalDiaEnMeta: 320 },
} as unknown as Perfil

describe('BloqueActual · vista simple', () => {
  it('sin vista simple pinta lo de siempre', () => {
    render(<BloqueActual perfil={PERFIL} />)
    expect(screen.getByText('Tu bloque actual')).toBeInTheDocument()
    expect(screen.getByText('Fase energética')).toBeInTheDocument()
    expect(screen.getByText(/g\/kg/)).toBeInTheDocument()
    expect(screen.getByText(/kcal\/día/)).toBeInTheDocument()
  })

  it('con vista simple quedan solo los pasos, sin «fase energética», «g/kg» ni «kcal»', () => {
    const { container } = render(<BloqueActual perfil={PERFIL} simple />)
    expect(screen.getByText('Tu meta de ahora')).toBeInTheDocument()
    expect(screen.getByText('Pasos al día')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/fase energética|g\/kg|kcal|bloque/i)
  })

  it('con vista simple y sin pasos cargados, la tarjeta no se pinta vacía', () => {
    const sinPasos = { ...PERFIL, pasosObjetivo: undefined } as unknown as Perfil
    const { container } = render(<BloqueActual perfil={sinPasos} simple />)
    expect(container.textContent).not.toMatch(/fase energética|g\/kg|kcal/i)
  })
})
