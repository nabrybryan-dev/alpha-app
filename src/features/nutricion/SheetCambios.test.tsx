import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SheetCambios } from './SheetCambios'
import { SessionProvider } from '../../app/SessionProvider'
import { catalogoRepo } from '../../data/catalogo/catalogoRepo'
import { db } from '../../data/dbInstance'
import { cambiosPara } from '../../domain/nutricion/bioequivalentes'

/** Quien tiene la sesión abierta en modo demo. Es a quien se le vetan cosas. */
const VALENTINA = 'u-valentina'

/**
 * Lo que protege este archivo.
 *
 * La hoja resuelve la línea del plan —texto libre que escribe la nutricionista—
 * contra el catálogo. Si esa resolución se rompe, la asesorada no ve un error:
 * ve una hoja vacía o, peor, los cambios de otro alimento. Nada más en la app
 * lo cazaría.
 */

// Con sesión: la hoja lee los vetos de quien la está mirando, así que sin
// SessionProvider no sabría de quién son.
const conSesion = (linea: string | null, onCerrar = vi.fn()) => (
  <MemoryRouter>
    <SessionProvider>
      <SheetCambios linea={linea} onCerrar={onCerrar} />
    </SessionProvider>
  </MemoryRouter>
)

const abrir = (linea: string | null) => render(conSesion(linea))

/** Sin vetos heredados de otro test: cada uno empieza donde empieza. */
beforeEach(() => {
  for (const veto of db.vetados.byUsuario(VALENTINA)) {
    db.vetados.quitar(VALENTINA, veto.alimentoId)
  }
})

describe('la hoja de cambios', () => {
  it('cerrada no pinta nada', () => {
    abrir(null)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('propone cambios con sus gramos para una línea del plan', () => {
    abrir('150 g de arroz blanco')
    const hoja = screen.getByRole('dialog')
    // Al menos una propuesta, y cada una con una cantidad: una lista de nombres
    // sin gramos no le resuelve nada a quien está cocinando.
    expect(hoja.textContent).toMatch(/\d+ g/)
  })

  it('LA DERIVA SE ENSEÑA: dice qué mueve el cambio', () => {
    // Enseñar solo «380 g de pasta» vendería un cambio gratis. Igualar el
    // macro ancla no iguala el plato.
    abrir('150 g de arroz blanco')
    const hoja = screen.getByRole('dialog')
    expect(hoja.textContent).toMatch(/kcal|proteína|carbos|grasa|casi no cambia/)
  })

  it('dice desde qué cantidad se calculó, no un número suelto', () => {
    abrir('150 g de arroz blanco')
    expect(screen.getByRole('dialog').textContent).toContain('En vez de')
  })

  it('NO PROMETE que ella pueda comerlo', () => {
    // La app no conoce las alergias de nadie —llegan en texto libre y este repo
    // se niega a interpretarlas—. Lo que sostiene la lista es de dónde sale.
    abrir('150 g de arroz blanco')
    expect(screen.getByRole('dialog').textContent).toContain('mismo grupo')
  })

  it('lo que no está en el catálogo se dice, no se queda en blanco', () => {
    abrir('un puñado de algo que no existe en ninguna tabla')
    expect(screen.getByRole('dialog').textContent).toMatch(/no encontramos|no podemos/i)
  })

  it('LO QUE LA NUTRICIONISTA VETÓ NO SE LE PROPONE', async () => {
    /**
     * La propiedad de seguridad de toda esta pantalla, de punta a punta.
     *
     * La app no interpreta el texto libre de las alergias: quien traduce es
     * Manuela, desde su panel. Si este test se pone en rojo, esa traducción
     * dejó de llegar y las propuestas vuelven a salir a ciegas — sin que nada
     * más lo note.
     */
    const [primero] = cambiosPara(
      catalogoRepo.porId('arroz-blanco-cocido')!,
      catalogoRepo.porId,
    )
    // Se veta ANTES de pintar: quitarlo después dispararía un render fuera de
    // `act`, y ese aviso enseña a ignorar avisos.
    db.vetados.vetar({
      usuarioId: VALENTINA,
      alimentoId: primero.alimento.id,
      motivo: 'alergia declarada',
    })

    abrir('150 g de arroz blanco')
    expect(screen.getByRole('dialog').textContent).not.toContain(primero.alimento.nombre)
  })

  it('se puede cerrar', async () => {
    const onCerrar = vi.fn()
    render(conSesion('150 g de arroz blanco', onCerrar))
    await userEvent.click(screen.getByLabelText('Cerrar panel'))
    expect(onCerrar).toHaveBeenCalled()
  })
})

describe('lo que ya tiene en casa', () => {
  const hoy = new Date().toISOString().slice(0, 10)

  beforeEach(() => {
    for (const item of db.despensa.byUsuario(VALENTINA)) {
      db.despensa.quitar(VALENTINA, item.alimentoId ?? '')
    }
  })

  it('con la despensa vacía la hoja se ve como siempre', () => {
    // Hoy la despensa está vacía para todo el mundo. Este camino es el de
    // siempre y no puede cambiar.
    abrir('150 g de arroz blanco')
    expect(screen.queryByText(/lo tienes en casa/i)).toBeNull()
    expect(screen.getAllByText(/ g$/).length).toBeGreaterThan(0)
  })

  it('se lo dice cuando lo tiene, porque cambia lo que puede hacer hoy', () => {
    // No es lo mismo «cámbialo por lentejas» que «cámbialo por las lentejas que
    // ya tienes»: lo segundo se resuelve esta noche sin ir al mercado, que es
    // para lo que existe esta pantalla.
    const [propuesto] = cambiosPara(
      catalogoRepo.buscar('arroz blanco', undefined, 1)[0],
      catalogoRepo.porId,
    )
    db.despensa.agregar(VALENTINA, {
      alimentoId: propuesto.alimento.id,
      cantidadG: null,
      agregadoEn: hoy,
      origen: 'compra',
    })

    abrir('150 g de arroz blanco')

    expect(screen.getByText(/lo tienes en casa/i)).toBeTruthy()
  })
})
