import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { reiniciarDb } from '../mockDb'
import { db } from '../dbInstance'
import BandejaPage from '../../features/equipo/BandejaPage'
import CifrasAsesoradosPage from '../../features/nutri/CifrasAsesoradosPage'
import EquipoNutricionPage from '../../features/nutri/EquipoNutricionPage'
import MiPlanPage from '../../features/plan/MiPlanPage'

/**
 * H-12 del inventario: en el demo debe existir una nutricionista (ficticia) para poder
 * elegirla en «Ver la app como» y abrir sus pantallas sin base real.
 */
const pintar = (ruta: string, pantalla: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <SessionProvider>{pantalla}</SessionProvider>
    </MemoryRouter>,
  )

beforeEach(() => {
  localStorage.clear()
  reiniciarDb()
})

describe('nutricionista ficticia del demo', () => {
  it('está en la lista de usuarios con rol nutricionista y sin pasar por asesorados', () => {
    const n = db.usuarios.list().filter((u) => u.rol === 'nutricionista')
    expect(n).toHaveLength(1)
    expect(n[0].id).toBe('u-nutri-demo')
    expect(db.usuarios.asesorados().some((u) => u.id === 'u-nutri-demo')).toBe(false)
  })

  // /mi-plan: en demo no hay `capacidades_staff`, así que la pantalla carga y dice que falta el permiso
  // de organizar el plan (no hay datos de plan sin base real). Lo que se comprueba es que abre.
  it.each([
    ['/equipo-nutricion', <EquipoNutricionPage key="a" />, /Evaluación nutricional del equipo/],
    ['/equipo-nutricion/cifras', <CifrasAsesoradosPage key="b" />, /Qué cifras ve cada asesorado/],
    ['/mi-plan', <MiPlanPage key="c" />, /Pídeselo al coach/],
    ['/bandeja', <BandejaPage key="d" />, /Los tres sombreros, juntos/],
  ])('%s carga con ella como sesión', async (ruta, pantalla, texto) => {
    localStorage.setItem('alpha-usuario', 'u-nutri-demo')
    pintar(ruta, pantalla)
    expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.queryByText(/Algo salió mal|no existe/i)).toBeNull()
  })
})
