import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TablaTanda } from './TablaTanda'
import type { Medicion } from './tanda'

function toma(p: Partial<Medicion> = {}): Medicion {
  return {
    fecha: '2026-08-25T18:42:00.000Z',
    modo: 'serie',
    ejercicio: 'PESO MUERTO CONVENCIONAL',
    cargaKg: 100,
    repsReales: 5,
    repsDetectadas: 5,
    vPrimera: 0.72,
    vUltima: 0.51,
    pvPct: 29.2,
    fpsReal: 58.4,
    unidad: 'm/s',
    calidad: 'buena',
    motivos: '',
    ...p,
  } as Medicion
}

describe('R/D, que es la columna que existe para esto', () => {
  it('cuando cuadran, la celda se queda callada', () => {
    const { container } = render(<TablaTanda filas={[toma()]} />)
    const celda = Array.from(container.querySelectorAll("td")).find((td) => td.textContent === '5/5')
    expect(celda?.className).toMatch(/text-tenue/)
    expect(celda?.className).not.toMatch(/font-bold/)
  })

  it('cuando NO cuadran, se enfatiza sin usar color', () => {
    // Una repetición fantasma da velocidades perfectamente razonables: si esta
    // columna no la señala, el fallo no se ve en ningún otro sitio. Y el énfasis
    // no puede ser de color, porque en el encoder el color no dice calidad.
    const { container } = render(<TablaTanda filas={[toma({ repsReales: 5, repsDetectadas: 6 })]} />)
    const celda = Array.from(container.querySelectorAll("td")).find((td) => td.textContent === '5/6')
    expect(celda?.className).toMatch(/font-bold/)
    expect(celda?.className).not.toMatch(/rojo|verde|ambar/)
  })

  it('sin cuenta de la persona no se inventa el acuerdo', () => {
    // `repsReales` las teclea quien entrena. Si no están, la celda no puede
    // decir que cuadra: diría que el instrumento se validó a sí mismo.
    render(<TablaTanda filas={[toma({ repsReales: undefined, repsDetectadas: 5 })]} />)
    expect(screen.getByText('—/5')).toBeInTheDocument()
  })
})

describe('una toma descartada tampoco enseña cifras en la tabla', () => {
  it('ni v₁ ni %PV, aunque el sitio quede vacío', () => {
    // En una tabla el número falso es MÁS fácil de apuntar, porque está alineado
    // con los que sí valen.
    const { container } = render(
      <TablaTanda filas={[toma({ calidad: 'descartada', vPrimera: 0.94, pvPct: 24.5 })]} />,
    )
    const texto = container.textContent ?? ''
    expect(texto).not.toContain('0.940')
    expect(texto).not.toContain('24.5')
  })

  it('pero los fps sí, que no dependen de la referencia', () => {
    render(<TablaTanda filas={[toma({ calidad: 'descartada', fpsReal: 58.4 })]} />)
    expect(screen.getByText('58')).toBeInTheDocument()
  })
})

describe('tanda vacía', () => {
  it('no finge una tabla: dice que los umbrales ya están escritos', () => {
    render(<TablaTanda filas={[]} />)
    expect(screen.getByText(/Los umbrales ya están escritos/)).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })
})
