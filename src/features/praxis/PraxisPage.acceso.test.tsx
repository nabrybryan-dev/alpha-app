import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Rol } from '../../domain/types'

/**
 * La ruta /praxis está publicada, pero con datos de EJEMPLO: solo la ve el staff. Se
 * sustituye la sesión en su capa más baja para probar la guarda real de `PraxisPage`, y
 * la escena por un rótulo: aquí se prueba la puerta, no el cosmos.
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
  PraxisCosmos: ({ trato }: { trato: string }) => <p>Escena de Praxis en {trato}</p>,
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

  it('el coach la ve', () => {
    estado.rol = 'coach'
    en('/praxis')
    expect(screen.getByText('Escena de Praxis en tu')).toBeInTheDocument()
  })

  it('la nutricionista la ve', () => {
    estado.rol = 'nutricionista'
    en('/praxis')
    expect(screen.getByText('Escena de Praxis en tu')).toBeInTheDocument()
  })

  it('?trato=usted pasa el trato a la escena', () => {
    estado.rol = 'coach'
    en('/praxis?trato=usted')
    expect(screen.getByText('Escena de Praxis en usted')).toBeInTheDocument()
  })

  it('un asesorado tampoco entra con ?trato=usted ni con otro parámetro', () => {
    en('/praxis?trato=usted&staff=1')
    expect(screen.getByText('Portada')).toBeInTheDocument()
  })
})
