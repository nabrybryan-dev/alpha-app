import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { cuentaDeRegion } from './cuentaDeRegion'
import { LecturaDeRegion } from './LecturaDeRegion'
import { PortadaDelCuerpo, type PortadaDelCuerpoProps } from './PortadaDelCuerpo'

describe('cuentaDeRegion: lo que dice una región tocada', () => {
  it('hoy: «Dorsal · 2 series hoy»', () => {
    expect(cuentaDeRegion('dors', { dors: 2 }, 'hoy')).toBe('Dorsal · 2 series hoy')
  })
  it('una sola serie va en singular y la semana lo dice', () => {
    expect(cuentaDeRegion('bic', { bic: 1 }, 'semana')).toBe('Bíceps · 1 serie esta semana')
  })
  it('media serie usa coma y una región sin series dice cero, no se calla', () => {
    expect(cuentaDeRegion('tri', { tri: 1.5 }, 'hoy')).toBe('Tríceps · 1,5 series hoy')
    expect(cuentaDeRegion('glu', {}, 'semana')).toBe('Glúteo · 0 series esta semana')
  })
})

describe('LecturaDeRegion: tocar una región lee su cuenta', () => {
  it('cada región con series es un botón; al tocarla dice su cuenta y se puede soltar', () => {
    render(<LecturaDeRegion series={{ dors: 2, bic: 1 }} rango="hoy" />)
    expect(screen.queryByRole('status')?.textContent ?? '').toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Dorsal' }))
    expect(screen.getByRole('status').textContent).toBe('Dorsal · 2 series hoy')
    expect(screen.getByRole('button', { name: 'Dorsal' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Dorsal' }))
    expect(screen.getByRole('status').textContent).toBe('')
  })
  it('al cambiar a Semana la cuenta de la región elegida cambia con ella', () => {
    const { rerender } = render(<LecturaDeRegion series={{ dors: 2 }} rango="hoy" />)
    fireEvent.click(screen.getByRole('button', { name: 'Dorsal' }))
    rerender(<LecturaDeRegion series={{ dors: 5 }} rango="semana" />)
    expect(screen.getByRole('status').textContent).toBe('Dorsal · 5 series esta semana')
  })
  it('si la portada decide la región (toque sobre el cuerpo), la lectura la dice igual que con el botón', () => {
    const { rerender } = render(<LecturaDeRegion series={{ dors: 2, bic: 1 }} rango="hoy" elegida="dors" />)
    expect(screen.getByRole('status').textContent).toBe('Dorsal · 2 series hoy')
    expect(screen.getByRole('button', { name: 'Dorsal' })).toHaveAttribute('aria-pressed', 'true')
    rerender(<LecturaDeRegion series={{ dors: 2, bic: 1 }} rango="hoy" elegida={null} />)
    expect(screen.getByRole('status').textContent).toBe('')
  })
  it('tocar un botón avisa a quien decide, para que el cuerpo y los botones digan lo mismo', () => {
    const alElegir = vi.fn()
    render(<LecturaDeRegion series={{ dors: 2 }} rango="hoy" elegida={null} alElegir={alElegir} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dorsal' }))
    expect(alElegir).toHaveBeenCalledWith('dors')
  })
  it('sin series no pinta botones', () => {
    render(<LecturaDeRegion series={{}} rango="hoy" />)
    expect(screen.queryAllByRole('button')).toEqual([])
  })
})

it('la portada trae las regiones tocables en la vista de cuerpo', () => {
  const p: PortadaDelCuerpoProps = {
    vista: 'cuerpo', capa: 'musculo', rango: 'hoy', series: { dors: 2 }, doloridas: [],
    alCambiarCapa: () => {}, alCambiarRango: () => {}, alCambiarVista: () => {},
  }
  render(<PortadaDelCuerpo {...p} />)
  fireEvent.click(screen.getByRole('button', { name: 'Dorsal' }))
  expect(screen.getByRole('status').textContent).toBe('Dorsal · 2 series hoy')
})
