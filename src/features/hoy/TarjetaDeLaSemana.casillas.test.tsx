import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ResumenSemanal } from '../../domain/resumenSemanal/calcular'
import { TarjetaDeLaSemana } from './TarjetaDeLaSemana'

/**
 * La revisión de la semana de «Alpha · Rediseño» (maqueta 7, `salida.html:1309-1322`): tres casillas hundidas con cifra en
 * relieve (sesiones, nutrición, sueño) en vez de cuatro filas de texto. Solo con el diseño final; las demás cuentas
 * conservan las filas de siempre. Sigue valiendo la regla de la pieza: hechos sin adjetivos y, si falta un dato, la
 * promesa en vez de un cero.
 */
const base = {
  sesionesHechas: 3,
  sesionesPautadas: 5,
  adherenciaPct: 86,
  checkinsDeLaSemana: 4,
  regularidad: { estado: 'medido', indice: 78, nochesConDato: 6, diasComparados: 5 },
} as unknown as ResumenSemanal

const pintar = (resumen: ResumenSemanal, disenoFinal: boolean) =>
  render(<TarjetaDeLaSemana nombre="Valentina" resumen={resumen} diseno="nuevo" disenoFinal={disenoFinal} />)

describe('la tarjeta de la semana con casillas', () => {
  it('tres casillas hundidas con la cifra de cada cosa, y la lectura entera para el lector de pantalla', () => {
    pintar(base, true)
    expect(document.querySelectorAll('.hoy-cifra-hundida')).toHaveLength(3)
    expect(screen.getByText('3 de 5 sesiones hechas')).toBeInTheDocument()
    expect(screen.getByText('86 % de nutrición cumplida')).toBeInTheDocument()
    expect(screen.getByText('78 de 100 en regularidad del sueño')).toBeInTheDocument()
  })

  it('sin dato no hay cero: raya y la promesa', () => {
    const sinDato = {
      ...base,
      adherenciaPct: undefined,
      regularidad: { estado: 'sin-datos', nochesConDato: 3, motivo: 'llevas 3 de 7 noches' },
    } as unknown as ResumenSemanal
    pintar(sinDato, true)
    expect(screen.getByText('nutrición sin registro esta semana')).toBeInTheDocument()
    expect(screen.getByText(/llevas 3 de 7 noches; cuando estén, esto ya es un número/)).toBeInTheDocument()
  })

  it('sin microciclo activo la cifra de sesiones es una raya y lo dice', () => {
    pintar({ ...base, sesionesHechas: 0, sesionesPautadas: 0 } as unknown as ResumenSemanal, true)
    expect(screen.getByText(/todavía no tienes microciclo activo/)).toBeInTheDocument()
  })

  it('sin el diseño final quedan las filas de siempre', () => {
    pintar(base, false)
    expect(document.querySelectorAll('.hoy-cifra-hundida')).toHaveLength(0)
    expect(screen.getByText('Sesiones')).toBeInTheDocument()
    expect(screen.getByText('Check-ins')).toBeInTheDocument()
  })
})
