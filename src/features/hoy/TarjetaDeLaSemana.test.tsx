/**
 * La tarjeta enseña la promesa, no un cero.
 *
 * Es la regla que decidió Bryan el 10-sep: la primera semana nadie tiene siete
 * noches registradas, y un «0 de 100» en regularidad del sueño se lee como una
 * acusación por algo que nadie midió. Lo honesto es decir cuánto falta.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ResumenSemanal } from '../../domain/resumenSemanal/calcular'
import { TarjetaDeLaSemana } from './TarjetaDeLaSemana'

const BASE: ResumenSemanal = {
  sesionesHechas: 4,
  sesionesPautadas: 5,
  adherenciaPct: 82,
  checkinsDeLaSemana: 5,
  regularidad: { estado: 'sin-datos', nochesConDato: 3, motivo: 'llevas 3 de 7 noches registradas' },
}

describe('la tarjeta de la semana', () => {
  afterEach(cleanup)

  it('sin las siete noches, promete en vez de puntuar', () => {
    render(<TarjetaDeLaSemana nombre="Valentina" resumen={BASE} />)
    expect(screen.getByText(/llevas 3 de 7 noches registradas/)).toBeInTheDocument()
    expect(screen.queryByText('0 de 100')).not.toBeInTheDocument()
  })

  it('con las noches puestas, enseña el número y sobre cuántas sale', () => {
    render(
      <TarjetaDeLaSemana
        nombre="Valentina"
        resumen={{
          ...BASE,
          regularidad: { estado: 'medido', indice: 78, nochesConDato: 9, diasComparados: 7 },
        }}
      />,
    )
    expect(screen.getByText('78 de 100')).toBeInTheDocument()
    expect(screen.getByText(/sobre 9 noches/)).toBeInTheDocument()
  })

  it('lo que no se registró sale como raya, no como cero', () => {
    render(
      <TarjetaDeLaSemana nombre="Valentina" resumen={{ ...BASE, adherenciaPct: undefined }} />,
    )
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText(/sin registro esta semana/)).toBeInTheDocument()
  })

  it('cuenta las sesiones hechas contra las pautadas, y avisa si no hay plan', () => {
    render(<TarjetaDeLaSemana nombre="Valentina" resumen={BASE} />)
    expect(screen.getByText('4 de 5')).toBeInTheDocument()

    cleanup()
    render(
      <TarjetaDeLaSemana
        nombre="Valentina"
        resumen={{ ...BASE, sesionesHechas: 0, sesionesPautadas: 0 }}
      />,
    )
    expect(screen.getByText(/todavía no tienes microciclo activo/)).toBeInTheDocument()
  })

  it('no reparte adjetivos sobre la semana de nadie', () => {
    const { container } = render(<TarjetaDeLaSemana nombre="Valentina" resumen={BASE} />)
    const texto = (container.textContent ?? '').toLowerCase()
    expect(texto).not.toMatch(/\b(bien|mal|buena|mala|excelente|flojo|floja)\b/)
  })
})
