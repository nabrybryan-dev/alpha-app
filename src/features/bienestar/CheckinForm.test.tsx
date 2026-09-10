import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CheckinForm } from './CheckinForm'

// Las 6 preguntas cualitativas de pastillas. El hambre y el dolor no están
// aquí: van en escalas numéricas y se marcan aparte.
const GRUPOS = [
  '¿Cómo estuvo tu rendimiento?',
  'Motivación',
  'Cansancio',
  'Estrés',
  'Calidad del sueño',
  '¿Cómo estuvo tu alimentación?',
]

/** Pastillas (6) + hambre + dolor. */
const OBLIGATORIOS = GRUPOS.length + 2

function grupo(titulo: string): HTMLElement {
  const fieldset = screen.getByText(titulo).closest('fieldset')
  if (!fieldset) throw new Error(`No se encontró el fieldset de "${titulo}"`)
  return fieldset as HTMLElement
}

/** El hambre se marca en la escala nueva, no en pastillas. */
function marcarHambre(valor = 10) {
  fireEvent.click(screen.getByRole('button', { name: `Hambre ${valor} de 10` }))
}

/** El dolor va de 0 a 10; el 0 es «sin dolor» y es una respuesta. */
function marcarDolor(valor = 0) {
  fireEvent.click(screen.getByRole('button', { name: `Dolor ${valor} de 10` }))
}

function marcarTodos() {
  for (const titulo of GRUPOS) {
    const opciones = within(grupo(titulo)).getAllByRole('button')
    fireEvent.click(opciones[opciones.length - 1]) // última opción (BUENA / MUCHO)
  }
  marcarHambre()
  marcarDolor()
}

const guardarBtn = () => screen.getByRole('button', { name: /guardar check-in/i })

describe('CheckinForm — validación de campos', () => {
  it('no guarda con campos cualitativos incompletos y avisa cuántos faltan', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={onGuardar} />)

    fireEvent.click(guardarBtn())

    expect(onGuardar).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(`Te faltan ${OBLIGATORIOS} campos por marcar`)
  })

  it('la cuenta del aviso baja a medida que se marcan campos', () => {
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={vi.fn()} />)
    fireEvent.click(guardarBtn())
    expect(screen.getByRole('alert')).toHaveTextContent(`${OBLIGATORIOS} campos`)

    fireEvent.click(within(grupo('Motivación')).getAllByRole('button')[0])
    expect(screen.getByRole('alert')).toHaveTextContent(`${OBLIGATORIOS - 1} campos`)
  })

  it('al completar todos, el aviso desaparece y guarda con los valores', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={onGuardar} />)

    fireEvent.click(guardarBtn()) // intento fallido → aparece el aviso
    expect(screen.getByRole('alert')).toBeInTheDocument()

    marcarTodos()
    expect(screen.queryByRole('alert')).toBeNull() // se limpia al completar

    fireEvent.click(guardarBtn())
    expect(onGuardar).toHaveBeenCalledTimes(1)
    expect(onGuardar.mock.calls[0][0]).toMatchObject({
      usuarioId: 'u1',
      fecha: '2026-01-01',
      rendimiento: 'BUENA',
      motivacion: 'MUCHO',
      alimentacion: 'BUENA',
    })
  })
})

describe('CheckinForm — la escala de hambre', () => {
  it('ofrece los diez valores, no tres categorías', () => {
    // Con POCO/REGULAR/MUCHO no se distinguía un 7 de un 9, que es la
    // diferencia entre esperar cinco días y actuar en dos.
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={vi.fn()} />)
    for (const n of [1, 5, 10]) {
      expect(screen.getByRole('button', { name: `Hambre ${n} de 10` })).toBeInTheDocument()
    }
  })

  it('guarda el número, no una etiqueta', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={onGuardar} />)

    marcarTodos()
    marcarHambre(8)
    fireEvent.click(guardarBtn())

    expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ hambreEscala: 8 }))
  })

  it('dice cómo se vive ese nivel, para que dos personas calibren igual', () => {
    // Un "8" a secas no significa nada: sin la referencia, cada quien se
    // inventa su propia escala.
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={vi.fn()} />)
    marcarHambre(8)
    expect(screen.getByText(/interfiere con el trabajo o el entreno/i)).toBeInTheDocument()
  })

  it('sin marcarla, sigue contando como campo pendiente', () => {
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={vi.fn()} />)
    fireEvent.click(guardarBtn())
    expect(screen.getByRole('alert')).toHaveTextContent(`${OBLIGATORIOS} campos`)
  })
})

describe('CheckinForm — la escala de dolor', () => {
  it('ofrece el cero y los diez valores', () => {
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={vi.fn()} />)
    for (const n of [0, 1, 5, 10]) {
      expect(screen.getByRole('button', { name: `Dolor ${n} de 10` })).toBeInTheDocument()
    }
  })

  it('«sin dolor» es una respuesta: marcando el cero se guarda un 0, no un hueco', () => {
    // Un ajuste clínico se reabre con «EVA ≤2 en todas las sesiones». Para
    // que eso se pueda contar, el cero tiene que quedar escrito.
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={onGuardar} />)

    marcarTodos() // incluye Dolor 0
    fireEvent.click(guardarBtn())

    expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ dolor: 0 }))
    expect(onGuardar.mock.calls[0][0].dolorDonde).toBeUndefined()
  })

  it('sin marcarlo, cuenta como campo pendiente', () => {
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={vi.fn()} />)
    for (const titulo of GRUPOS) {
      const opciones = within(grupo(titulo)).getAllByRole('button')
      fireEvent.click(opciones[0])
    }
    marcarHambre(3)
    fireEvent.click(guardarBtn())
    expect(screen.getByRole('alert')).toHaveTextContent('Te falta 1 campo por marcar')
  })

  it('con dolor, pregunta dónde y no deja guardar sin decirlo', () => {
    // Un «6» a secas no le dice al coach si es la rodilla que vigila o una agujeta.
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={onGuardar} />)

    marcarTodos()
    expect(screen.queryByLabelText('¿Dónde?')).toBeNull() // con 0, no se pregunta

    marcarDolor(6)
    expect(screen.getByText(/te obliga a cambiar el ejercicio o el ritmo/i)).toBeInTheDocument()
    fireEvent.click(guardarBtn())
    expect(onGuardar).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Te falta 1 campo por marcar')

    fireEvent.change(screen.getByLabelText('¿Dónde?'), { target: { value: '  Rodilla izquierda ' } })
    fireEvent.click(guardarBtn())
    expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ dolor: 6, dolorDonde: 'Rodilla izquierda' }))
  })

  it('si vuelve a «sin dolor», el dónde no viaja aunque se hubiera escrito', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={onGuardar} />)

    marcarTodos()
    marcarDolor(4)
    fireEvent.change(screen.getByLabelText('¿Dónde?'), { target: { value: 'Hombro' } })
    marcarDolor(0)
    fireEvent.click(guardarBtn())

    expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ dolor: 0 }))
    expect(onGuardar.mock.calls[0][0].dolorDonde).toBeUndefined()
  })
})
