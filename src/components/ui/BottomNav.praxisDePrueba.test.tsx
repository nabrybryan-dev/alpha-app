import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { reiniciarOrganizacionViva, useOrganizacionVisible } from '../../app/organizacionViva'
import { CUENTAS_CON_DISENO_FINAL, praxisDePruebaPara } from '../../domain/praxis/rapidezLocal'
import { BottomNav } from './BottomNav'

const [PERSONAL] = [...CUENTAS_CON_DISENO_FINAL]
const OTRA = '00000000-0000-0000-0000-0000000000cc'

function Barra({ usuarioId }: { usuarioId: string }) {
  useOrganizacionVisible(usuarioId)
  return <MemoryRouter><BottomNav /></MemoryRouter>
}
const etiquetas = () => Array.from(document.querySelectorAll('nav a, nav button')).map((e) => e.textContent?.trim())

afterEach(() => reiniciarOrganizacionViva())

describe('Praxis de prueba en la barra de un asesorado', () => {
  it('solo la cuenta de prueba la tiene; los asesorados de verdad no', () => {
    expect(praxisDePruebaPara(PERSONAL!)).toBe(true)
    expect(praxisDePruebaPara(OTRA)).toBe(false)
    expect(praxisDePruebaPara(null)).toBe(false)
  })

  it('la cuenta de prueba ve Praxis en el centro de su barra, como botón (no como enlace)', () => {
    render(<Barra usuarioId={PERSONAL!} />)
    const e = etiquetas()
    expect(e).toContain('Praxis')
    expect(e[0]).toBe('Hoy')
    expect(e.indexOf('Praxis')).toBe(2)
    expect(e).toEqual(['Hoy', 'Entrenar', 'Praxis', 'Semana', 'Nutrición', 'Progreso'])
    expect(screen.getByRole('button', { name: /praxis/i })).toBeInTheDocument()
  })

  it('un asesorado cualquiera no ve Praxis en su barra', () => {
    render(<Barra usuarioId={OTRA} />)
    expect(etiquetas()).not.toContain('Praxis')
  })
})
