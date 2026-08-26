import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HistorialEncoder } from './HistorialEncoder'
import type { TomaDelHistorial } from './historial'

function toma(fecha: string, p: Partial<TomaDelHistorial> = {}): TomaDelHistorial {
  return { fecha, pvPct: 29.2, calidad: 'buena', cargaKg: 100, ...p }
}

/* Horas locales: la franja del día decide, y una fecha en UTC cambiaría de
 * franja según dónde corra el test. */
const L_MANANA = '2026-08-10T08:30:00'
const M_MANANA = '2026-08-17T08:45:00'
const M_TARDE = '2026-08-17T18:30:00'
const V_TARDE = '2026-08-24T18:30:00'

describe('el aviso de hora NO se presenta como un error', () => {
  const noComparable = [toma(L_MANANA), toma(M_TARDE)]

  it('el título habla de la comparación, no de la medida', () => {
    render(<HistorialEncoder tomas={noComparable} />)
    expect(screen.getByText('Estas dos no se comparan')).toBeInTheDocument()
  })

  it('y cierra diciendo que las dos medidas son buenas', () => {
    // Sin esta frase, la persona lee «no comparable» y repite una medición que
    // estaba bien. El problema es ponerlas una al lado de la otra, no medirlas.
    render(<HistorialEncoder tomas={noComparable} />)
    expect(screen.getByText(/Las dos medidas son buenas/)).toBeInTheDocument()
  })

  it('no usa la palabra error ni el rojo', () => {
    const { container } = render(<HistorialEncoder tomas={noComparable} />)
    expect(container.textContent).not.toMatch(/error/i)
    expect(container.innerHTML).not.toMatch(/--rojo|text-rojo|border-rojo/)
  })
})

describe('cuando no hay nada que decir, no se dice nada', () => {
  it('sin aviso no hay tarjeta, ni marco vacío, ni hueco', () => {
    const { container } = render(
      <HistorialEncoder tomas={[toma(L_MANANA), toma(M_MANANA)]} />,
    )
    expect(container.textContent).not.toMatch(/no se comparan|diferencia entre las dos/)
  })
})

describe('lo que entra en la gráfica', () => {
  it('una descartada no pinta punto', () => {
    const { container } = render(
      <HistorialEncoder
        tomas={[
          toma(L_MANANA),
          toma(M_MANANA),
          toma(M_TARDE, { calidad: 'descartada', pvPct: 24.5 }),
        ]}
      />,
    )
    expect(container.querySelectorAll('circle')).toHaveLength(2)
  })

  it('una dudosa pinta punto hueco y no entra en la línea', () => {
    // La línea es lo que la gente lee: si una toma con la escala en duda la
    // mueve, la tendencia dice algo que sus propios puntos no sostienen.
    const { container } = render(
      <HistorialEncoder
        tomas={[toma(L_MANANA), toma(M_MANANA), toma(V_TARDE, { calidad: 'dudosa' })]}
      />,
    )
    const circulos = Array.from(container.querySelectorAll('circle'))
    expect(circulos).toHaveLength(3)
    const huecos = circulos.filter((c) => c.getAttribute('fill') === 'none')
    expect(huecos).toHaveLength(1)

    // La línea une dos puntos, no tres: un solo segmento.
    const linea = container.querySelector('path')?.getAttribute('d') ?? ''
    expect(linea.match(/[ML] /g)).toHaveLength(2)
  })

  it('dice que solo entran las buenas, sin que haya que deducirlo', () => {
    render(<HistorialEncoder tomas={[toma(L_MANANA), toma(M_MANANA)]} />)
    expect(screen.getByText(/Solo tomas buenas/)).toBeInTheDocument()
  })
})

describe('sin tendencia', () => {
  it('con una sola toma buena no se dibuja una línea de un punto', () => {
    render(<HistorialEncoder tomas={[toma(L_MANANA)]} />)
    expect(screen.getByText(/Con una sola no hay tendencia/)).toBeInTheDocument()
  })

  it('y el vacío usa la misma placa que el resto de estados sin dato', () => {
    const { container } = render(<HistorialEncoder tomas={[]} />)
    expect(container.querySelector('svg')).toBeNull()
  })
})

describe('lo que el %PV obliga a enseñar', () => {
  it('la carga va pegada a cada punto', () => {
    // Dos puntos a la misma altura con distinta carga NO son estancamiento: son
    // el mismo esfuerzo con más peso. En una leyenda al pie eso no se lee.
    render(
      <HistorialEncoder
        tomas={[toma(L_MANANA, { cargaKg: 100 }), toma(M_MANANA, { cargaKg: 110 })]}
      />,
    )
    expect(screen.getByText('100 kg')).toBeInTheDocument()
    expect(screen.getByText('110 kg')).toBeInTheDocument()
  })

  it('avisa cuando la tendencia mezcla cargas, sin llamarlo problema', () => {
    render(
      <HistorialEncoder
        tomas={[toma(L_MANANA, { cargaKg: 100 }), toma(M_MANANA, { cargaKg: 110 })]}
      />,
    )
    expect(screen.getByText(/llegar al mismo %PV con más peso es progreso/i)).toBeInTheDocument()
  })

  it('y no dice nada cuando la carga no cambió', () => {
    render(<HistorialEncoder tomas={[toma(L_MANANA), toma(M_MANANA)]} />)
    expect(screen.queryByText(/mezcla cargas/i)).toBeNull()
  })

  it('una toma sin escala cuenta, y se dice que cuenta', () => {
    // Es un cociente: la escala se cancela. Descartarla sería tirar un dato
    // bueno; callarlo sería esconder de dónde salió.
    render(
      <HistorialEncoder tomas={[toma(L_MANANA, { hayEscala: false }), toma(M_MANANA)]} />,
    )
    expect(screen.getByText(/sin\s+escala/i)).toBeInTheDocument()
    expect(screen.getByText(/el %PV es un cociente y la\s+escala se cancela/i)).toBeInTheDocument()
  })

  it('con todas las tomas con escala no se menciona', () => {
    render(<HistorialEncoder tomas={[toma(L_MANANA), toma(M_MANANA)]} />)
    expect(screen.queryByText(/píxeles por segundo/i)).toBeNull()
  })
})
