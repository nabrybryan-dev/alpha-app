/**
 * El gasto por pasos (NEAT) en «Tu bloque actual».
 *
 * ROJO A PROPÓSITO (2026-08-30). La tarjeta ya pintaba la meta de pasos
 * (`pasosObjetivo`), pero no lo que esos pasos GASTAN. Y para una asesorada cuya
 * fase es «Mantenimiento → déficit por NEAT», el número que decide la estrategia
 * no es cuántos pasos da: es cuántas kcal salen de darlos.
 *
 * Medido ese día sobre sus check-ins reales: a 7.250 pasos el NEAT son ~150
 * kcal/día, y a 15.000 son ~310. Sin ese segundo número, «sube los pasos» es una
 * orden sin magnitud, y nadie puede ver que el salto vale 1.120 kcal a la semana.
 *
 * REGLA QUE NO SE ROMPE: es una estimación por fórmula, no una medida de
 * acelerómetro. Se pinta marcada como estimada, y si no hay dato no se pinta
 * nada — la doctrina de esta tarjeta desde que existe.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Perfil } from '../../domain/types'
import { BloqueActual } from './BloqueActual'

function perfilBase(extra: Partial<Perfil> = {}): Perfil {
  return {
    usuarioId: 'u-prueba',
    objetivos: '',
    edad: 30,
    diasEntrenamiento: 5,
    tiempoSesionMin: 60,
    somatotipo: 'mesomorfo',
    volumenSemanal: {},
    medidas: [],
    ...extra,
  }
}

describe('BloqueActual — gasto por pasos', () => {
  it('pinta el NEAT de hoy y el de la meta cuando el perfil los trae', () => {
    render(
      <BloqueActual
        perfil={perfilBase({
          pasosObjetivo: 15000,
          neat: { kcalDia: 150, kcalDiaEnMeta: 310 },
        })}
      />,
    )

    expect(screen.getByText(/Gasto por pasos/i)).toBeTruthy()
    expect(screen.getByText(/150.*310 kcal\/día/)).toBeTruthy()
  })

  it('lo marca como estimado, porque sale de una fórmula y no de un acelerómetro', () => {
    render(<BloqueActual perfil={perfilBase({ neat: { kcalDia: 150, kcalDiaEnMeta: 310 } })} />)

    expect(screen.getByText(/estimado/i)).toBeTruthy()
  })

  it('con solo el gasto de hoy, no inventa el de la meta', () => {
    render(<BloqueActual perfil={perfilBase({ neat: { kcalDia: 150 } })} />)

    expect(screen.getByText(/150 kcal\/día/)).toBeTruthy()
    expect(screen.queryByText(/310/)).toBeNull()
  })

  it('sin dato de NEAT no pinta la fila', () => {
    render(<BloqueActual perfil={perfilBase({ pasosObjetivo: 15000 })} />)

    expect(screen.queryByText(/Gasto por pasos/i)).toBeNull()
  })
})
