import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VistaSemana } from './VistaSemana'
import type { ResumenSemana } from '../../domain/nutricion/semanaResumen'

const FECHAS = [
  '2026-07-27',
  '2026-07-28',
  '2026-07-29',
  '2026-07-30',
  '2026-07-31',
  '2026-08-01',
  '2026-08-02',
]

const META = { kcal: 2100, proteinaG: 115, carbosG: 240, grasaG: 62 }

const resumen = (registrados: number[]): ResumenSemana => {
  const dias = FECHAS.map((fecha, i) => ({
    fecha,
    kcal: registrados.includes(i) ? 1900 : 0,
    proteinaG: registrados.includes(i) ? 110 : 0,
    registrado: registrados.includes(i),
  }))
  return {
    dias,
    diasRegistrados: registrados.length,
    promedioKcal: registrados.length ? 1900 : 0,
    promedioProteinaG: registrados.length ? 110 : 0,
    contraPauta: registrados.length ? 1900 - 2100 : 0,
    comidasRegistradas: registrados.length * 3,
  }
}

const pintar = (registrados: number[]) => {
  const onElegirDia = vi.fn()
  render(
    <VistaSemana
      resumen={resumen(registrados)}
      meta={META}
      onVolver={vi.fn()}
      onElegirDia={onElegirDia}
    />,
  )
  return { onElegirDia }
}

describe('VistaSemana', () => {
  it('enseña el promedio de lo registrado', () => {
    pintar([0, 1, 2])
    expect(screen.getByText('1.900')).toBeInTheDocument()
  })

  it('dice sobre cuántos días es esa media', () => {
    // Un promedio de dos días y uno de siete no se leen igual, y sin el número
    // parecen lo mismo.
    pintar([0, 1])
    expect(screen.getByText(/sobre 2 días anotados/i)).toBeInTheDocument()
  })

  it('un solo día se dice en singular', () => {
    pintar([0])
    expect(screen.getByText(/sobre 1 día anotado/i)).toBeInTheDocument()
  })

  it('marca la diferencia contra la pauta', () => {
    pintar([0])
    expect(screen.getByText('-200')).toBeInTheDocument()
  })

  it('avisa de los días que faltan por anotar', () => {
    pintar([0, 1, 2])
    expect(screen.getByText(/faltan/i)).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('con la semana completa no molesta con el aviso', () => {
    pintar([0, 1, 2, 3, 4, 5, 6])
    expect(screen.queryByText(/todavía no dice cómo fue la semana/i)).not.toBeInTheDocument()
  })

  describe('los días sin registro', () => {
    it('se distinguen de un día de cero calorías', () => {
      pintar([0])
      expect(screen.getByRole('button', { name: /2026-07-28: sin registrar/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /2026-07-27: 1900 kcal/i })).toBeInTheDocument()
    })
  })

  it('tocar un día lleva a ese día', async () => {
    const { onElegirDia } = pintar([0])
    await userEvent.click(screen.getByRole('button', { name: /2026-07-29/ }))
    expect(onElegirDia).toHaveBeenCalledWith('2026-07-29')
  })

  describe('una semana en blanco', () => {
    it('no enseña un promedio de cero, explica que falta registrar', () => {
      // Un "0 kcal de promedio" leería como si hubiera ayunado toda la semana.
      pintar([])
      expect(screen.getByText(/no has anotado nada todavía/i)).toBeInTheDocument()
      expect(screen.queryByText(/promedio registrado/i)).not.toBeInTheDocument()
    })
  })
})
