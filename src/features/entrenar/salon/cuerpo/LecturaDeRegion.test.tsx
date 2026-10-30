import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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

describe('LecturaDeRegion: el dedo elige en el cuerpo, esto solo lee', () => {
  it('con muchas regiones no pinta botones: Bryan los vio tapando las piernas (30-oct)', () => {
    render(<LecturaDeRegion series={{ dors: 2, bic: 1, glu: 2, cua: 1, isq: 3, gem: 1 }} rango="hoy" elegida={null} />)
    expect(screen.queryAllByRole('button')).toEqual([])
  })
  it('sin elegir, dice que se puede tocar el músculo', () => {
    render(<LecturaDeRegion series={{ dors: 2 }} rango="hoy" elegida={null} />)
    expect(screen.getByRole('status').textContent).toBe('Toca un músculo para leer su cuenta')
  })
  it('con una región elegida dice su cuenta y sigue al rango', () => {
    const { rerender } = render(<LecturaDeRegion series={{ dors: 2 }} rango="hoy" elegida="dors" />)
    expect(screen.getByRole('status').textContent).toBe('Dorsal · 2 series hoy')
    rerender(<LecturaDeRegion series={{ dors: 5 }} rango="semana" elegida="dors" />)
    expect(screen.getByRole('status').textContent).toBe('Dorsal · 5 series esta semana')
  })
  it('una región elegida que se quedó sin series no inventa cifra', () => {
    render(<LecturaDeRegion series={{ bic: 1 }} rango="hoy" elegida="dors" />)
    expect(screen.getByRole('status').textContent).toBe('Toca un músculo para leer su cuenta')
  })
})

it('la portada no trae botones de región: la lista completa sigue en «Ver series por región»', () => {
  const p: PortadaDelCuerpoProps = {
    vista: 'cuerpo', capa: 'musculo', rango: 'hoy', series: { dors: 2 }, doloridas: [],
    alCambiarCapa: () => {}, alCambiarRango: () => {}, alCambiarVista: () => {},
  }
  render(<PortadaDelCuerpo {...p} />)
  expect(screen.queryByRole('button', { name: 'Dorsal' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Ver series por región' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

it('«Dar la vuelta» va con las capas, redondo, como en la maqueta', () => {
  const p: PortadaDelCuerpoProps = {
    vista: 'cuerpo', capa: 'musculo', rango: 'hoy', series: {}, doloridas: [],
    alCambiarCapa: () => {}, alCambiarRango: () => {}, alCambiarVista: () => {}, azimutDelCuerpo: 0, alDarLaVuelta: () => {},
  }
  render(<PortadaDelCuerpo {...p} />)
  const vuelta = screen.getByRole('button', { name: /Dar la vuelta/ })
  expect(vuelta.parentElement?.querySelector('[aria-label="Capas del cuerpo"]')).not.toBeNull()
  expect(vuelta.textContent).toBe('')
})
