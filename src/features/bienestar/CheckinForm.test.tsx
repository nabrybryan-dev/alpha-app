import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CheckinForm } from './CheckinForm'

/** Las 3 obligatorias de arriba. */
const OBLIGATORIAS_CORTAS = 3

function marcarSueno(valor: 'MALA' | 'REGULAR' | 'BUENA' = 'BUENA') {
  const fs = screen.getByText('¿Cómo dormiste?').closest('fieldset')!
  fireEvent.click(within(fs as HTMLElement).getByRole('button', { name: valor }))
}

function marcarEnergia(etiqueta: 'Con energía' | 'Normal' | 'Sin energía' = 'Con energía') {
  const fs = screen.getByText('¿Cómo llegas hoy?').closest('fieldset')!
  fireEvent.click(within(fs as HTMLElement).getByRole('button', { name: etiqueta }))
}

function marcarDolorNo() {
  fireEvent.click(screen.getByRole('button', { name: 'No' }))
}

function marcarDolorSi() {
  fireEvent.click(screen.getByRole('button', { name: 'Sí' }))
}

function marcarDolor(valor = 0) {
  fireEvent.click(screen.getByRole('button', { name: `Dolor ${valor} de 10` }))
}

function abrirMasDetalles() {
  const summary = screen.getByText('Más detalles (opcional)')
  fireEvent.click(summary)
}

const guardarBtn = () => screen.getByRole('button', { name: /guardar check-in/i })

describe('CheckinForm — check-in corto (3 obligatorias)', () => {
  it('no guarda con las 3 vacías y avisa cuántas faltan', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={onGuardar} />)

    fireEvent.click(guardarBtn())

    expect(onGuardar).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(`Te faltan ${OBLIGATORIAS_CORTAS} campos por marcar`)
  })

  it('la cuenta baja a medida que se marcan', () => {
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={vi.fn()} />)
    fireEvent.click(guardarBtn())
    expect(screen.getByRole('alert')).toHaveTextContent(`${OBLIGATORIAS_CORTAS} campos`)

    marcarSueno()
    expect(screen.getByRole('alert')).toHaveTextContent(`${OBLIGATORIAS_CORTAS - 1} campos`)
  })

  it('con las 3 completas guarda y espeja dolorDesdeAyer en dolor/dolorDonde', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={onGuardar} />)

    marcarSueno('BUENA')
    marcarEnergia('Con energía')
    marcarDolorNo()

    fireEvent.click(guardarBtn())
    expect(onGuardar).toHaveBeenCalledTimes(1)
    const c = onGuardar.mock.calls[0][0]
    expect(c.calidadSueno).toBe('BUENA')
    expect(c.cansancio).toBe('POCO')
    expect(c.dolor).toBe(0)
    expect(c.dolorDesdeAyer).toEqual({ hay: false, donde: undefined, eva: 0 })
  })

  it('con dolor desde ayer pide EVA y dónde', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={onGuardar} />)

    marcarSueno()
    marcarEnergia()
    marcarDolorSi()
    // Sin EVA no guarda
    fireEvent.click(guardarBtn())
    expect(onGuardar).not.toHaveBeenCalled()

    marcarDolor(6)
    // Con EVA>0 falta dónde
    fireEvent.click(guardarBtn())
    expect(onGuardar).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Te falta 1 campo por marcar')
    expect(screen.getByLabelText('¿Dónde?')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('¿Dónde?'), { target: { value: ' Rodilla ' } })
    fireEvent.click(guardarBtn())
    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ dolor: 6, dolorDonde: 'Rodilla', dolorDesdeAyer: { hay: true, donde: 'Rodilla', eva: 6 } }),
    )
  })

  it('sin dolor marcado como No no pide dónde ni EVA', () => {
    // El caso mayoritario: no duele nada, un toque y listo.
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={onGuardar} />)
    marcarSueno()
    marcarEnergia()
    marcarDolorNo()
    expect(screen.queryByLabelText('¿Dónde?')).toBeNull()
    fireEvent.click(guardarBtn())
    expect(onGuardar).toHaveBeenCalled()
  })
})

