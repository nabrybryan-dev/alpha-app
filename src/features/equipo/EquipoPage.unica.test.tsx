import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/dbInstance'
import { reiniciarDb } from '../../data/mockDb'
import { reiniciarFiltroParaPruebas } from './filtroSombreros'

/**
 * La parte de Equipo que trae el paso 10 de la maqueta 7: los tres sombreros, la ficha única
 * y la seguridad siempre visible. El resto de lo que hace Equipo (semáforo, bandejas,
 * capacidades que se retiran a mitad de sesión) sigue vigilado por `EquipoPage.test.tsx`.
 */

const estado = {
  rol: 'nutricionista' as 'nutricionista' | 'coach' | 'asesorado',
  capacidades: new Set<string>(['leer_entrenamiento']),
}

vi.mock('../../app/SessionProvider', () => {
  const sesion = () => ({
    usuario: { id: 'u-manuela', nombre: 'Manuela', rol: estado.rol, avatarIniciales: 'MA' },
    esNube: false,
    cambiarUsuario: () => {},
    cerrarSesion: () => {},
  })
  return { useSesion: sesion, useSesionOpcional: sesion }
})
vi.mock('./useCapacidadesVigentes', () => ({
  useCapacidadesVigentes: () => ({
    cargando: false,
    tiene: (c: string) => estado.capacidades.has(c),
  }),
}))
vi.mock('./usePorAprobar', () => ({
  usePorAprobar: () => ({
    primeros: { ok: true, n: 2 },
    renovados: { ok: true, n: 1 },
    reintentar: () => {},
  }),
}))

const { default: EquipoPage } = await import('./EquipoPage')

function pintar() {
  return render(
    <MemoryRouter initialEntries={['/equipo']}>
      <Routes>
        <Route path="/equipo" element={<EquipoPage />} />
        <Route path="/" element={<p>Portada</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Equipo: sombreros, ficha única y seguridad', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    reiniciarDb()
    reiniciarFiltroParaPruebas()
    estado.rol = 'nutricionista'
    estado.capacidades = new Set(['leer_entrenamiento'])
  })

  it('la cartera lleva a la ficha única /equipo/:id', async () => {
    pintar()
    const cartera = await screen.findByRole('region', { name: 'Cartera' })
    const enlace = cartera.querySelector('a[aria-label^="Entrenamiento de "]')!
    expect(enlace.getAttribute('href')).toMatch(/^\/equipo\/u-/)
  })

  it('los chips cuentan lo que de verdad pide trabajo: atención y firmas', async () => {
    pintar()
    await screen.findByRole('region', { name: 'Por aprobar' })
    expect(screen.getByRole('button', { name: /^Entreno/ })).not.toHaveAttribute('aria-label', /, 0 pendientes/)
    expect(screen.getByRole('button', { name: /^Nutrición, 3 pendientes/ })).toBeInTheDocument()
  })

  it('el sombrero de Nutrición deja las firmas y esconde la cartera', async () => {
    const usuario = userEvent.setup()
    pintar()
    await screen.findByRole('region', { name: 'Cartera' })
    await usuario.click(screen.getByRole('button', { name: /^Nutrición/ }))
    expect(screen.getByRole('region', { name: 'Por aprobar' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Cartera' })).not.toBeInTheDocument()
  })

  it('el sombrero de Administración no deja el trabajo en un callejón: lleva a Empresa', async () => {
    const usuario = userEvent.setup()
    pintar()
    await screen.findByRole('region', { name: 'Cartera' })
    await usuario.click(screen.getByRole('button', { name: /^Administración/ }))
    expect(screen.getByRole('link', { name: /Ir a Empresa/ })).toHaveAttribute('href', '/empresa')
    expect(screen.queryByRole('region', { name: 'Cartera' })).not.toBeInTheDocument()
  })

  it('la seguridad sale con el filtro de Nutrición puesto y lleva a la ficha', async () => {
    db.bienestar.guardar({
      id: 'ck-alarma-equipo',
      usuarioId: 'u-mateo',
      fecha: '2099-01-01',
      dolor: 8,
      dolorDonde: 'lumbar',
      entreno: 'Descanso',
    })
    const usuario = userEvent.setup()
    pintar()
    await screen.findByRole('region', { name: 'Cartera' })
    await usuario.click(screen.getByRole('button', { name: /^Nutrición/ }))
    const seguridad = screen.getByRole('region', { name: 'Seguridad' })
    expect(seguridad).toHaveTextContent('Mateo')
    expect(seguridad).toHaveTextContent('Dolor 8/10 · lumbar')
    expect(screen.getByRole('link', { name: 'Abrir su ficha' })).toHaveAttribute('href', '/equipo/u-mateo')
  })
})
