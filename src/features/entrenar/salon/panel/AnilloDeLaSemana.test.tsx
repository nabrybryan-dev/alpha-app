import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { reiniciarOrganizacionViva, useOrganizacionVisible } from '../../../../app/organizacionViva'
import { CUENTAS_CON_DISENO_FINAL } from '../../../../domain/praxis/rapidezLocal'
import { AnilloDeLaSemana } from './AnilloDeLaSemana'

/**
 * El anillo de sesiones de la semana en Entrenar (maqueta 6, `.anillo` «3 de 5 sesiones hechas esta semana»), pedido
 * por Bryan el 13-nov-2026. Un arco por sesión programada: plata las hechas, rojo la de hoy si falta, pista el resto.
 * Solo para las cuentas con el diseño final.
 */
const [PERSONAL] = [...CUENTAS_CON_DISENO_FINAL]
const OTRA = '00000000-0000-0000-0000-0000000000cc'

function Con({ usuarioId, completadas, programadas, hoyPendiente }: { usuarioId: string; completadas: number; programadas: number; hoyPendiente: boolean }) {
  useOrganizacionVisible(usuarioId)
  return <AnilloDeLaSemana completadas={completadas} programadas={programadas} hoyPendiente={hoyPendiente} />
}
const trazos = (tipo: string) => document.querySelectorAll(`[data-trazo="${tipo}"]`).length

afterEach(() => reiniciarOrganizacionViva())

describe('el anillo de la semana', () => {
  it('3 de 5 con la de hoy pendiente: 3 plata, 1 roja, 1 pista, y lo dice entero', () => {
    render(<Con usuarioId={PERSONAL!} completadas={3} programadas={5} hoyPendiente />)
    expect(trazos('hecha')).toBe(3)
    expect(trazos('hoy')).toBe(1)
    expect(trazos('pendiente')).toBe(1)
    expect(screen.getByRole('img', { name: '3 de 5 sesiones hechas esta semana' })).toBeInTheDocument()
    expect(screen.getByText('sesiones')).toBeInTheDocument()
  })

  it('sin sesión hoy no hay arco rojo', () => {
    render(<Con usuarioId={PERSONAL!} completadas={2} programadas={4} hoyPendiente={false} />)
    expect(trazos('hecha')).toBe(2)
    expect(trazos('hoy')).toBe(0)
    expect(trazos('pendiente')).toBe(2)
  })

  it('semana completa: todos plata', () => {
    render(<Con usuarioId={PERSONAL!} completadas={4} programadas={4} hoyPendiente={false} />)
    expect(trazos('hecha')).toBe(4)
    expect(trazos('pendiente') + trazos('hoy')).toBe(0)
  })

  it('sin sesiones programadas no se dibuja', () => {
    const { container } = render(<Con usuarioId={PERSONAL!} completadas={0} programadas={0} hoyPendiente={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('otra cuenta no lo ve', () => {
    const { container } = render(<Con usuarioId={OTRA} completadas={3} programadas={5} hoyPendiente />)
    expect(container.innerHTML).toBe('')
  })
})
