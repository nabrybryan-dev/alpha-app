import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SELLOS, TEXTO_DEL_SELLO } from '../../domain/praxis/laboratorio/sello'
import { SelloLaboratorio } from './SelloLaboratorio'

describe('SelloLaboratorio', () => {
  it('dibuja el texto del sello y su fuente', () => {
    for (const sello of SELLOS) {
      const { unmount } = render(<SelloLaboratorio sello={sello} fuente="Estudio de ejemplo" />)
      expect(screen.getByText(TEXTO_DEL_SELLO[sello])).toBeTruthy()
      expect(screen.getByText(/Fuente: Estudio de ejemplo/)).toBeTruthy()
      unmount()
    }
  })

  it('sin fuente no dibuja nada', () => {
    const { container } = render(<SelloLaboratorio sello="evidencia" fuente="  " />)
    expect(container.innerHTML).toBe('')
  })
})
