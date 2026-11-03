/**
 * Si traer las decisiones de aviso falla, el panel no aparece y parece «aún sin datos».
 * El fallo tiene que dejar rastro, y el rastro no puede llevar nada de la respuesta.
 */
import { render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../data/nube/avisos', () => ({
  traerDecisionesDeAviso: () => {
    const e = new Error('cuerpo con texto de una persona')
    e.name = 'FalloDeRed'
    return Promise.reject(e)
  },
}))

import { EmbudoDeAvisos } from './EmbudoDeAvisos'

describe('EmbudoDeAvisos cuando falla la lectura', () => {
  afterEach(() => vi.restoreAllMocks())

  it('registra el tipo de error sin el mensaje y no pinta el panel', async () => {
    const espia = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(<EmbudoDeAvisos />)
    await waitFor(() => expect(espia).toHaveBeenCalledTimes(1))
    const args = espia.mock.calls[0]
    expect(args).toEqual(['EmbudoDeAvisos: no se pudieron traer las decisiones', 'FalloDeRed'])
    expect(JSON.stringify(args)).not.toContain('persona')
    expect(container.innerHTML).toBe('')
  })
})
