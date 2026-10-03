import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PanelPrescripcion, type PanelPrescripcionProps } from './PanelPrescripcion'

describe('PanelPrescripcion', () => {
  it('presenta literalmente los cinco valores sin mutar la entrada', () => {
    const entrada: PanelPrescripcionProps = {
      tecnica: 'Pausa exacta de dos segundos',
      series: 4,
      repeticiones: '6–8',
      velocidadUltima: '−22 %',
      descanso: '3 min',
    }
    const copia = structuredClone(entrada)
    render(<PanelPrescripcion {...entrada} />)
    for (const valor of Object.values(entrada)) {
      expect(screen.getByText(String(valor))).toBeInTheDocument()
    }
    expect(entrada).toEqual(copia)
  })
})
