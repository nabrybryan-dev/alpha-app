import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import MiPlan from './MiPlan'
import { CompuertaNutricion } from './CompuertaNutricion'
import { SessionProvider } from '../../app/SessionProvider'
import { reiniciarDb } from '../../data/mockDb'
import { db } from '../../data/dbInstance'
import { MI_MERCADO_MAQUETA } from './banderas'

/**
 * C5: «Mi mercado» de la maqueta sobre la despensa que ya existe.
 * Apagada = la pestaña Mercado de siempre. Encendida = la tarjeta nueva, con la
 * despensa de Valentina (seed ficticio). No hay tabla nueva: todo va a `db.despensa`.
 */

const VALENTINA = 'u-valentina'
const HOY = new Date().toISOString().slice(0, 10)

const pintar = (mercadoMaqueta?: boolean) =>
  render(
    <MemoryRouter initialEntries={['/nutricion/plan']}>
      <SessionProvider>
        <CompuertaNutricion>
          <Routes>
            <Route path="/nutricion/plan" element={<MiPlan mercadoMaqueta={mercadoMaqueta} />} />
          </Routes>
        </CompuertaNutricion>
      </SessionProvider>
    </MemoryRouter>,
  )

const irAMercado = () => userEvent.click(screen.getByRole('button', { name: 'Mercado' }))

beforeEach(() => {
  localStorage.clear()
  reiniciarDb()
  for (const item of db.despensa.byUsuario(VALENTINA)) {
    db.despensa.quitar(VALENTINA, item.alimentoId ?? `pedido:${(item.textoPedido ?? '').toLowerCase()}`)
  }
})

describe('la bandera', () => {
  it('viene apagada', () => {
    expect(MI_MERCADO_MAQUETA).toBe(false)
  })
})

describe('apagada: la pestaña Mercado queda como hoy', () => {
  it('muestra «Mercado de 15 días» y no la tarjeta nueva', async () => {
    pintar()
    await irAMercado()
    expect(screen.getByRole('heading', { name: 'Mercado de 15 días' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Mi mercado' })).toBeNull()
    expect(screen.getByText('Huevos (30)')).toBeInTheDocument()
  })
})

describe('encendida: Mi mercado sobre la despensa existente', () => {
  it('pinta las líneas del plan y la despensa vacía', async () => {
    pintar(true)
    await irAMercado()
    expect(screen.getByRole('region', { name: 'Mi mercado' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Mercado de 15 días' })).toBeNull()
    expect(screen.getByRole('switch', { name: 'Compré Huevos (30)' })).toBeInTheDocument()
    expect(screen.getByText('Todavía nada.')).toBeInTheDocument()
  })

  it('marcar una línea y elegir un alimento lo mete en la despensa de Valentina, sin cantidad', async () => {
    pintar(true)
    await irAMercado()
    await userEvent.click(screen.getByRole('switch', { name: 'Compré Avena (1 kg)' }))
    const [primero] = screen.getAllByRole('button', { pressed: false }).filter((b) =>
      /avena/i.test(b.textContent ?? ''),
    )
    await userEvent.click(primero)
    const suya = db.despensa.byUsuario(VALENTINA)
    expect(suya).toHaveLength(1)
    expect(suya[0].cantidadG).toBeNull()
    expect(suya[0].origen).toBe('compra')
  })

  it('enseña lo que ya había en la despensa y «Se acabó» lo saca', async () => {
    db.despensa.agregar(VALENTINA, {
      alimentoId: 'arroz-blanco-cocido',
      cantidadG: null,
      agregadoEn: HOY,
      origen: 'compra',
    })
    pintar(true)
    await irAMercado()
    expect(screen.queryByText('Todavía nada.')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /^Quitar / }))
    expect(db.despensa.byUsuario(VALENTINA)).toHaveLength(0)
  })

  it('lo que no está en el catálogo se pide: entra «sin datos» y sin alimentoId', async () => {
    pintar(true)
    await irAMercado()
    await userEvent.type(screen.getByLabelText('Añadir algo que ya tenías'), 'zzqxkef')
    await userEvent.click(screen.getByRole('button', { name: 'No está: pedirlo' }))
    const suya = db.despensa.byUsuario(VALENTINA)
    expect(suya).toHaveLength(1)
    expect(suya[0].alimentoId).toBeNull()
    expect(suya[0].textoPedido).toBe('Zzqxkef')
    expect(screen.getByText('sin datos')).toBeInTheDocument()
  })

  it('aislamiento: la despensa de otra persona no aparece ni se toca', async () => {
    db.despensa.agregar('u-mateo', {
      alimentoId: null,
      textoPedido: 'Solo de Mateo',
      cantidadG: null,
      agregadoEn: HOY,
      origen: 'ya_tenia',
    })
    pintar(true)
    await irAMercado()
    expect(screen.queryByText(/Solo de Mateo/)).toBeNull()
    expect(screen.getByText('Todavía nada.')).toBeInTheDocument()
    expect(db.despensa.byUsuario('u-mateo')).toHaveLength(1)
  })
})
