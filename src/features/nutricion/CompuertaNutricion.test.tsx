import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CompuertaNutricion } from './CompuertaNutricion'
import { SessionProvider } from '../../app/SessionProvider'
import { db } from '../../data/dbInstance'
import { reiniciarDb } from '../../data/mockDb'
import type { Respuestas } from '../../domain/nutricion/encuesta'

/**
 * La compuerta decide DOS cosas, no una: si Nutrición se abre, y —cuando no se
 * abre— qué se le pregunta a quien está detrás.
 *
 * Lo segundo importa desde que las altas entran con la encuesta de captación ya
 * cargada. `camposAPreguntar` está escrito para eso ("se cae uno cuando ya se
 * sabe la respuesta, de la encuesta de captación o de lo que ya haya en el
 * perfil"), pero solo mira el primer argumento: si la compuerta le pasa un
 * objeto vacío, la app vuelve a preguntar las diecisiete aunque ya sepa dieciséis.
 */

/** Lo que trae un alta cargada: todo menos los pasos, que la captación no pregunta. */
const TODO_MENOS_LOS_PASOS: Respuestas = {
  genero: 'H',
  fechaNacimiento: '1990-01-15',
  pesoKg: 80,
  alturaCm: 178,
  cuelloCm: 38,
  cinturaCm: 88,
  diasEntreno: 4,
  alergias: ['ninguna'],
  condicionesMedicas: ['ninguna'],
  excluye: ['nada'],
  comeVisceras: 'algunas',
  noLeGustan: '-',
  lugarCompra: 'supermercado',
  frecuenciaCocina: 'casi_siempre',
  sinAcceso: '-',
  tieneBascula: 'si',
}

const pintar = () =>
  render(
    <MemoryRouter>
      <SessionProvider>
        <CompuertaNutricion>
          <p>Diario de comidas</p>
        </CompuertaNutricion>
      </SessionProvider>
    </MemoryRouter>,
  )

describe('CompuertaNutricion', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarDb()
  })

  it('a quien ya trae respuestas cargadas le pregunta solo lo que falta', () => {
    // Mateo no ha contestado nada en el seed, así que aquí hace de alta recién
    // cargada: se le dejan puestas todas las respuestas menos los pasos.
    localStorage.setItem('alpha-usuario', 'u-mateo')
    db.perfilNutricion.guardar('u-mateo', TODO_MENOS_LOS_PASOS, false)

    pintar()

    expect(screen.getByText(/nos falta un dato tuyo/i)).toBeInTheDocument()
    expect(screen.queryByText(/cuéntanos \d+ cosas sobre ti/i)).not.toBeInTheDocument()
  })

  it('sin nada cargado sigue preguntando la encuesta entera', () => {
    localStorage.setItem('alpha-usuario', 'u-mateo')

    pintar()

    expect(screen.getByText(/cuéntanos \d+ cosas sobre ti/i)).toBeInTheDocument()
  })

  it('con la encuesta terminada deja pasar', () => {
    // Valentina la tiene contestada en el seed.
    pintar()

    expect(screen.getByText(/diario de comidas/i)).toBeInTheDocument()
  })
})
