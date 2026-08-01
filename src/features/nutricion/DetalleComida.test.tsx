import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DetalleComida } from './DetalleComida'
import type { RegistroComida } from '../../domain/types'

/**
 * La regla R3 en la práctica: aceite y sal en unidades, nunca en adjetivos, y
 * no se preguntan si no cocinó él.
 */

const base: RegistroComida = {
  id: 'c-1',
  usuarioId: 'u-1',
  momentoIso: '2026-07-31T13:00:00',
  comida: 'almuerzo',
  cocinadoPorEl: true,
  aceiteG: null,
  salG: null,
  confianza: 'pesado',
  items: [],
}

const conArroz: RegistroComida = {
  ...base,
  items: [
    {
      id: 'it-1',
      alimentoId: 'arroz-blanco-pulido-cocido-sin-sal',
      gramos: 150,
      fuePesado: true,
      estadoAsumido: 'cocido',
    },
  ],
}

const pintar = (comida: RegistroComida = base) => {
  const onCambiar = vi.fn()
  const onQuitarItem = vi.fn()
  const onAgregar = vi.fn()
  render(
    <DetalleComida
      comida={comida}
      onVolver={vi.fn()}
      onAgregar={onAgregar}
      onQuitarItem={onQuitarItem}
      onCambiar={onCambiar}
    />,
  )
  return { onCambiar, onQuitarItem, onAgregar }
}

describe('DetalleComida', () => {
  it('una comida sin nada dice qué hacer, no "vacío"', () => {
    pintar()
    expect(screen.getByText(/pesa lo que vas a comer y agrégalo/i)).toBeInTheDocument()
  })

  it('lista lo registrado con sus gramos', () => {
    pintar(conArroz)
    expect(screen.getByText('150 g')).toBeInTheDocument()
  })

  it('se puede quitar un alimento metido por error', async () => {
    const { onQuitarItem } = pintar(conArroz)
    await userEvent.click(screen.getByRole('button', { name: /^quitar/i }))
    expect(onQuitarItem).toHaveBeenCalledWith('it-1')
  })

  describe('R3 · aceite y sal en unidades', () => {
    it('ofrece cucharadas, no adjetivos', () => {
      pintar()
      for (const opcion of ['1/2 cda', '1 cda', '2 cda', '3 cda']) {
        expect(screen.getByRole('button', { name: opcion })).toBeInTheDocument()
      }
      expect(screen.queryByRole('button', { name: /poco|bastante|normal/i })).not.toBeInTheDocument()
    })

    it('ofrece pizcas y cucharaditas para la sal', () => {
      pintar()
      for (const opcion of ['1 pizca', '1/2 cdta', '1 cdta', '1 cubito']) {
        expect(screen.getByRole('button', { name: opcion })).toBeInTheDocument()
      }
    })

    it('elegir una cucharada guarda sus gramos', async () => {
      const { onCambiar } = pintar()
      await userEvent.click(screen.getByRole('button', { name: '1 cda' }))
      expect(onCambiar).toHaveBeenCalledWith({ aceiteG: 14 })
    })

    it('"nada" guarda un CERO, no un nulo: es una afirmación', async () => {
      // Decir "no le puse aceite" es un dato. Dejarlo en null diría "no se
      // preguntó", y el motor trata esas dos cosas distinto.
      const { onCambiar } = pintar()
      const [aceiteNada] = screen.getAllByRole('button', { name: 'nada' })
      await userEvent.click(aceiteNada)
      expect(onCambiar).toHaveBeenCalledWith({ aceiteG: 0 })
    })

    it('avisa de las calorías del aceite, que no se ven en el plato', () => {
      pintar({ ...base, aceiteG: 14 })
      // 14 g de aceite a 884 kcal/100 g = 124 kcal.
      expect(screen.getByText(/124 kcal/)).toBeInTheDocument()
    })

    it('sin aceite puesto, no hay aviso que dar', () => {
      pintar()
      expect(screen.queryByText(/no se ven en el plato/i)).not.toBeInTheDocument()
    })
  })

  describe('cuando NO cocinó él', () => {
    const ajena: RegistroComida = { ...base, cocinadoPorEl: false, confianza: 'ajeno' }

    it('no le pregunta por el aceite: no lo puede saber', () => {
      pintar(ajena)
      expect(screen.queryByRole('button', { name: '1 cda' })).not.toBeInTheDocument()
      expect(screen.getByText(/no puedes saberlo/i)).toBeInTheDocument()
    })

    it('el margen sube a ±30 %', () => {
      // Sale dos veces a propósito: en el texto que lo explica y en el pie que
      // lo resume. Las dos tienen que decir lo mismo.
      pintar(ajena)
      expect(screen.getAllByText('±30 %')).toHaveLength(2)
    })

    it('al decir que no cocinó, borra el aceite y la sal que hubiera puesto', async () => {
      // Dejarlos puestos mantendría un dato que ya no significa nada: son los
      // gramos de una cocina que no fue la suya.
      const { onCambiar } = pintar({ ...base, aceiteG: 14, salG: 3 })
      await userEvent.click(screen.getByRole('switch'))
      expect(onCambiar).toHaveBeenCalledWith({
        cocinadoPorEl: false,
        aceiteG: null,
        salG: null,
        confianza: 'ajeno',
      })
    })
  })

  describe('el margen', () => {
    it('una comida pesada es ±5 %', () => {
      pintar()
      expect(screen.getByText('±5 %')).toBeInTheDocument()
    })

    it('una estimada es ±25 %', () => {
      pintar({ ...base, confianza: 'estimado' })
      expect(screen.getByText('±25 %')).toBeInTheDocument()
    })
  })
})
