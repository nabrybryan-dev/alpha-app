import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { AvisoSinSincronizar } from './AvisoSinSincronizar'

const CLAVE_DESCARTES = 'alpha-cola-descartes'

function apartar(cuantas: number, duenio?: string): void {
  const ops = Array.from({ length: cuantas }, () => ({
    tabla: 'registro_comida',
    tipo: 'upsert',
    payload: {},
    duenio,
  }))
  localStorage.setItem(CLAVE_DESCARTES, JSON.stringify(ops))
}

describe('AvisoSinSincronizar', () => {
  beforeEach(() => localStorage.clear())

  it('sin nada apartado no ocupa espacio', () => {
    const { container } = render(<AvisoSinSincronizar usuarioId="u1" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('dice cuántos faltan sin prometer que son todos', () => {
    // El montón tiene tope y tira lo más viejo: el número es un mínimo, y el
    // texto no puede dar a entender otra cosa.
    apartar(3, 'u1')
    render(<AvisoSinSincronizar usuarioId="u1" />)
    expect(screen.getByText(/Al menos 3 registros no han llegado/)).toBeInTheDocument()
  })

  it('concuerda en singular', () => {
    apartar(1, 'u1')
    render(<AvisoSinSincronizar usuarioId="u1" />)
    expect(screen.getByText(/Al menos 1 registro no ha llegado/)).toBeInTheDocument()
  })

  it('tranquiliza en vez de asustar: el dato no se perdió', () => {
    // Es lo que más importa del texto. Un aviso que sugiera pérdida hace que la
    // persona deje de registrar, que es peor que el fallo.
    apartar(2, 'u1')
    render(<AvisoSinSincronizar usuarioId="u1" />)
    expect(screen.getByText(/sigue guardado en tu teléfono, no se perdió/i)).toBeInTheDocument()
    expect(screen.queryByText(/perdid[oa]s|error|fallo/i)).not.toBeInTheDocument()
  })

  it('no enseña lo de otra persona en un móvil compartido', () => {
    apartar(4, 'u2')
    const { container } = render(<AvisoSinSincronizar usuarioId="u1" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('ofrece reintentar', () => {
    apartar(2, 'u1')
    render(<AvisoSinSincronizar usuarioId="u1" />)
    expect(screen.getByRole('button', { name: 'Intentar de nuevo' })).toBeEnabled()
  })
})
