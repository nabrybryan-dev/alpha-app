import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '../../data/dbInstance'
import { claveDe } from '../../domain/nutricion/despensa'
import { SheetDespensa } from './SheetDespensa'

/**
 * Lo que protege este archivo.
 *
 * La despensa existe para que el motor deje de proponer comida que no está. Si
 * esta pantalla se rompe no falla nada visible: la despensa se queda vacía, el
 * plan sigue proponiendo a ciegas, y nadie se entera — que es exactamente lo que
 * pasó durante once días con el módulo del dominio escrito y sin enchufar.
 */

const VALENTINA = 'u-valentina'
const HOY = new Date().toISOString().slice(0, 10)

const abrir = () =>
  render(<SheetDespensa asesoradoId={VALENTINA} abierto onCerrar={vi.fn()} />)

/** Deja la despensa vacía, para que un test no herede la del anterior. */
beforeEach(() => {
  for (const item of db.despensa.byUsuario(VALENTINA)) {
    db.despensa.quitar(VALENTINA, claveDe(item))
  }
})

describe('la despensa del asesorado', () => {
  it('cerrada no pinta nada', () => {
    render(<SheetDespensa asesoradoId={VALENTINA} abierto={false} onCerrar={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('vacía dice para qué sirve, en vez de dejar un hueco', () => {
    // El cero es el dato que importa: mientras esté vacía, el plan propone sin
    // saber qué hay en la cocina. Un espacio en blanco no dice eso.
    abrir()
    expect(screen.getByText(/En casa \(0\)/)).toBeTruthy()
    expect(screen.getByText(/te propone cambios sin saber qué tienes/i)).toBeTruthy()
  })

  it('buscar y elegir un alimento lo mete en casa', async () => {
    abrir()
    await userEvent.click(screen.getByRole('button', { name: /añadir lo que compré/i }))
    await userEvent.type(screen.getByLabelText('Nombre del alimento'), 'arroz')

    // Cada resultado del buscador es un botón con sus kcal: es como lo consulta
    // su propio test, y así este no depende de qué alimento salga primero.
    const [primero] = screen.getAllByRole('button', { name: /kcal\/100 g/i })
    await userEvent.click(primero)

    expect(db.despensa.byUsuario(VALENTINA)).toHaveLength(1)
    expect(screen.getByText(/En casa \(1\)/)).toBeTruthy()
  })

  it('entra SIN cantidad, y eso es a propósito', () => {
    // Pedir gramos sería pedir lo que la gente no sabe: de 1.198 alimentos solo
    // 357 tienen medida casera. Estimarlos sería fabricar un número con pinta de
    // medido. «Hay pollo» ya sostiene la decisión que importa.
    db.despensa.agregar(VALENTINA, {
      alimentoId: 'arroz-blanco-cocido',
      cantidadG: null,
      agregadoEn: HOY,
      origen: 'compra',
    })
    abrir()

    expect(db.despensa.byUsuario(VALENTINA)[0].cantidadG).toBeNull()
  })

  it('«Se acabó» lo saca de casa', async () => {
    db.despensa.agregar(VALENTINA, {
      alimentoId: 'arroz-blanco-cocido',
      cantidadG: null,
      agregadoEn: HOY,
      origen: 'compra',
    })
    abrir()

    await userEvent.click(screen.getByLabelText(/^Quitar /))
    expect(db.despensa.byUsuario(VALENTINA)).toHaveLength(0)
  })

  it('un pedido sin tabla nutricional se ve, y dice que no cuenta todavía', () => {
    // Entra igual —el staff tiene que verlo para añadirlo al catálogo— pero el
    // motor lo deja fuera de todo cálculo. Se dice, en vez de que la persona se
    // pregunte por qué ese no cuenta.
    db.despensa.agregar(VALENTINA, {
      alimentoId: null,
      textoPedido: 'Kefir de la tienda de abajo',
      cantidadG: null,
      agregadoEn: HOY,
      origen: 'compra',
    })
    abrir()

    expect(screen.getByText(/Kefir de la tienda de abajo/)).toBeTruthy()
    expect(screen.getByText(/lo está revisando el equipo/i)).toBeTruthy()
  })

  describe('cuando la despensa se queda vieja', () => {
    it('avisa si pasó más de un ciclo de compra sin tocarla', () => {
      // Sin este aviso, la despensa sigue diciendo lo de hace tres semanas y el
      // plan propone comida que ya no está. El ciclo sale de lo que la persona
      // contestó en la encuesta (`cicloCompra`, PR #52).
      db.perfilNutricion.guardar(VALENTINA, { cicloCompra: '8' }, true)
      db.despensa.agregar(VALENTINA, {
        alimentoId: 'arroz-blanco-cocido',
        cantidadG: null,
        agregadoEn: '2026-01-01',
        origen: 'compra',
      })
      abrir()

      expect(screen.getByText(/lleva más de un ciclo de compra sin tocarse/i)).toBeTruthy()
    })

    it('pero una despensa recién estrenada NO está vieja', () => {
      // Una despensa vacía no está vieja, está sin estrenar. Decir que sí le
      // reclamaría una actualización a quien todavía no ha hecho su compra.
      db.perfilNutricion.guardar(VALENTINA, { cicloCompra: '8' }, true)
      abrir()

      expect(screen.queryByText(/lleva más de un ciclo/i)).toBeNull()
    })
  })
})
