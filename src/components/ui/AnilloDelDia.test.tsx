import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AnilloDelDia } from './AnilloDelDia'

const trazo = (c: HTMLElement, cual: string) => c.querySelector<SVGCircleElement>(`[data-trazo="${cual}"]`)
const R = 50 - 9 / 2
const LARGO = 2 * Math.PI * R
const arco = (el: SVGCircleElement) => Number(el.getAttribute('stroke-dasharray')!.split(' ')[0])

describe('AnilloDelDia', () => {
  it('0 %: solo la pista, y la cifra dice 0 % (un cero medido es un dato)', () => {
    const { container } = render(<AnilloDelDia hecho={0} etiqueta="0 % del día" />)
    expect(trazo(container, 'pista')).not.toBeNull()
    expect(trazo(container, 'hecho')).toBeNull()
    expect(trazo(container, 'hoy')).toBeNull()
    expect(container.querySelector('.cifra-3d')!.textContent).toBe('0%')
  })

  it('parcial: plata para lo hecho y rojo para hoy, uno a continuacion del otro', () => {
    const { container } = render(<AnilloDelDia hecho={0.5} hoy={0.2} etiqueta="70 % del día" />)
    const plata = trazo(container, 'hecho')!
    const rojo = trazo(container, 'hoy')!
    expect(plata.getAttribute('stroke')).toBe('var(--placa)')
    expect(rojo.getAttribute('stroke')).toBe('var(--rojo)')
    expect(arco(plata)).toBeCloseTo(0.5 * LARGO, 3)
    expect(arco(rojo)).toBeCloseTo(0.2 * LARGO, 3)
    expect(Number(rojo.getAttribute('stroke-dashoffset'))).toBeCloseTo(-0.5 * LARGO, 3)
    expect(plata.getAttribute('stroke-width')).toBe('9')
    expect(container.querySelector('.cifra-3d')!.textContent).toBe('70%')
  })

  it('100 %: los arcos suman la vuelta entera y no la pasan', () => {
    const { container } = render(<AnilloDelDia hecho={0.8} hoy={0.9} etiqueta="100 % del día" />)
    const suma = arco(trazo(container, 'hecho')!) + arco(trazo(container, 'hoy')!)
    expect(suma).toBeCloseTo(LARGO, 3)
    expect(container.querySelector('.cifra-3d')!.textContent).toBe('100%')
  })

  it('sin dato: raya en la cifra y ningun arco, aunque haya "hoy"', () => {
    const { container } = render(<AnilloDelDia hecho={undefined} hoy={0.4} etiqueta="Sin dato del día" />)
    expect(container.querySelector('.cifra-3d')!.textContent).toBe('—')
    expect(trazo(container, 'hecho')).toBeNull()
    expect(trazo(container, 'hoy')).toBeNull()
    expect(screen.getByText('Sin dato del día')).toBeInTheDocument()
  })

  it('valores fuera de rango o NaN se acotan', () => {
    const { container } = render(<AnilloDelDia hecho={Number.NaN} hoy={-1} etiqueta="x" />)
    expect(trazo(container, 'hecho')).toBeNull()
    expect(container.querySelector('.cifra-3d')!.textContent).toBe('0%')
  })

  it('el dibujo va oculto y el lector oye la etiqueta una vez', () => {
    const { container } = render(<AnilloDelDia hecho={0.3} subtitulo="del día" etiqueta="30 % del día" />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getAllByText('30 % del día')).toHaveLength(1)
  })
})
