import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PresentacionSemanal } from './PresentacionSemanal'
import type { ResumenSemanalParaPresentar } from '../../domain/resumenSemanalParaPresentar'

const BASE: ResumenSemanalParaPresentar = {
  microcicloNumero: 8,
  sesiones: { registradas: 3, totales: 4 },
  horasSuenoPromedio: 7.2,
  adherenciaNutricionPct: 86,
  pesoKg: 58.4,
  pesoDelta: { kg: -0.3, dias: 14 },
}

// Las cifras son `Cifra3D`: la que se VE cuenta hasta su valor y va oculta al lector de
// pantalla, que oye la etiqueta entera. Las pruebas leen lo que oye la persona.

describe('PresentacionSemanal', () => {
  it('sin microciclo, lo dice en vez de enseñar números a medias', () => {
    render(<PresentacionSemanal resumen={undefined} />)
    expect(screen.getByText(/no hay semana que presentar/)).toBeInTheDocument()
  })

  it('pinta solo lo que el resumen trae — sesiones, sueño, alimentación y peso con su delta', () => {
    render(<PresentacionSemanal resumen={BASE} />)
    expect(screen.getByText('Semana 8')).toBeInTheDocument()
    expect(screen.getByText('3 de 4 sesiones')).toBeInTheDocument()
    expect(screen.getByText('7,2 horas de sueño por noche')).toBeInTheDocument()
    expect(screen.getByText('86 % de tu alimentación cumplida')).toBeInTheDocument()
    expect(screen.getByText('58,4 kilos')).toBeInTheDocument()
    expect(screen.getByText('kg · -0,3 en 14 días')).toBeInTheDocument()
  })

  it('sin un dato (p. ej. sin medida de peso), esa tarjeta no se pinta — no inventa un número', () => {
    render(
      <PresentacionSemanal resumen={{ ...BASE, pesoKg: undefined, pesoDelta: undefined, horasSuenoPromedio: undefined }} />,
    )
    expect(screen.queryByText(/kilos/)).toBeNull()
    expect(screen.queryByText(/horas de sueño/)).toBeNull()
    expect(screen.getByText('3 de 4 sesiones')).toBeInTheDocument()
  })

  it('con las sesiones incompletas, el número se marca en rojo — y completas, no', () => {
    const { container, rerender } = render(<PresentacionSemanal resumen={BASE} />)
    expect(container.querySelector('.cifra-3d')).toHaveClass('cifra-3d-rojo')

    rerender(<PresentacionSemanal resumen={{ ...BASE, sesiones: { registradas: 4, totales: 4 } }} />)
    expect(container.querySelector('.cifra-3d')).not.toHaveClass('cifra-3d-rojo')
  })

  it('una semana sin sesiones pautadas lo dice', () => {
    render(<PresentacionSemanal resumen={{ ...BASE, sesiones: { registradas: 0, totales: 0 } }} />)
    expect(screen.getByText('Esta semana no trae sesiones pautadas.')).toBeInTheDocument()
  })
})
