/**
 * En el espacio «Nutrición» de Manuela (maqueta «Espacios de Alpha», 28-sep) viven las dos
 * bandejas de aprobación de la consola, sin cambiar su lógica: cada una aparece con su
 * capacidad y lee lo que lee en la consola.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { reiniciarDb } from '../../data/mockDb'

const estado = { capacidades: new Set<string>() }

vi.mock('../coach/consola/useCapacidades', () => ({
  useCapacidades: () => ({ cargando: false, tiene: (c: string) => estado.capacidades.has(c), usuarioId: 'u-bryan' }),
}))

vi.mock('../../data/consola/primerosPlanes', async (original) => ({
  ...(await original<typeof import('../../data/consola/primerosPlanes')>()),
  primerosPlanesPendientes: () => Promise.resolve({ ok: true, datos: [] }),
}))

vi.mock('../../data/consola/planesRenovados', async (original) => ({
  ...(await original<typeof import('../../data/consola/planesRenovados')>()),
  planesRenovadosPendientes: () => Promise.resolve({ ok: true, datos: [] }),
}))

const { default: EquipoNutricionPage } = await import('./EquipoNutricionPage')

beforeEach(() => {
  localStorage.clear()
  reiniciarDb()
  localStorage.setItem('alpha-usuario', 'u-bryan')
  estado.capacidades = new Set()
})

const pintar = () =>
  render(
    <MemoryRouter>
      <SessionProvider>
        <EquipoNutricionPage />
      </SessionProvider>
    </MemoryRouter>,
  )

describe('EquipoNutricionPage · bandejas de aprobación', () => {
  it('con las dos capacidades aparecen las dos bandejas, con su estado vacío', async () => {
    estado.capacidades = new Set(['aprobar_primer_plan', 'aprobar_plan_estrategico'])
    pintar()
    expect(screen.getByText('Primeros planes por aprobar')).toBeInTheDocument()
    expect(screen.getByText('Planes estratégicos por aprobar')).toBeInTheDocument()
    expect(await screen.findByText(/No hay primeros planes esperando/)).toBeInTheDocument()
  })

  it('con una sola, solo esa', () => {
    estado.capacidades = new Set(['aprobar_primer_plan'])
    pintar()
    expect(screen.getByText('Primeros planes por aprobar')).toBeInTheDocument()
    expect(screen.queryByText('Planes estratégicos por aprobar')).not.toBeInTheDocument()
  })
})
