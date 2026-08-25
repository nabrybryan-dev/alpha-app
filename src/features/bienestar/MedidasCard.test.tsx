import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '../../data/dbInstance'
import { direccion } from '../../lib/direccionesVisuales'
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

/**
 * La columna de la pieza E, dentro de esta misma tarjeta.
 *
 * Tres de estas cinco comprobaciones existen porque el fallo **no daría error**:
 * pedir 448 KB de vídeo al abrir Bienestar, aplicarle a la columna un `encaje`
 * que la saca del cuerpo, o estirar la pieza en un móvil. Ninguna de las tres se
 * ve desarrollando en un monitor.
 */
describe('la columna de la pieza E', () => {
  /** El alto que Tailwind da a cada clase `max-h-*`, en px. `max-h-60` = 15rem. */
  const MAX_H = { 'max-h-56': 224, 'max-h-60': 240, 'max-h-64': 256, 'max-h-72': 288 }
  const DPR = 3
  const ALTO_PIEZA = 720

  const columna = (c: HTMLElement) => c.querySelector('[aria-hidden="true"].overflow-hidden')

  it('con el formulario cerrado no se pide la pieza', () => {
    const { container } = abrir()

    // Abrir Bienestar no puede costar el vídeo de una tarjeta que nadie ha tocado.
    expect(container.querySelectorAll('video')).toHaveLength(0)
    expect(container.querySelectorAll('img')).toHaveLength(0)
  })

  it('al pulsar «Registrar» aparece, y es la pieza E', async () => {
    const { container } = abrir()
    await userEvent.click(screen.getByRole('button', { name: /registrar/i }))

    expect(container.querySelector('img')?.getAttribute('src')).toBe(direccion('E').poster)
    expect(container.querySelector('video')?.getAttribute('src')).toBe(direccion('E').video)
  })

  it('mira al cuerpo, no al centro geométrico', async () => {
    const { container } = abrir()
    await userEvent.click(screen.getByRole('button', { name: /registrar/i }))

    // 61% es la ventana x=632..872, medida. El centro por defecto —50%— cae en la
    // parte apagada del plano, y ese cambio de una cifra no lo delata nada más.
    expect(container.querySelector('img')?.className).toContain('object-[61%_50%]')
  })

  it('NO lleva el `encaje` de E, que aquí sobra y desplaza la ventana', async () => {
    const { container } = abrir()
    await userEvent.click(screen.getByRole('button', { name: /registrar/i }))

    // El catálogo lleva `origin-right scale-[1.213]` para quitar la columna negra
    // del 17,6% izquierdo. El recorte 1:3 ya empieza en x=632, muy a su derecha:
    // aplicarlo encima sacaría la ventana del cuerpo. Ver el comentario del
    // componente. Este test está para el día que alguien lo añada «porque falta».
    expect(direccion('E').encaje).toBeTruthy()
    expect(container.querySelector('img')?.className).not.toContain('scale-')
  })

  it('no se amplía: el tope es de ALTO y sale de la propia pieza', async () => {
    const { container } = abrir()
    await userEvent.click(screen.getByRole('button', { name: /registrar/i }))

    // Cover sobre una caja alta y estrecha: la escala la manda el alto, no el
    // ancho. `alto_css * DPR` no puede pasar de los 720 px de la fuente.
    const clase = Object.keys(MAX_H).find((c) => columna(container)?.className.includes(c))
    expect(clase, 'la columna tiene que declarar un tope de alto').toBeTruthy()
    expect(MAX_H[clase as keyof typeof MAX_H] * DPR).toBeLessThanOrEqual(ALTO_PIEZA)
  })

  it('con movimiento reducido queda el póster y ni un vídeo', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    )
    const { container } = abrir()
    await userEvent.click(screen.getByRole('button', { name: /registrar/i }))

    expect(container.querySelectorAll('video')).toHaveLength(0)
    expect(container.querySelector('img')?.getAttribute('src')).toBe(direccion('E').poster)
    vi.unstubAllGlobals()
  })
})
