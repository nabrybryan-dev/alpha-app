import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { accionesPrincipales } from '../../../domain/patrones/acciones'
import { PATRONES } from '../../../domain/patrones/catalogo'
import { EstudioDelPatron } from './EstudioDelPatron'

const patron = (id: string) => PATRONES.find((p) => p.id === id)!

describe('el estudio del patrón', () => {
  it('abre por el ejercicio, que es a lo que se venía', () => {
    render(<EstudioDelPatron patron={patron('empuje_vertical')} />)
    expect(screen.getByRole('button', { name: /el ejercicio/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('deja pasar al sujeto y volver', async () => {
    const usuario = userEvent.setup()
    render(<EstudioDelPatron patron={patron('empuje_vertical')} />)
    await usuario.click(screen.getByRole('button', { name: /una articulación/i }))
    // El explorador trae su propia botonera de articulaciones; el visor no.
    expect(screen.getByRole('button', { name: 'Radiocubital' })).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: /el ejercicio/i }))
    expect(screen.queryByRole('button', { name: 'Radiocubital' })).not.toBeInTheDocument()
  })

  it('arranca en una articulación que ese ejercicio de verdad usa', async () => {
    const usuario = userEvent.setup()
    // No se fija CUÁL —eso lo decide el recorrido y cambiaría al retocar un
    // ángulo— sino que sea del ejercicio. Abrir una sentadilla por el codo,
    // que es el arranque por defecto, sería enseñar algo que no viene a cuento.
    for (const id of ['sentadilla', 'empuje_vertical', 'traccion_vertical']) {
      const p = patron(id)
      const suyas = accionesPrincipales(p).map((r) => r.articulacion.nombre)
      const { unmount } = render(<EstudioDelPatron patron={p} />)
      await usuario.click(screen.getByRole('button', { name: /una articulación/i }))
      const titulo = screen.getByRole('heading', { level: 2 }).textContent ?? ''
      expect(suyas, `${id} abre por «${titulo}» y no la usa`).toContain(titulo)
      unmount()
    }
  })
})
