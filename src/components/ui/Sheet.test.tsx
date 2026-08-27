import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Sheet } from './Sheet'

/**
 * La hoja es un primitivo compartido por **once pantallas** —generar microciclo,
 * cuestionarios, la hoja de medición del encoder, las demos de la sesión y cinco
 * de nutrición—, y no tenía tests propios. Cualquier cosa que se rompa aquí se
 * rompe en las once a la vez.
 *
 * Lo que fijan estos: que siga siendo un diálogo cerrable, y que la entrada la
 * ponga el primitivo y no cada consumidor por su cuenta — que es exactamente
 * como estaba antes, con dos hermanos animándose a mano y nueve sin nada.
 */

function abrir(props: Partial<Parameters<typeof Sheet>[0]> = {}) {
  return render(
    <Sheet abierto titulo="Un panel" onCerrar={vi.fn()} {...props}>
      <p>contenido</p>
    </Sheet>,
  )
}

describe('la hoja', () => {
  it('cerrada no pinta nada', () => {
    const { container } = render(
      <Sheet abierto={false} titulo="Un panel" onCerrar={vi.fn()}>
        <p>contenido</p>
      </Sheet>,
    )
    expect(container.firstChild).toBeNull()
  })

  it('abierta es un diálogo con su título y su contenido', () => {
    abrir()
    expect(screen.getByRole('dialog', { name: 'Un panel' })).toBeInTheDocument()
    expect(screen.getByText('contenido')).toBeInTheDocument()
  })

  it('se cierra por el atenuador y por el aspa', async () => {
    // Dos salidas, y las dos importan: el aspa se ve, y tocar fuera es el gesto
    // que la gente hace sin pensar.
    const usuario = userEvent.setup()
    const cerrar = vi.fn()
    abrir({ onCerrar: cerrar })

    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }))
    await usuario.click(screen.getByRole('button', { name: 'Cerrar panel' }))

    expect(cerrar).toHaveBeenCalledTimes(2)
  })

  it('la entrada la pone el PRIMITIVO, no cada consumidor', () => {
    // Es lo que se arregló: `if (!abierto) return null` hacía que el atenuador y
    // el panel aparecieran en un fotograma, en las once pantallas. Los dos
    // hermanos que sí se movían lo tenían escrito a mano cada uno por su lado.
    const { container } = abrir()
    expect(container.querySelector('.scrim-entra')).toBeTruthy()
    expect(container.querySelector('.subir-hoja')).toBeTruthy()
  })
})
