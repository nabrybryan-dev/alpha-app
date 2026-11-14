import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PREGUNTAS_VIDA } from '../../domain/tarjetaVida'
import { AvisoDelDomingo } from './AvisoDelDomingo'

/**
 * «Tu tarjeta del domingo» de «Alpha · Rediseño» (maqueta 7, Semana): fuera del domingo la tarjeta de estilo de vida no
 * se puede contestar, pero se anuncia («se abre el domingo 15») y se pueden leer sus siete preguntas. Solo con el diseño
 * final; las demás cuentas, como siempre (nada fuera del domingo).
 */
describe('el aviso de la tarjeta del domingo', () => {
  it('dice qué domingo se abre y deja ver las siete preguntas sin contestarlas', async () => {
    render(<AvisoDelDomingo hoy="2026-11-13" disenoFinal />)
    expect(screen.getByText('Tu tarjeta del domingo')).toBeInTheDocument()
    expect(screen.getByText(/Se abre el domingo 15; hoy puedes ver cuáles son/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ver las preguntas' }))
    const hoja = await screen.findByRole('dialog')
    for (const p of PREGUNTAS_VIDA) expect(within(hoja).getByText(p.texto)).toBeInTheDocument()
    expect(within(hoja).queryByRole('button', { name: /Guardar/ })).not.toBeInTheDocument()
  })

  it('sin el diseño final no pinta nada', () => {
    const { container } = render(<AvisoDelDomingo hoy="2026-11-13" disenoFinal={false} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('el aviso en domingo', () => {
  it('un domingo (ya respondida) anuncia el domingo siguiente, no el de hoy', () => {
    render(<AvisoDelDomingo hoy="2026-11-15" disenoFinal />)
    expect(screen.getByText(/Se abre el domingo 22;/)).toBeInTheDocument()
  })
})
