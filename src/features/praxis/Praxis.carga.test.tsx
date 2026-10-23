import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Rol } from '../../domain/types'

/**
 * Mientras se consultan los permisos, las tres pantallas de Praxis NO deciden (ni echan a la cuenta personal de
 * Bryan antes de saber su puesto) y NO se quedan en blanco: dicen que están comprobando el acceso.
 */
const estado = { rol: 'asesorado' as Rol, cargando: true, capacidades: new Set<string>() }

vi.mock('../../app/SessionProvider', () => ({
  useSesion: () => ({ usuario: { id: 'u-1', nombre: 'Persona', rol: estado.rol, avatarIniciales: 'PE' }, esNube: false }),
  useSesionOpcional: () => null,
}))
vi.mock('../coach/consola/useCapacidades', () => ({
  useCapacidades: () => ({ cargando: estado.cargando, tiene: (c: string) => estado.capacidades.has(c), usuarioId: 'u-1' }),
}))
vi.mock('./PraxisCosmos', () => ({ PraxisCosmos: () => <p>Escena de Praxis</p> }))
vi.mock('./conexionReal', () => ({ crearConexionPraxis: () => ({}) }))
vi.mock('./ingreso/IngresoPrueba', () => ({ IngresoPrueba: () => <p>Escena de Praxis</p> }))

const { default: PraxisPage } = await import('./PraxisPage')
const { default: PraxisEjemploPage } = await import('./PraxisEjemploPage')
const { default: IngresoPruebaPage } = await import('./IngresoPruebaPage')

const PANTALLAS = [
  ['/praxis', PraxisPage],
  ['/praxis/ejemplo', PraxisEjemploPage],
  ['/praxis/ingreso-prueba', IngresoPruebaPage],
] as const

function en(ruta: string, Pantalla: (typeof PANTALLAS)[number][1]) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/" element={<p>Portada</p>} />
        <Route path={ruta} element={<Pantalla />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  estado.rol = 'asesorado'
  estado.cargando = true
  estado.capacidades = new Set()
})

describe.each(PANTALLAS)('%s mientras cargan los permisos', (ruta, Pantalla) => {
  it('muestra «Comprobando tu acceso…»: ni blanco ni redirección', () => {
    estado.capacidades = new Set(['puesto_de_coach'])
    en(ruta, Pantalla)
    expect(screen.getByRole('status')).toHaveTextContent('Comprobando tu acceso')
    expect(screen.queryByText('Portada')).toBeNull()
    expect(screen.queryByText('Escena de Praxis')).toBeNull()
  })

  it('al llegar los permisos, la cuenta con puesto entra y el asesorado vuelve a la portada', () => {
    estado.cargando = false
    estado.capacidades = new Set(['puesto_de_coach'])
    const a = en(ruta, Pantalla)
    expect(screen.getByText('Escena de Praxis')).toBeInTheDocument()
    a.unmount()
    estado.capacidades = new Set()
    en(ruta, Pantalla)
    expect(screen.getByText('Portada')).toBeInTheDocument()
  })
})
