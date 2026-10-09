import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PantallaCompleta } from './PantallaCompleta'

function Prueba({ alCerrar = () => {} }: { alCerrar?: () => void }) {
  const [abierta, setAbierta] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setAbierta(true)}>
        Abrir
      </button>
      {abierta && (
        <PantallaCompleta
          titulo="Presentación de Karin"
          onCerrar={() => {
            alCerrar()
            setAbierta(false)
          }}
        >
          <button type="button">Dentro</button>
        </PantallaCompleta>
      )}
    </>
  )
}

describe('PantallaCompleta', () => {
  it('es un diálogo modal con nombre, y Escape lo cierra', async () => {
    const user = userEvent.setup()
    render(<Prueba />)
    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    const dialogo = screen.getByRole('dialog', { name: 'Presentación de Karin' })
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('el botón «Cerrar» lo cierra y mide 44 px como mínimo', async () => {
    const alCerrar = vi.fn()
    const user = userEvent.setup()
    render(<Prueba alCerrar={alCerrar} />)
    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    const cerrar = screen.getByRole('button', { name: 'Cerrar' })
    expect(cerrar).toHaveClass('h-11')
    await user.click(cerrar)
    expect(alCerrar).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('mientras está abierto bloquea el desplazamiento del fondo y al cerrar lo devuelve', async () => {
    document.body.style.overflow = 'auto'
    const user = userEvent.setup()
    render(<Prueba />)
    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    expect(document.body.style.overflow).toBe('hidden')
    await user.keyboard('{Escape}')
    expect(document.body.style.overflow).toBe('auto')
  })

  it('el foco entra al abrir, se queda dentro con Tab y vuelve al botón que lo abrió', async () => {
    const user = userEvent.setup()
    render(<Prueba />)
    const abrir = screen.getByRole('button', { name: 'Abrir' })
    await user.click(abrir)
    const dialogo = screen.getByRole('dialog')
    expect(dialogo).toHaveFocus()
    // Dentro hay dos enfocables: «Cerrar» y «Dentro». Tab da la vuelta sin salir.
    await user.tab()
    await user.tab()
    await user.tab()
    expect(dialogo.contains(document.activeElement)).toBe(true)
    await user.keyboard('{Escape}')
    expect(abrir).toHaveFocus()
  })

  it('mide con dvh y respeta las zonas seguras', async () => {
    const user = userEvent.setup()
    render(<Prueba />)
    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    const dialogo = screen.getByRole('dialog')
    expect(dialogo.style.height).toBe('100dvh')
    expect(dialogo.innerHTML).toContain('safe-area-inset-top')
    expect(dialogo.innerHTML).toContain('safe-area-inset-bottom')
  })
})
