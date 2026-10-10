import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CheckinDiario } from '../../../../domain/types'
import { SeccionPeso } from './SeccionCuerpo'

/** La serie A del dominio (anonimizada), como check-ins: el 83,35 del 28-sep es el raro. */
const PESOS: [string, number][] = [
  ['09-07', 90.3],
  ['09-08', 90.3],
  ['09-09', 90.3],
  ['09-10', 90.3],
  ['09-11', 89.5],
  ['09-13', 89.5],
  ['09-14', 89.5],
  ['09-16', 89.5],
  ['09-17', 89.3],
  ['09-19', 89.3],
  ['09-21', 89.3],
  ['09-22', 89.3],
  ['09-23', 88.8],
  ['09-25', 88.8],
  ['09-26', 88.35],
  ['09-28', 83.35],
  ['10-01', 87.75],
  ['10-02', 87.75],
]

/**
 * `marcados`: cada reporte dice que la persona movió el peso ese día (`anotadoHoy`), así que todos
 * cuentan aunque se repitan. Sin marca son reportes viejos, y los repetidos seguidos se apartan.
 */
function checkins(pares: readonly [string, number][], marcados: boolean): CheckinDiario[] {
  return pares.map(([f, kg]) => ({
    id: `c-${f}`,
    usuarioId: 'u1',
    fecha: `2026-${f}`,
    pesoKg: kg,
    ...(marcados ? { anotadoHoy: ['pesoKg' as const] } : {}),
  }))
}

function pintar(pares: readonly [string, number][], marcados = true) {
  render(
    <SeccionPeso
      i={0}
      datos={{ hoy: '2026-10-02', checkins: checkins(pares, marcados), perfil: undefined, perfilNutricion: undefined }}
    />,
  )
}

describe('SeccionPeso · peso de hoy estimado', () => {
  it('con la serie larga pinta rango, centro, número de pesajes, último pesaje y tendencia, rotulado como estimado', () => {
    pintar(PESOS)
    const bloque = screen.getByRole('group', { name: 'Peso de hoy, estimado' })
    const texto = bloque.textContent ?? ''
    expect(within(bloque).getByText(/peso de hoy, estimado/i)).toBeInTheDocument()
    expect(texto).toContain('entre 87,2 y 88,6 kg')
    expect(texto).toContain('Centro 87,9 kg')
    expect(texto).toContain('calculado con 17 pesajes')
    expect(texto).toContain('último el 2 oct')
    expect(texto).toContain('baja ≈ 0,7 kg por semana')
    expect(within(bloque).getByText('rango estrecho')).toBeInTheDocument()
    // El borde punteado es lo que lo distingue a simple vista de un dato medido.
    expect(bloque.className).toContain('border-dashed')
  })

  it('con un dato raro lo nombra con su peso y su día', () => {
    pintar(PESOS)
    expect(screen.getByText('1 pesaje apartado por raro: 83,35 kg el 28 sep. Revísalo.')).toBeInTheDocument()
  })

  it('con un solo pesaje avisa del rango ancho y explica por qué no hay tendencia', () => {
    pintar([['09-07', 90.3]])
    const bloque = screen.getByRole('group', { name: 'Peso de hoy, estimado' })
    expect(within(bloque).getByText('rango ancho: faltan pesajes')).toBeInTheDocument()
    expect(bloque.textContent).toContain('calculado con 1 pesaje ·')
    expect(bloque.textContent).toContain('Con menos de 3 pesajes (o menos de una semana de datos) no hay tendencia')
    expect(bloque.textContent).not.toMatch(/por semana|estable/)
    expect(bloque.textContent).toContain('entre 86,5 y 92,5 kg')
  })

  it('una serie plana dice «estable» en vez de inventar una pendiente', () => {
    pintar(['20', '21', '22', '23', '24', '25', '26', '27', '28', '29'].map((d): [string, number] => [`09-${d}`, 75]))
    expect(screen.getByRole('group', { name: 'Peso de hoy, estimado' }).textContent).toContain('estable')
  })

  it('en reportes viejos, sin marca, no cuenta los pesos repetidos del reporte anterior, y lo dice', () => {
    // La misma serie real, tal como está guardada: 18 reportes, pero solo 7 pesos distintos seguidos.
    pintar(PESOS, false)
    const bloque = screen.getByRole('group', { name: 'Peso de hoy, estimado' })
    expect(bloque.textContent).toContain('calculado con 6 pesajes')
    expect(
      screen.getByText('No se contaron 11 pesos repetidos del reporte anterior: no se sabe si se pesó esos días.'),
    ).toBeInTheDocument()
  })

  it('con todos los pesos anotados ese día no avisa de repetidos', () => {
    pintar(PESOS)
    expect(screen.queryByText(/pesos? repetidos? del reporte anterior/)).not.toBeInTheDocument()
  })

  it('sin pesajes no pinta el bloque y deja el texto de «sin ningún peso»', () => {
    pintar([])
    expect(screen.queryByRole('group', { name: 'Peso de hoy, estimado' })).not.toBeInTheDocument()
    expect(screen.queryByText(/estimado/i)).not.toBeInTheDocument()
    expect(screen.getByText('Sin ningún peso registrado')).toBeInTheDocument()
  })

  it('la palabra «estimado» está a la vista, con decimales con coma', () => {
    pintar(PESOS)
    expect(screen.getAllByText(/estimado/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('group', { name: 'Peso de hoy, estimado' }).textContent).not.toMatch(/\d\.\d/)
  })
})
