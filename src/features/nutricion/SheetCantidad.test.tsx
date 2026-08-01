import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SheetCantidad } from './SheetCantidad'
import type { AlimentoIndice } from '../../domain/nutricion/busqueda'

const arroz: AlimentoIndice = {
  id: 'arroz-cocido',
  nombre: 'Arroz blanco, cocido',
  grupo: 'carbohidratos',
  estado: 'cocido',
  confianza: 'verificado',
  fuente: 'tcac',
  por100g: { kcal: 130, proteina_g: 2.4, carbos_g: 28, grasa_g: 0.3 },
  medidas: [{ nombre: 'taza', gramos: 158 }],
}

const pintar = (props: Partial<Parameters<typeof SheetCantidad>[0]> = {}) => {
  const onAgregar = vi.fn()
  const onElegirEstado = vi.fn()
  render(
    <SheetCantidad
      abierto
      alimento={arroz}
      preguntarEstado={null}
      nombreComida="Almuerzo"
      onCerrar={vi.fn()}
      onElegirEstado={onElegirEstado}
      onAgregar={onAgregar}
      {...props}
    />,
  )
  return { onAgregar, onElegirEstado }
}

const campoGramos = () => screen.getByLabelText('Cantidad en g')

describe('SheetCantidad', () => {
  it('arranca en 100 g', () => {
    pintar()
    expect(campoGramos()).toHaveValue('100')
  })

  it('recalcula las calorías al cambiar los gramos', async () => {
    pintar()
    // 130 kcal/100 g × 105 g = 136,5 -> 137
    await userEvent.click(screen.getByLabelText('Subir Cantidad'))
    expect(campoGramos()).toHaveValue('105')
    expect(screen.getByText(/137 kcal/)).toBeInTheDocument()
  })

  it('deja registrar más de un kilo: 1,5 L de agua son 1.500 g', async () => {
    // El Stepper limita a 999 por defecto y aquí eso recortaría el vaso de agua
    // sin decir nada. El tope de verdad va en calorías, no en gramos.
    const { onAgregar } = pintar()
    await userEvent.clear(campoGramos())
    await userEvent.type(campoGramos(), '1500')
    await userEvent.click(screen.getByRole('button', { name: /agregar a almuerzo/i }))
    expect(onAgregar).toHaveBeenCalledWith(arroz, 1500, true)
  })

  it('una medida casera pone sus gramos', async () => {
    pintar()
    await userEvent.click(screen.getByRole('button', { name: /taza/i }))
    expect(campoGramos()).toHaveValue('158')
  })

  it('entrega los gramos y cómo se supieron', async () => {
    const { onAgregar } = pintar()
    await userEvent.click(screen.getByRole('button', { name: /lo estimé/i }))
    await userEvent.click(screen.getByRole('button', { name: /agregar a almuerzo/i }))
    expect(onAgregar).toHaveBeenCalledWith(arroz, 100, false)
  })

  it('por defecto asume que lo pesó', async () => {
    const { onAgregar } = pintar()
    await userEvent.click(screen.getByRole('button', { name: /agregar a almuerzo/i }))
    expect(onAgregar).toHaveBeenCalledWith(arroz, 100, true)
  })

  it('no deja agregar 0 g', async () => {
    pintar()
    await userEvent.clear(campoGramos())
    await userEvent.type(campoGramos(), '0')
    expect(screen.getByRole('button', { name: /agregar a almuerzo/i })).toBeDisabled()
  })

  describe('avisos de tope', () => {
    it('avisa al pasarse, pero NO bloquea el registro', async () => {
      pintar()
      await userEvent.clear(campoGramos())
      await userEvent.type(campoGramos(), '2000') // 2.600 kcal, sobre el tope
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /agregar a almuerzo/i })).toBeEnabled()
    })

    it('con una cantidad normal no molesta', () => {
      pintar()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  describe('cuando el alimento no trae calorías', () => {
    const sinKcal: AlimentoIndice = {
      ...arroz,
      id: 'sin-kcal',
      por100g: { kcal: null, proteina_g: null, carbos_g: null, grasa_g: null },
    }

    it('no revienta y deja registrar el peso igual', async () => {
      // `revisarItem` lanza a propósito sin kcal. Eso no puede llegar a
      // pantalla: el peso sigue siendo un dato bueno aunque falte la
      // composición.
      const { onAgregar } = pintar({ alimento: sinKcal })
      expect(screen.getByText(/sin datos de energía/i)).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: /agregar a almuerzo/i }))
      expect(onAgregar).toHaveBeenCalledWith(sinKcal, 100, true)
    })
  })

  describe('la pregunta de crudo o cocido', () => {
    const opciones = [
      { alimento: arroz, etiqueta: 'Cocido', pista: 'Lo pesas en el plato' },
      {
        alimento: { ...arroz, id: 'arroz-crudo', nombre: 'Arroz blanco, crudo', por100g: { ...arroz.por100g, kcal: 365 } },
        etiqueta: 'Crudo',
        pista: 'Lo pesas antes de cocinar',
      },
    ]

    it('enseña las calorías de cada opción, para que elija informado', () => {
      pintar({ preguntarEstado: opciones })
      const cocido = screen.getByRole('button', { name: /cocido/i })
      const crudo = screen.getByRole('button', { name: /crudo/i })
      expect(within(cocido).getByText(/130 kcal/)).toBeInTheDocument()
      expect(within(crudo).getByText(/365 kcal/)).toBeInTheDocument()
    })

    it('al contestar, avisa cuál eligió', async () => {
      const { onElegirEstado } = pintar({ preguntarEstado: opciones })
      await userEvent.click(screen.getByRole('button', { name: /crudo/i }))
      expect(onElegirEstado).toHaveBeenCalledWith(opciones[1].alimento)
    })

    it('mientras haya pregunta pendiente, no se puede agregar nada', () => {
      pintar({ preguntarEstado: opciones })
      expect(screen.queryByRole('button', { name: /agregar a/i })).not.toBeInTheDocument()
    })

    it('sin pregunta pendiente va directo a la cantidad', () => {
      pintar({ preguntarEstado: [] })
      expect(screen.getByRole('button', { name: /agregar a almuerzo/i })).toBeInTheDocument()
    })
  })

  it('al cambiar de alimento vuelve a 100 g', () => {
    // El fallo que evita: los 250 g del arroz quedándose puestos al abrir el
    // aceite. 250 g de aceite son 2.200 kcal que nadie escribió.
    const { rerender } = render(
      <SheetCantidad
        abierto
        alimento={arroz}
        preguntarEstado={null}
        nombreComida="Almuerzo"
        onCerrar={vi.fn()}
        onElegirEstado={vi.fn()}
        onAgregar={vi.fn()}
      />,
    )
    rerender(
      <SheetCantidad
        abierto
        alimento={{ ...arroz, id: 'aceite', nombre: 'Aceite de girasol' }}
        preguntarEstado={null}
        nombreComida="Almuerzo"
        onCerrar={vi.fn()}
        onElegirEstado={vi.fn()}
        onAgregar={vi.fn()}
      />,
    )
    expect(campoGramos()).toHaveValue('100')
  })
})
