import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DiarioDia from './DiarioDia'
import { CompuertaNutricion } from './CompuertaNutricion'
import { SessionProvider } from '../../app/SessionProvider'
import { reiniciarDb } from '../../data/mockDb'
import { db } from '../../data/dbInstance'

/**
 * Fallo vivo desde el 22-sep: un plan sin los macros del tipo de día hacía
 * reventar el diario («T.kcal» indefinido). Ahora dice la verdad, sin cifras.
 */
const pintar = () =>
  render(
    <MemoryRouter>
      <SessionProvider>
        <CompuertaNutricion>
          <DiarioDia />
        </CompuertaNutricion>
      </SessionProvider>
    </MemoryRouter>,
  )

const conPlan = (cambio: (plan: Record<string, unknown>) => void) => {
  const original = db.nutricion.planByUsuario.bind(db.nutricion)
  vi.spyOn(db.nutricion, 'planByUsuario').mockImplementation((id: string) => {
    const plan = original(id)
    if (!plan) return plan
    const copia = structuredClone(plan) as unknown as Record<string, unknown>
    cambio(copia)
    return copia as never
  })
}

describe('DiarioDia con un plan sin macros del tipo de día', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarDb()
  })
  afterEach(() => vi.restoreAllMocks())

  it('no revienta si macrosPorDia no trae el tipo pedido', () => {
    conPlan((p) => {
      p.macrosPorDia = { BAJO: { kcal: 1, proteinaG: 1, carbosG: 1, grasaG: 1 } }
    })
    pintar()
    expect(screen.getByRole('alert')).toHaveTextContent(/avísale a tu coach/i)
  })

  it('no revienta si el plan no trae macrosPorDia', () => {
    conPlan((p) => {
      delete p.macrosPorDia
    })
    pintar()
    expect(screen.getByRole('alert')).toHaveTextContent(/no trae los macros/i)
  })
})
