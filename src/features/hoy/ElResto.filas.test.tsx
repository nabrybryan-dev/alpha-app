import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ElResto } from './ElResto'

/**
 * «El resto» de Hoy como en «Alpha · Rediseño» (maqueta 7, `salida.html:1330-1343`): el botón dice «Tu bloque, logros,
 * álbum, radar y contenidos» y dentro hay filas «Logros» y «Mapa de fatiga» que llevan a donde vive cada cosa. Solo con
 * el diseño final; las demás cuentas, como siempre.
 */
const pintar = (disenoFinal: boolean) =>
  render(
    <MemoryRouter>
      <ElResto disenoFinal={disenoFinal}>
        <p>pieza de siempre</p>
      </ElResto>
    </MemoryRouter>,
  )

describe('«El resto» con las filas de la maqueta', () => {
  it('el botón nombra los logros y, abierto, trae las dos filas con su destino', async () => {
    pintar(true)
    const boton = screen.getByRole('button', { name: /Tu bloque, logros, álbum, radar y contenidos/ })
    await userEvent.click(boton)
    expect(screen.getByRole('link', { name: /Logros/ })).toHaveAttribute('href', '/logros')
    expect(screen.getByRole('link', { name: /Mapa de fatiga/ })).toHaveAttribute('href', '/progreso')
    expect(screen.getByText('pieza de siempre')).toBeInTheDocument()
  })

  it('cerrado, las filas no se ven', () => {
    pintar(true)
    expect(screen.queryByRole('link', { name: /Mapa de fatiga/ })).not.toBeInTheDocument()
  })

  it('sin el diseño final, el botón y el contenido de siempre, sin filas nuevas', async () => {
    pintar(false)
    const boton = screen.getByRole('button', { name: /Tu bloque, cifras, álbum, radar y contenidos/ })
    await userEvent.click(boton)
    expect(screen.queryByRole('link', { name: /Mapa de fatiga/ })).not.toBeInTheDocument()
  })
})
