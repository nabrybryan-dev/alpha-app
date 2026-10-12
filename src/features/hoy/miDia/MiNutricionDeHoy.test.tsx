/**
 * «Mi nutrición de hoy» (E-10 de la revisión de Codex del 28-sep): la tarjeta DICE qué meta
 * usa. Desde la revisión del 9-oct el tipo de día sale del plan y de la fecha
 * (`tipoDiaDeLaFecha`), el MISMO que el diario: antes la tarjeta fijaba ALTO y, un jueves de
 * día bajo, mostraba una meta distinta de la del diario. Con los datos ficticios del seed.
 */
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, hoyIso } from '../../../data/dbInstance'
import type { PlanNutricional } from '../../../domain/types'
import { reiniciarDb } from '../../../data/mockDb'
import MiNutricionDeHoy from './MiNutricionDeHoy'

beforeEach(() => {
  localStorage.clear()
  reiniciarDb()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** El plan del seed, con las kcal de ALTO y de BAJO distintas y el día de `hoy` nombrado en el menú de `tipo`. */
function planConHoyEn(tipo: 'ALTO' | 'BAJO', hoy: string): PlanNutricional {
  const base = db.nutricion.planByUsuario('u-valentina') as PlanNutricional
  const [a, m, d] = hoy.split('-').map(Number)
  const nombreDia = DIAS_ES[new Date(a, m - 1, d).getDay()]
  return {
    ...base,
    macrosPorDia: {
      ...base.macrosPorDia,
      ALTO: { ...base.macrosPorDia.ALTO, kcal: 2400 },
      BAJO: { ...base.macrosPorDia.BAJO, kcal: 1700 },
    },
    etiquetasDia: { ...base.etiquetasDia, ALTO: 'DÍA ALTO', BAJO: 'DÍA BAJO' },
    menus: base.menus.map((menu) =>
      menu.tipoDia === tipo ? { ...menu, nombre: `Día ${tipo} · ${nombreDia}` } : { ...menu, nombre: `Menú ${menu.tipoDia}` },
    ),
  }
}

describe('MiNutricionDeHoy', () => {
  it('si el plan no dice qué tipo de día es hoy, mide contra ALTO y lo dice', () => {
    render(
      <MemoryRouter>
        <MiNutricionDeHoy usuarioId="u-valentina" hoy={hoyIso()} />
      </MemoryRouter>,
    )
    const tarjeta = screen.getByRole('region', { name: 'Mi nutrición de hoy' })
    expect(within(tarjeta).getByText(/Meta de hoy \(.*ALTO.*\)/)).toBeInTheDocument()
  })

  it('un día que el plan marca como BAJO se mide contra la meta BAJA, no contra la ALTA', () => {
    const hoy = hoyIso()
    vi.spyOn(db.nutricion, 'planByUsuario').mockReturnValue(planConHoyEn('BAJO', hoy))
    render(
      <MemoryRouter>
        <MiNutricionDeHoy usuarioId="u-valentina" hoy={hoy} />
      </MemoryRouter>,
    )
    const tarjeta = screen.getByRole('region', { name: 'Mi nutrición de hoy' })
    expect(within(tarjeta).getByText(/Meta de hoy \(DÍA BAJO\)/)).toBeInTheDocument()
    expect(tarjeta.textContent).toContain('1.700 kcal')
    expect(tarjeta.textContent).not.toContain('2.400')
  })

  it('un día que el plan marca como ALTO se mide contra la meta ALTA', () => {
    const hoy = hoyIso()
    vi.spyOn(db.nutricion, 'planByUsuario').mockReturnValue(planConHoyEn('ALTO', hoy))
    render(
      <MemoryRouter>
        <MiNutricionDeHoy usuarioId="u-valentina" hoy={hoy} />
      </MemoryRouter>,
    )
    const tarjeta = screen.getByRole('region', { name: 'Mi nutrición de hoy' })
    expect(tarjeta.textContent).toContain('2.400 kcal')
  })

  it('sin plan no inventa una meta', () => {
    render(
      <MemoryRouter>
        <MiNutricionDeHoy usuarioId="u-nadie" hoy={hoyIso()} />
      </MemoryRouter>,
    )
    expect(screen.queryByText(/Meta del día/)).not.toBeInTheDocument()
  })
})
