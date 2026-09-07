import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CREDITOS_DEL_GIMNASIO, obligaACitar } from '../../../visor/creditos'
import { RecuadroCreditos } from './RecuadroCreditos'

/**
 * QUE EL CRÉDITO SE VEA, no solo que esté en un archivo.
 *
 * `creditos.test.ts` comprueba que el dato está bien; esto comprueba lo otro, que es lo
 * que pide la licencia: que el autor **aparezca en pantalla** y que se pueda llegar a su
 * ficha. Una lista correcta que nadie pinta deja el gimnasio igual de fuera de licencia
 * que no tenerla.
 */

describe('el recuadro de créditos', () => {
  it('enseña el nombre de cada autor, en texto que se lee', () => {
    render(<RecuadroCreditos />)
    for (const f of CREDITOS_DEL_GIMNASIO.filter(obligaACitar)) {
      expect(screen.getByText(f.autor), `no se ve a ${f.autor}`).toBeTruthy()
    }
  })

  it('cada obra es un enlace a su ficha, y se abre fuera sin filtrar de dónde viene', () => {
    render(<RecuadroCreditos />)
    for (const f of CREDITOS_DEL_GIMNASIO) {
      const enlace = screen.getByRole('link', { name: f.obra })
      expect(enlace.getAttribute('href')).toBe(f.enlace)
      // `noreferrer` no es celo de seguridad de más: sin él, la pestaña que se abre puede
      // tocar la nuestra, y esta app tiene sesión de una persona real abierta.
      expect(enlace.getAttribute('rel')).toContain('noreferrer')
    }
  })

  it('no se queda vacío en silencio', () => {
    // El fallo silencioso de una lista pintada con `.map` es que la lista llegue vacía: no
    // rompe nada, no avisa, y el crédito desaparece.
    render(<RecuadroCreditos />)
    expect(screen.getAllByRole('link').length).toBe(CREDITOS_DEL_GIMNASIO.length)
    expect(CREDITOS_DEL_GIMNASIO.length).toBeGreaterThan(0)
  })
})
