import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import CifrasAsesoradosPage from './CifrasAsesoradosPage'
import { SessionProvider } from '../../app/SessionProvider'
import { reiniciarDb } from '../../data/mockDb'
import { db } from '../../data/dbInstance'

/**
 * El puesto de la nutricionista. Lo que se prueba: que llegue a la decisión,
 * que la vea con las cifras delante, y que el asesorado no pueda entrar.
 */

const pintar = () =>
  render(
    <MemoryRouter>
      <SessionProvider>
        <CifrasAsesoradosPage />
      </SessionProvider>
    </MemoryRouter>,
  )

/** Deja a Valentina con una señal: ciclo irregular. */
const conSenal = () =>
  db.perfilNutricion.guardar('u-valentina', { cicloMenstrual: 'irregular' }, true)

const comoStaff = () => localStorage.setItem('alpha-usuario', 'u-bryan')

const fichaDe = async (nombre: RegExp) => {
  const boton = screen.getByRole('button', { name: nombre })
  await userEvent.click(boton)
  return within(boton.closest('div') as HTMLElement)
}

describe('CifrasAsesoradosPage', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarDb()
    comoStaff()
  })

  it('un asesorado no entra aquí', () => {
    localStorage.setItem('alpha-usuario', 'u-valentina')
    const { container } = pintar()
    expect(container).toBeEmptyDOMElement()
  })

  it('lista la cartera', () => {
    pintar()
    expect(screen.getByText(/tu cartera|los demás/i)).toBeInTheDocument()
  })

  describe('los que esperan decisión', () => {
    it('van arriba, en su propio bloque', () => {
      // Quien entra aquí lo hace para resolver algo: tiene que estar donde cae
      // el ojo, no en una columna de una lista alfabética.
      conSenal()
      pintar()
      expect(screen.getByText(/esperan tu decisión · 1/i)).toBeInTheDocument()
    })

    it('dicen por qué, para no tener que adivinarlo', () => {
      conSenal()
      pintar()
      expect(screen.getByText(/ciclo menstrual irregular o ausente/i)).toBeInTheDocument()
    })

    it('sin señales, nadie espera nada', () => {
      pintar()
      expect(screen.queryByText(/esperan tu decisión/i)).not.toBeInTheDocument()
    })
  })

  describe('la ficha', () => {
    it('enseña las cifras COMPLETAS, aunque el asesorado no las vea', async () => {
      // Decidir si alguien debe ver su porcentaje sin verlo sería decidir a
      // ciegas.
      pintar()
      const ficha = await fichaDe(/valentina/i)
      expect(ficha.getByText('Grasa')).toBeInTheDocument()
      expect(ficha.getByText('TDEE')).toBeInTheDocument()
    })

    it('trae los tres interruptores', async () => {
      pintar()
      const ficha = await fichaDe(/valentina/i)
      expect(ficha.getByRole('switch', { name: /composición corporal/i })).toBeInTheDocument()
      expect(ficha.getByRole('switch', { name: /objetivo calórico/i })).toBeInTheDocument()
      expect(ficha.getByRole('switch', { name: /contador del diario/i })).toBeInTheDocument()
    })

    it('por defecto están encendidos', async () => {
      pintar()
      const ficha = await fichaDe(/valentina/i)
      expect(ficha.getByRole('switch', { name: /composición corporal/i })).toBeChecked()
    })

    it('apagar uno lo guarda', async () => {
      pintar()
      const ficha = await fichaDe(/valentina/i)
      await userEvent.click(ficha.getByRole('switch', { name: /composición corporal/i }))

      expect(db.visibilidad.byUsuario('u-valentina')?.verComposicion).toBe(false)
    })

    it('tocar cualquier interruptor cuenta como haberlo mirado', async () => {
      // Deja de estar en espera aunque la señal que lo trajo siga ahí.
      conSenal()
      pintar()
      const ficha = await fichaDe(/valentina/i)
      await userEvent.click(ficha.getByRole('switch', { name: /contador del diario/i }))

      expect(db.visibilidad.byUsuario('u-valentina')?.estado).toBe('decidido')
    })

    it('queda constancia de quién decidió', async () => {
      pintar()
      const ficha = await fichaDe(/valentina/i)
      await userEvent.click(ficha.getByRole('switch', { name: /objetivo calórico/i }))

      const guardada = db.visibilidad.byUsuario('u-valentina')
      expect(guardada?.decididoPor).toBe('u-bryan')
      expect(guardada?.decididoEn).toBeTruthy()
    })

    it('quien no ha respondido la encuesta no tiene nada que decidir', async () => {
      pintar()
      // Mateo no la respondió en el seed.
      const ficha = await fichaDe(/mateo/i)
      expect(ficha.getByText(/todavía no ha respondido/i)).toBeInTheDocument()
      expect(ficha.queryByRole('switch')).not.toBeInTheDocument()
    })
  })
})
