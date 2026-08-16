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

  /** Elige el primer resultado y deja abierta la pregunta del motivo. */
  const elegir = async (busqueda = 'arroz') => {
    await userEvent.type(screen.getByLabelText(/Buscar el alimento/), busqueda)
    const [primero] = await screen.findAllByText('Vetar')
    await userEvent.click(primero)
  }

  describe('el motivo es obligatorio', () => {
    /**
     * Antes se vetaba de un toque y sin explicación. Dentro de tres meses,
     * «alergia declarada» y «no le gusta» son la misma marca en pantalla y dos
     * cosas muy distintas.
     */
    it('marcar un alimento ya no lo veta: primero pregunta por qué', async () => {
      abrir()
      await elegir()

      expect(screen.getByLabelText(/Por qué no debe comerlo/)).toBeTruthy()
      expect(db.vetados.byUsuario(VALENTINA)).toHaveLength(0)
    })

    it('con el motivo escrito, sí lo veta y lo guarda', async () => {
      abrir()
      await elegir()
      await userEvent.type(screen.getByLabelText(/Por qué no debe comerlo/), 'alergia declarada')
      await userEvent.click(screen.getByRole('button', { name: 'Vetar' }))

      const [veto] = db.vetados.byUsuario(VALENTINA)
      expect(veto.motivo).toBe('alergia declarada')
    })

    /**
     * El mínimo tiene que ser el MISMO que el `check` de la 0040
     * (`length(trim(motivo)) >= 3`). Si la pantalla fuera más permisiva, la
     * escritura pasaría aquí y moriría en la cola contra el constraint.
     */
    it('no deja guardar un motivo más corto que lo que acepta la base', async () => {
      abrir()
      await elegir()
      await userEvent.type(screen.getByLabelText(/Por qué no debe comerlo/), 'ok')

      expect(screen.getByRole('button', { name: 'Vetar' })).toBeDisabled()
      expect(screen.getByText(/Al menos 3 letras/)).toBeTruthy()
    })

    it('los espacios no cuentan como motivo', async () => {
      abrir()
      await elegir()
      await userEvent.type(screen.getByLabelText(/Por qué no debe comerlo/), '     ')

      expect(screen.getByRole('button', { name: 'Vetar' })).toBeDisabled()
    })

    it('cancelar no veta nada', async () => {
      abrir()
      await elegir()
      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

      expect(db.vetados.byUsuario(VALENTINA)).toHaveLength(0)
      expect(screen.queryByLabelText(/Por qué no debe comerlo/)).toBeNull()
    })
  })

  /**
   * Obligar a escribirlo sin enseñarlo nunca sería pedir texto que no sirve a
   * nadie. Es la pregunta «¿por qué no se le propone el huevo?», respondida.
   */
  it('el motivo se ve en la lista', () => {
    db.vetados.vetar({
      usuarioId: VALENTINA,
      alimentoId: 'arroz-blanco-cocido',
      motivo: 'intolerancia confirmada',
    })
    abrir()

    expect(screen.getByText('intolerancia confirmada')).toBeTruthy()
  })

  /** Los vetos anteriores a la 0040 pueden no tenerlo, y no se pintan en blanco. */
  it('un veto viejo sin motivo lo dice, en vez de dejar un hueco', () => {
    db.vetados.vetar({
      usuarioId: VALENTINA,
      alimentoId: 'arroz-blanco-cocido',
      motivo: 'temporal',
    })
    // Se simula la fila antigua: llegó de la nube sin motivo.
    const [veto] = db.vetados.byUsuario(VALENTINA)
    db.vetados.quitar(VALENTINA, veto.alimentoId)
    db.vetados.vetar({ ...veto, motivo: '' } as Parameters<typeof db.vetados.vetar>[0])
    abrir()

    expect(screen.getByText('Sin motivo anotado')).toBeTruthy()
  })

  it('y se puede quitar, que es la mitad que suele faltar', async () => {
    db.vetados.vetar({
      usuarioId: VALENTINA,
      alimentoId: 'arroz-blanco-cocido',
      motivo: 'alergia declarada',
    })
    abrir()

    await userEvent.click(screen.getByLabelText(/Quitar el veto/))
    expect(db.vetados.byUsuario(VALENTINA)).toHaveLength(0)
  })

  it('lo ya vetado no vuelve a salir en la búsqueda', async () => {
    // Volver a marcar lo marcado no hace nada y ocupa el sitio de lo que falta.
    db.vetados.vetar({
      usuarioId: VALENTINA,
      alimentoId: 'arroz-blanco-cocido',
      motivo: 'alergia declarada',
    })
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
