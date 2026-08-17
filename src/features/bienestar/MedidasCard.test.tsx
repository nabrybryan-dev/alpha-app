import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '../../data/dbInstance'
import { MedidasCard } from './MedidasCard'

/**
 * «Mis medidas» era la CUARTA superficie de peso de la app, y la última que
 * seguía pidiéndolo a todo el mundo.
 *
 * La migración 0018 apaga las cifras de composición corporal a quien tiene un
 * antecedente de conducta alimentaria. El check-in ya lo respetaba; esta tarjeta
 * no, porque `MedidaCorporal.pesoKg` era obligatorio en el tipo. A esa persona
 * se le seguía ofreciendo una báscula aquí.
 *
 * Lo que NO se hace es esconderle la tarjeta entera: su plan sí le pide
 * perímetros, y quitárselos por proteger lo otro sería cambiar un daño por otro.
 */

const VALENTINA = 'u-valentina'

const abrir = (verPeso?: boolean) =>
  render(<MedidasCard usuarioId={VALENTINA} {...(verPeso === undefined ? {} : { verPeso })} />)

/** Cuántas medidas tiene guardadas ahora mismo. */
const medidas = () => db.perfiles.byUsuario(VALENTINA)?.medidas ?? []

describe('la tarjeta de medidas', () => {
  beforeEach(() => localStorage.clear())

  describe('con la composición corporal a la vista', () => {
    it('pide el peso, y es obligatorio', async () => {
      abrir(true)
      await userEvent.click(screen.getByRole('button', { name: /registrar/i }))

      expect(screen.getByText(/Peso \(kg\)/)).toBeTruthy()
      expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled()
    })

    it('con el peso escrito ya deja guardar', async () => {
      abrir(true)
      await userEvent.click(screen.getByRole('button', { name: /registrar/i }))
      await userEvent.type(screen.getByLabelText(/Peso \(kg\)/), '56')

      expect(screen.getByRole('button', { name: /guardar/i })).toBeEnabled()
    })

    /** Quien no pase la prop se comporta como antes: nada cambia por defecto. */
    it('por defecto se comporta igual', async () => {
      abrir()
      await userEvent.click(screen.getByRole('button', { name: /registrar/i }))
      expect(screen.getByText(/Peso \(kg\)/)).toBeTruthy()
    })
  })

  describe('con la composición corporal apagada', () => {
    it('no le pide el peso', async () => {
      abrir(false)
      await userEvent.click(screen.getByRole('button', { name: /registrar/i }))

      expect(screen.queryByText(/Peso \(kg\)/)).toBeNull()
      expect(screen.queryByLabelText(/Peso \(kg\)/)).toBeNull()
    })

    /** Quitarle los perímetros sería cambiar un daño por otro. */
    it('pero sigue pudiendo anotar sus perímetros', async () => {
      abrir(false)
      await userEvent.click(screen.getByRole('button', { name: /registrar/i }))

      expect(screen.getByText('Cintura (cm)')).toBeTruthy()
      expect(screen.getByText('Cadera (cm)')).toBeTruthy()
    })

    it('guarda la medición sin peso', async () => {
      abrir(false)
      await userEvent.click(screen.getByRole('button', { name: /registrar/i }))
      const cintura = screen.getAllByPlaceholderText('—')[0]
      await userEvent.type(cintura, '72')
      await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

      const [ultima] = medidas().slice(-1)
      expect(ultima.pesoKg).toBeUndefined()
      expect(ultima.perimetros.Cintura).toBe(72)
    })

    /**
     * Sin peso hace falta otra condición, o se guardaría una fila con fecha y
     * nada más: ensucia el historial del coach y no dice nada de nadie.
     */
    it('no deja guardar una medición vacía', async () => {
      abrir(false)
      await userEvent.click(screen.getByRole('button', { name: /registrar/i }))

      expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled()
    })

    it('con un perímetro escrito ya deja guardar', async () => {
      abrir(false)
      await userEvent.click(screen.getByRole('button', { name: /registrar/i }))
      await userEvent.type(screen.getAllByPlaceholderText('—')[0], '72')

      expect(screen.getByRole('button', { name: /guardar/i })).toBeEnabled()
    })

    /**
     * Enseñar el kilaje del resumen dejaría entrar por la puerta de atrás lo
     * que el formulario acaba de dejar de pedir.
     */
    it('tampoco le enseña el kilaje de una medición anterior', () => {
      db.perfiles.agregarMedida(VALENTINA, {
        fecha: '2026-12-31',
        pesoKg: 56,
        alturaCm: 165,
        perimetros: { Cintura: 72 },
      })
      abrir(false)

      expect(screen.getByText(/Última: 2026-12-31/)).toBeTruthy()
      expect(screen.queryByText(/56 kg/)).toBeNull()
    })

    it('y sí se lo enseña a quien sí ve su composición', () => {
      db.perfiles.agregarMedida(VALENTINA, {
        fecha: '2026-12-31',
        pesoKg: 56,
        alturaCm: 165,
        perimetros: {},
      })
      abrir(true)

      expect(screen.getByText(/56 kg/)).toBeTruthy()
    })
  })
})
