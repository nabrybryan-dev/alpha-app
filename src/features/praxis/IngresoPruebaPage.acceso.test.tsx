import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Rol } from '../../domain/types'

/**
 * /praxis/ingreso-prueba: la prueba con cronómetro del ingreso es SOLO para el equipo, con el MISMO interruptor que
 * /praxis. Aquí se prueba la puerta (la sesión se sustituye en su capa más baja y la pantalla por un rótulo): un
 * asesorado vuelve a su portada sin que la pantalla llegue a montarse.
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

vi.mock('./ingreso/IngresoPrueba', () => ({
  IngresoPrueba: ({ trato, salida }: { trato: string; salida: string }) => <p>Prueba de ingreso en {trato} · salida {salida}</p>,
}))

const { default: IngresoPruebaPage } = await import('./IngresoPruebaPage')

function en(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/" element={<p>Portada</p>} />
        <Route path="/praxis/ingreso-prueba" element={<IngresoPruebaPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('IngresoPruebaPage · solo staff', () => {
  afterEach(() => {
    estado.rol = 'asesorado'
  })

  it('un asesorado NO ve la ruta: vuelve a la portada y la pantalla no se monta', () => {
    en('/praxis/ingreso-prueba')
    expect(screen.getByText('Portada')).toBeInTheDocument()
    expect(screen.queryByText(/Prueba de ingreso/)).not.toBeInTheDocument()
  })

  it('un asesorado tampoco entra con ?trato=usted ni con otro parámetro', () => {
    en('/praxis/ingreso-prueba?trato=usted&staff=1')
    expect(screen.getByText('Portada')).toBeInTheDocument()
    expect(screen.queryByText(/Prueba de ingreso/)).not.toBeInTheDocument()
  })

  it('el coach la ve y «Salir» lo lleva a su panel', () => {
    estado.rol = 'coach'
    en('/praxis/ingreso-prueba')
    expect(screen.getByText('Prueba de ingreso en tu · salida /coach')).toBeInTheDocument()
  })

  it('la nutricionista la ve y «Salir» la lleva a la portada', () => {
    estado.rol = 'nutricionista'
    en('/praxis/ingreso-prueba')
    expect(screen.getByText('Prueba de ingreso en tu · salida /')).toBeInTheDocument()
  })

  it('?trato=usted pasa el trato a la pantalla', () => {
    estado.rol = 'coach'
    en('/praxis/ingreso-prueba?trato=usted')
    expect(screen.getByText(/^Prueba de ingreso en usted/)).toBeInTheDocument()
  })
})