describe('CheckinForm — más detalles plegado', () => {
  it('el resto va plegado y no bloquea el guardar', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={onGuardar} />)
    // Sin abrir detalles ya se puede guardar con las 3
    marcarSueno()
    marcarEnergia()
    marcarDolorNo()
    fireEvent.click(guardarBtn())
    expect(onGuardar).toHaveBeenCalled()
  })

  it('si abre detalles, lo opcional se guarda cuando se rellena', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={onGuardar} />)
    marcarSueno()
    marcarEnergia()
    marcarDolorNo()
    abrirMasDetalles()
    // Rellenar hambre y estrés opcionales
    const hambreBtn = screen.getByRole('button', { name: 'Hambre 8 de 10' })
    fireEvent.click(hambreBtn)
    const estresFs = screen.getByText('Estrés').closest('fieldset')!
    fireEvent.click(within(estresFs as HTMLElement).getAllByRole('button')[0])
    fireEvent.click(guardarBtn())
    expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ hambreEscala: 8, estres: 'POCO' }))
  })
})

describe('CheckinForm — compatibilidad dolor espejado', () => {
  it('marcar Sí + 0 guarda eva 0 sin exigir dónde', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={onGuardar} />)
    marcarSueno()
    marcarEnergia()
    marcarDolorSi()
    marcarDolor(0)
    fireEvent.click(guardarBtn())
    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ dolor: 0, dolorDesdeAyer: { hay: true, donde: undefined, eva: 0 } }),
    )
    expect(onGuardar.mock.calls[0][0].dolorDonde).toBeUndefined()
  })
})

// ——— Restauradas del formulario viejo (ahora en «Más detalles» o en DolorDesdeAyer) ———

describe('CheckinForm — la escala de hambre', () => {
  it('ofrece los diez valores, no tres categorías', () => {
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={vi.fn()} />)
    abrirMasDetalles()
    for (const n of [1, 5, 10]) {
      expect(screen.getByRole('button', { name: `Hambre ${n} de 10` })).toBeInTheDocument()
    }
  })

  it('guarda el número, no una etiqueta', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={onGuardar} />)
    marcarSueno()
    marcarEnergia()
    marcarDolorNo()
    abrirMasDetalles()
    fireEvent.click(screen.getByRole('button', { name: 'Hambre 8 de 10' }))
    fireEvent.click(guardarBtn())
    expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ hambreEscala: 8 }))
  })

  it('dice cómo se vive ese nivel, para que dos personas calibren igual', () => {
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={vi.fn()} />)
    abrirMasDetalles()
    fireEvent.click(screen.getByRole('button', { name: 'Hambre 8 de 10' }))
    expect(screen.getByText(/interfiere con el trabajo o el entreno/i)).toBeInTheDocument()
  })
})

describe('CheckinForm — la escala de dolor', () => {
  it('ofrece el cero y los diez valores', () => {
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sí' }))
    for (const n of [0, 1, 5, 10]) {
      expect(screen.getByRole('button', { name: `Dolor ${n} de 10` })).toBeInTheDocument()
    }
  })

  it('«sin dolor» es una respuesta: marcando el cero se guarda un 0, no un hueco', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={onGuardar} />)
    marcarSueno()
    marcarEnergia()
    marcarDolorSi()
    marcarDolor(0)
    fireEvent.click(guardarBtn())
    expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ dolor: 0 }))
    expect(onGuardar.mock.calls[0][0].dolorDonde).toBeUndefined()
  })

  it('con dolor, pregunta dónde y no deja guardar sin decirlo', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={onGuardar} />)
    marcarSueno()
    marcarEnergia()
    marcarDolorSi()
    marcarDolor(6)
    expect(screen.getByLabelText('¿Dónde?')).toBeInTheDocument()
    fireEvent.click(guardarBtn())
    expect(onGuardar).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('¿Dónde?'), { target: { value: '  Rodilla izquierda ' } })
    fireEvent.click(guardarBtn())
    expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ dolor: 6, dolorDonde: 'Rodilla izquierda' }))
  })

  it('si vuelve a «sin dolor», el dónde no viaja aunque se hubiera escrito', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={onGuardar} />)
    marcarSueno()
    marcarEnergia()
    marcarDolorSi()
    marcarDolor(4)
    fireEvent.change(screen.getByLabelText('¿Dónde?'), { target: { value: 'Hombro' } })
    marcarDolor(0)
    fireEvent.click(guardarBtn())
    expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ dolor: 0 }))
    expect(onGuardar.mock.calls[0][0].dolorDonde).toBeUndefined()
  })
})
