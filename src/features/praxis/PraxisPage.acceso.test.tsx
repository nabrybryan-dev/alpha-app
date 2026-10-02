import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Rol } from '../../domain/types'

/**
 * La ruta /praxis ya usa datos reales, y sigue siendo SOLO para el staff: el interruptor no
 * se tocó. Se sustituye la sesión en su capa más baja para probar la guarda real de
 * `PraxisPage`, y la escena por un rótulo: aquí se prueba la puerta, no el cosmos.
 *
 * El rótulo dice con qué se montó la escena. Tiene que ser SIEMPRE con la conexión de la
 * persona con sesión: si un día alguien quita la conexión, la ruta volvería a enseñar los
 * datos de ejemplo de la maqueta como si fueran de alguien.
 */
const estado = { rol: 'asesorado' as Rol }

vi.mock('../../app/SessionProvider', () => ({
  useSesion: () => ({
    usuario: { id: 'u-prueba', nombre: 'Prueba', rol: estado.rol, avatarIniciales: 'PR' },
    esNube: false,
    cambiarUsuario: () => {},
    cerrarSesion: () => {},
  }),
  useSesionOpcional: () => null,
}))

vi.mock('./PraxisCosmos', () => ({
  PraxisCosmos: ({ trato, conexion }: { trato: string; conexion?: { usuarioId: string; irAlFormulario: unknown } | null }) => (
    <p>
      Escena de Praxis en {trato} · {conexion ? `conectada a ${conexion.usuarioId}` : 'EJEMPLO'} · {conexion?.irAlFormulario ? 'con formulario' : 'sin formulario'}
    </p>
  ),
}))

const { default: PraxisPage } = await import('./PraxisPage')

function en(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/" element={<p>Portada</p>} />
        <Route path="/praxis" element={<PraxisPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PraxisPage · solo staff', () => {
  afterEach(() => {
    estado.rol = 'asesorado'
  })

  it('un asesorado NO ve la ruta: vuelve a la portada', () => {
    en('/praxis')
    expect(screen.getByText('Portada')).toBeInTheDocument()
    expect(screen.queryByText(/Escena de Praxis/)).not.toBeInTheDocument()
  })

  it('el coach la ve, conectada a SU sesión y sin formulario (el coach no llena check-in)', () => {
    estado.rol = 'coach'
    en('/praxis')
    expect(screen.getByText('Escena de Praxis en tu · conectada a u-prueba · sin formulario')).toBeInTheDocument()
  })

  it('la nutricionista la ve, conectada a su sesión y con su formulario', () => {
    estado.rol = 'nutricionista'
    en('/praxis')
    expect(screen.getByText('Escena de Praxis en tu · conectada a u-prueba · con formulario')).toBeInTheDocument()
  })

  it('nunca se monta la escena de ejemplo', () => {
    for (const rol of ['coach', 'nutricionista'] as Rol[]) {
      estado.rol = rol
      const { unmount } = en('/praxis')
      expect(screen.queryByText(/EJEMPLO/)).not.toBeInTheDocument()
      unmount()
    }
  })

  it('?trato=usted pasa el trato a la escena', () => {
    estado.rol = 'coach'
    en('/praxis?trato=usted')
    expect(screen.getByText(/^Escena de Praxis en usted · conectada/)).toBeInTheDocument()
  })

  it('un asesorado tampoco entra con ?trato=usted ni con otro parámetro', () => {
    en('/praxis?trato=usted&staff=1')
    expect(screen.getByText('Portada')).toBeInTheDocument()
  })
})
