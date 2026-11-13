import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { reiniciarOrganizacionViva, useOrganizacionVisible } from '../../app/organizacionViva'
import { CUENTAS_CON_DISENO_FINAL } from '../../domain/praxis/rapidezLocal'
import { BottomNav } from './BottomNav'

/**
 * La barra de los dos diseños que Bryan validó (13-nov-2026): «Alpha · Rediseño» (de borde a borde, vidrio,
 * raya roja de 34×3 sobre la pestaña activa) y «Praxis a un toque» (el agujero negro que sobresale al centro).
 * Solo la ven las cuentas con el diseño final; el resto conserva la píldora flotante sin un solo cambio.
 */
const [PERSONAL] = [...CUENTAS_CON_DISENO_FINAL]
const OTRA = '00000000-0000-0000-0000-0000000000cc'

function Barra({ usuarioId }: { usuarioId: string }) {
  useOrganizacionVisible(usuarioId)
  return <MemoryRouter><BottomNav /></MemoryRouter>
}
const nav = () => screen.getByRole('navigation', { name: 'Navegación principal' })

afterEach(() => reiniciarOrganizacionViva())

describe('la barra de la maqueta', () => {
  it('con el diseño final va pegada abajo y de borde a borde, sin la píldora flotante', () => {
    render(<Barra usuarioId={PERSONAL!} />)
    expect(nav().dataset.piel).toBe('maqueta')
    expect(nav().className).toContain('bottom-0')
    expect(nav().querySelector('.rounded-full.glass')).toBeNull()
    expect(nav().querySelector('[class*="max-w-[24rem]"]')).toBeNull()
  })

  it('la pestaña activa lleva la raya roja arriba y las demás no', () => {
    render(<Barra usuarioId={PERSONAL!} />)
    const rayas = nav().querySelectorAll('[data-raya]')
    expect(rayas).toHaveLength(1)
    expect(rayas[0]!.closest('a')?.textContent).toContain('Hoy')
  })

  it('Praxis es el agujero negro que sobresale al centro y sigue siendo un botón con nombre', () => {
    render(<Barra usuarioId={PERSONAL!} />)
    const boton = screen.getByRole('button', { name: /praxis/i })
    expect(boton.dataset.piel).toBe('maqueta')
    expect(boton.querySelector('[data-hoyo]')).not.toBeNull()
    expect(boton.textContent).toContain('Praxis')
  })

  it('una cuenta sin el diseño final conserva la píldora de siempre', () => {
    render(<Barra usuarioId={OTRA} />)
    expect(nav().dataset.piel).toBeUndefined()
    expect(nav().className).toBe('fixed inset-x-0 flex justify-center px-3')
    expect(nav().querySelector('.rounded-full.glass')).not.toBeNull()
    expect(nav().querySelector('[data-raya]')).toBeNull()
  })
})
