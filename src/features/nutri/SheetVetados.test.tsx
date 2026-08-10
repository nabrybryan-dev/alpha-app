import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '../../data/dbInstance'
import { SheetVetados } from './SheetVetados'

/**
 * Lo que protege este archivo.
 *
 * Aquí es donde la nutricionista traduce «soy alérgica a los mariscos» a
 * alimentos del catálogo, y esa traducción es lo único que impide que la app le
 * proponga a alguien lo que le hace daño. Si esta pantalla se rompe, no falla
 * nada visible: simplemente nadie codifica nada y las propuestas salen a ciegas.
 */

const VALENTINA = 'u-valentina'

const abrir = () =>
  render(<SheetVetados asesoradoId={VALENTINA} nombre="Valentina" onCerrar={vi.fn()} />)

/** Deja a Valentina sin vetos, para que un test no herede los del anterior. */
beforeEach(() => {
  for (const veto of db.vetados.byUsuario(VALENTINA)) {
    db.vetados.quitar(VALENTINA, veto.alimentoId)
  }
})

describe('el panel de lo que no debe comer', () => {
  it('cerrado no pinta nada', () => {
    render(<SheetVetados asesoradoId={null} nombre="" onCerrar={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('enseña lo que ella escribió, que es contra lo que se traduce', () => {
    // Sin el texto crudo a la vista, Manuela traduciría de memoria.
    abrir()
    expect(screen.getByRole('dialog').textContent).toContain('Lo que ella escribió')
  })

  it('dice cuántos lleva, y el cero es el dato que importa', () => {
    abrir()
    expect(screen.getByText(/Vetados \(0\)/)).toBeTruthy()
  })

  it('buscar y marcar un alimento lo deja vetado', async () => {
    abrir()
    await userEvent.type(screen.getByLabelText(/Buscar el alimento/), 'arroz')
    const [primero] = await screen.findAllByText('Vetar')
    await userEvent.click(primero)

    expect(db.vetados.byUsuario(VALENTINA)).toHaveLength(1)
  })

  it('y se puede quitar, que es la mitad que suele faltar', async () => {
    db.vetados.vetar({ usuarioId: VALENTINA, alimentoId: 'arroz-blanco-cocido' })
    abrir()

    await userEvent.click(screen.getByLabelText(/Quitar el veto/))
    expect(db.vetados.byUsuario(VALENTINA)).toHaveLength(0)
  })

  it('lo ya vetado no vuelve a salir en la búsqueda', async () => {
    // Volver a marcar lo marcado no hace nada y ocupa el sitio de lo que falta.
    db.vetados.vetar({ usuarioId: VALENTINA, alimentoId: 'arroz-blanco-cocido' })
    abrir()
    await userEvent.type(screen.getByLabelText(/Buscar el alimento/), 'arroz blanco')

    const propuestos = screen.queryAllByText('Vetar')
    for (const boton of propuestos) {
      expect(boton.closest('button')?.textContent).not.toContain('Arroz blanco enriquecido')
    }
  })

  it('deja claro que esto NO impide registrar', () => {
    // Regla R6, sin excepciones. Si se lo comió, tiene que poder anotarlo.
    abrir()
    expect(screen.getByRole('dialog').textContent).toMatch(/no qué puede registrar/)
  })
})
