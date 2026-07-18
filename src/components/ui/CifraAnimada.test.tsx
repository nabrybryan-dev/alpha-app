import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CifraAnimada } from './CifraAnimada'

describe('CifraAnimada', () => {
  it('termina mostrando el valor objetivo tras la animación', async () => {
    render(<CifraAnimada valor={230} duracionMs={60} />)
    expect(await screen.findByText('230', undefined, { timeout: 2000 })).toBeInTheDocument()
  })

  it('muestra 0 sin animación cuando el objetivo es 0', async () => {
    render(<CifraAnimada valor={0} duracionMs={60} />)
    expect(await screen.findByText('0', undefined, { timeout: 2000 })).toBeInTheDocument()
  })
})
