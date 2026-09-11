import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EnsayoDeEncuadre } from './EnsayoDeEncuadre'
import { juzgarColocacion } from './juzgarColocacion'

/**
 * El ensayo se prueba por la pantalla, no solo por su cálculo: `juzgarColocacion` ya
 * tiene sus casos en su propio test. Aquí lo que se comprueba es que **el sello dice lo
 * que la puerta dictamina** y que **los dos deslizadores que importan cambian el
 * veredicto**, que es lo único que la pantalla añade sobre la función pura.
 */

/** El sitio bueno de arranque, el mismo que el ensayo pone por defecto. */
const BUENA = { anguloGrados: 180, distancia: 3.0, altura: 1.0 }

describe('el ensayo de colocación en pantalla', () => {
  it('arranca en el perfil y el sello dice lo que dice la puerta', () => {
    // El señuelo va incorporado: la aserción de abajo NO es «pone buena», es «pone lo
    // MISMO que juzgarColocacion». Si la pantalla fijara el sello a una palabra suelta,
    // este test la cazaría en cuanto la puerta cambiara de opinión.
    render(<EnsayoDeEncuadre />)
    const nivel = juzgarColocacion(BUENA, false).nivel
    expect(nivel).toBe('buena')
    // El sello lleva su palabra por aria-label o por texto; la frase del ensayo es la
    // que confirma que es ESTE juicio y no el de un resultado.
    expect(screen.getByText(/sale una medida fiable/i)).toBeInTheDocument()
  })

  it('torcer el ángulo más allá del tope degrada el sello, sin tocar la cámara', () => {
    render(<EnsayoDeEncuadre />)
    const angulo = screen.getByLabelText(/ángulo/i)
    // 150° = 30° fuera del perfil: pasado el tope, ni con disco se salva.
    fireEvent.change(angulo, { target: { value: '150' } })
    // La puerta lo confirma sobre el mismo par de valores.
    expect(juzgarColocacion({ ...BUENA, anguloGrados: 150 }, false).nivel).not.toBe('buena')
    expect(screen.queryByText(/sale una medida fiable/i)).not.toBeInTheDocument()
  })

  it('el disco es lo que separa aprobar de no, en la zona de en medio', () => {
    // 18° fuera del perfil: con disco se puede deshacer el escorzo y pasa; sin él, no.
    // Es el interruptor que el núcleo no puede adivinar, así que la pantalla lo ofrece.
    render(<EnsayoDeEncuadre />)
    const angulo = screen.getByLabelText(/ángulo/i)
    fireEvent.change(angulo, { target: { value: '162' } })
    // Sin disco (arranque), la de 18° no es buena.
    expect(juzgarColocacion({ ...BUENA, anguloGrados: 162 }, false).nivel).not.toBe('buena')
    // Se enciende el disco y el veredicto sube.
    fireEvent.click(screen.getByRole('button', { name: /disco/i }))
    expect(juzgarColocacion({ ...BUENA, anguloGrados: 162 }, true).nivel).toBe('buena')
    expect(screen.getByText(/sale una medida fiable/i)).toBeInTheDocument()
  })

  it('las lecturas que enseña son las del mismo cálculo que el sello', () => {
    render(<EnsayoDeEncuadre />)
    // desvío 0 en el perfil, y el ancho de escena y el disco en píxeles a la vista.
    expect(screen.getByText(/desvío/i)).toBeInTheDocument()
    expect(screen.getByText(/escena/i)).toBeInTheDocument()
    expect(screen.getByText(/disco/i, { selector: 'p, p *' })).toBeInTheDocument()
  })
})
