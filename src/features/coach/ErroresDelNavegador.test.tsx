/**
 * El panel de errores del navegador que ve el coach.
 *
 * Tiene que decir en una línea lo que el 10-sep nadie supo: «este mensaje, a tantas personas,
 * tantas veces». Y callarse cuando no hay nada que contar, o cuando la app corre en demo.
 * Los datos son inventados: ni un nombre, solo ids de prueba.
 */
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FilaErrorLeida } from './erroresNube'

const nube = { activo: true }
const lectura: { filas: FilaErrorLeida[]; fallo?: Error } = { filas: [] }

vi.mock('../../data/supabase', () => ({
  get modoNube() {
    return nube.activo
  },
  supabase: () => {
    throw new Error('el panel no debe hablar con Supabase sin pasar por erroresNube')
  },
}))

vi.mock('./erroresNube', async () => {
  const real = await vi.importActual<typeof import('./erroresNube')>('./erroresNube')
  return {
    ...real,
    leerErroresRecientes: async () => {
      if (lectura.fallo) throw lectura.fallo
      return lectura.filas
    },
  }
})

const { ErroresDelNavegador } = await import('./ErroresDelNavegador')
const { TablaSinAplicar } = await import('./erroresNube')

beforeEach(() => {
  nube.activo = true
  lectura.filas = []
  lectura.fallo = undefined
})

describe('ErroresDelNavegador', () => {
  it('agrupa por mensaje y dice cuántas veces y a cuántas personas', async () => {
    lectura.filas = [
      { usuario_id: 'u1', creado_en: '2026-09-11T09:30:00Z', mensaje: '[42883] operator does not exist: boolean = text' },
      { usuario_id: 'u2', creado_en: '2026-09-10T08:00:00Z', mensaje: '[42883] operator does not exist: boolean = text' },
      { usuario_id: 'u1', creado_en: '2026-09-10T07:00:00Z', mensaje: '[42883] operator does not exist: boolean = text' },
    ]
    render(<ErroresDelNavegador />)

    expect(await screen.findByText('[42883] operator does not exist: boolean = text')).toBeInTheDocument()
    expect(screen.getByText(/2 personas · 3 veces/)).toBeInTheDocument()
  })

  it('sin errores en la semana no pinta nada', async () => {
    const { container } = render(<ErroresDelNavegador />)
    // Da tiempo a que la lectura resuelva antes de afirmar que no hay nada.
    await new Promise((r) => setTimeout(r, 20))
    expect(container).toBeEmptyDOMElement()
  })

  it('en modo demo no pinta nada', async () => {
    nube.activo = false
    lectura.filas = [{ usuario_id: 'u1', creado_en: '2026-09-11T09:30:00Z', mensaje: 'no debería verse' }]
    const { container } = render(<ErroresDelNavegador />)
    await new Promise((r) => setTimeout(r, 20))
    expect(container).toBeEmptyDOMElement()
  })

  it('con la 0078 sin aplicar lo dice, en vez de callarse', async () => {
    lectura.fallo = new TablaSinAplicar()
    render(<ErroresDelNavegador />)
    expect(await screen.findByText(/falta aplicar la migración 0078/)).toBeInTheDocument()
  })
})
