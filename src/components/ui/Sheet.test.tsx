import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

/**
 * PASO 1 DEL REDISEÑO: la hoja de la maqueta 7. Escape, foco atrapado, `aria-modal`, arrastrar para cerrar y
 * animación de salida. Los archivos que la usan no cambian una línea: todo esto lo pone el primitivo.
 */
describe('la hoja: accesibilidad', () => {
  it('es modal para los lectores de pantalla', () => {
    abrir()
    expect(screen.getByRole('dialog', { name: 'Un panel' })).toHaveAttribute('aria-modal', 'true')
  })

  it('Escape la cierra, y solo mientras está abierta', async () => {
    const usuario = userEvent.setup()
    const cerrar = vi.fn()
    const { rerender } = abrir({ onCerrar: cerrar })
    await usuario.keyboard('{Escape}')
    expect(cerrar).toHaveBeenCalledTimes(1)
    rerender(
      <Sheet abierto={false} titulo="Un panel" onCerrar={cerrar}>
        <p>contenido</p>
      </Sheet>,
    )
    await usuario.keyboard('{Escape}')
    expect(cerrar).toHaveBeenCalledTimes(1)
  })

  it('al abrir, el foco entra en la hoja; no se queda en lo de atrás', () => {
    render(
      <>
        <button type="button">Detrás</button>
        <Sheet abierto titulo="Un panel" onCerrar={vi.fn()}>
          <p>contenido</p>
        </Sheet>
      </>,
    )
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  })

  it('el foco queda atrapado: Tab y Shift+Tab dan la vuelta DENTRO de la hoja', async () => {
    const usuario = userEvent.setup()
    render(
      <>
        <button type="button">Detrás</button>
        <Sheet abierto titulo="Un panel" onCerrar={vi.fn()}>
          <input aria-label="Uno" />
          <input aria-label="Dos" />
        </Sheet>
      </>,
    )
    const dialogo = screen.getByRole('dialog')
    for (let i = 0; i < 8; i++) {
      await usuario.tab()
      expect(dialogo.contains(document.activeElement), `Tab ${i + 1}`).toBe(true)
    }
    for (let i = 0; i < 8; i++) {
      await usuario.tab({ shift: true })
      expect(dialogo.contains(document.activeElement), `Shift+Tab ${i + 1}`).toBe(true)
    }
  })

  it('si el foco se escapa por la fuerza, vuelve a la hoja', () => {
    render(
      <>
        <button type="button">Detrás</button>
        <Sheet abierto titulo="Un panel" onCerrar={vi.fn()}>
          <p>contenido</p>
        </Sheet>
      </>,
    )
    act(() => screen.getByRole('button', { name: 'Detrás' }).focus())
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  })

  it('al cerrar, el foco vuelve a quien la abrió', () => {
    function Con({ abierto }: { abierto: boolean }) {
      return (
        <>
          <button type="button">Abrir</button>
          <Sheet abierto={abierto} titulo="Un panel" onCerrar={vi.fn()}>
            <p>contenido</p>
          </Sheet>
        </>
      )
    }
    const { rerender } = render(<Con abierto={false} />)
    screen.getByRole('button', { name: 'Abrir' }).focus()
    rerender(<Con abierto />)
    expect(screen.getByRole('button', { name: 'Abrir' })).not.toHaveFocus()
    rerender(<Con abierto={false} />)
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus()
  })

  it('respeta un campo que ya se había quedado con el foco (autoFocus del contenido)', () => {
    render(
      <Sheet abierto titulo="Un panel" onCerrar={vi.fn()}>
        <input aria-label="Buscar" autoFocus />
      </Sheet>,
    )
    expect(screen.getByRole('textbox', { name: 'Buscar' })).toHaveFocus()
  })
})

/** jsdom no trae `PointerEvent` con coordenadas: un `MouseEvent` con el tipo de puntero y su `pointerId`. */
function puntero(el: Element, tipo: 'pointerdown' | 'pointermove' | 'pointerup', clientY: number) {
  const evento = new MouseEvent(tipo, { bubbles: true, cancelable: true, clientY })
  Object.defineProperty(evento, 'pointerId', { value: 1 })
  act(() => void el.dispatchEvent(evento))
}

describe('la hoja: arrastrar para cerrar', () => {
  const asa = () => screen.getByTestId('asa-de-la-hoja')

  it('un arrastre largo hacia abajo la cierra', () => {
    const cerrar = vi.fn()
    abrir({ onCerrar: cerrar })
    puntero(asa(), 'pointerdown', 100)
    puntero(asa(), 'pointermove', 180)
    puntero(asa(), 'pointermove', 320)
    puntero(asa(), 'pointerup', 320)
    expect(cerrar).toHaveBeenCalledTimes(1)
  })

  it('uno corto no la cierra y la hoja vuelve a su sitio', () => {
    const cerrar = vi.fn()
    abrir({ onCerrar: cerrar })
    const panel = screen.getByTestId('panel-de-la-hoja')
    puntero(asa(), 'pointerdown', 100)
    puntero(asa(), 'pointermove', 130)
    expect(panel.style.transform).toBe('translateY(30px)')
    puntero(asa(), 'pointerup', 130)
    expect(cerrar).not.toHaveBeenCalled()
    expect(panel.style.transform).toBe('')
  })

  it('hacia arriba no se mueve (la hoja no se despega por arriba)', () => {
    abrir()
    const panel = screen.getByTestId('panel-de-la-hoja')
    puntero(asa(), 'pointerdown', 200)
    puntero(asa(), 'pointermove', 120)
    expect(panel.style.transform).toBe('translateY(0px)')
  })

  it('tocar el aspa NO empieza un arrastre', () => {
    const cerrar = vi.fn()
    abrir({ onCerrar: cerrar })
    const aspa = screen.getByRole('button', { name: 'Cerrar panel' })
    puntero(aspa, 'pointerdown', 10)
    puntero(aspa, 'pointermove', 400)
    puntero(aspa, 'pointerup', 400)
    expect(cerrar).not.toHaveBeenCalled()
  })
})

describe('la hoja: animación de salida', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function conMatchMedia(reducido: boolean) {
    vi.stubGlobal('matchMedia', (consulta: string) => ({
      matches: reducido && consulta.includes('reduce'),
      media: consulta,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  }

  function ciclo() {
    const r = render(
      <Sheet abierto titulo="Un panel" onCerrar={vi.fn()}>
        <p>contenido</p>
      </Sheet>,
    )
    const cerrar = () =>
      r.rerender(
        <Sheet abierto={false} titulo="Un panel" onCerrar={vi.fn()}>
          <p>contenido</p>
        </Sheet>,
      )
    return { ...r, cerrar }
  }

  it('al cerrar, la hoja y el atenuador se despiden antes de irse, y no se pueden tocar', () => {
    vi.useFakeTimers()
    conMatchMedia(false)
    const { container, cerrar } = ciclo()
    cerrar()
    const dialogo = screen.getByRole('dialog', { hidden: true })
    expect(container.querySelector('.bajar-hoja')).toBeTruthy()
    expect(container.querySelector('.scrim-sale')).toBeTruthy()
    expect(dialogo).toHaveAttribute('aria-hidden', 'true')
    act(() => void vi.advanceTimersByTime(300))
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull()
  })

  it('si se reabre mientras se despide, se queda', () => {
    vi.useFakeTimers()
    conMatchMedia(false)
    const { rerender, cerrar } = ciclo()
    cerrar()
    rerender(
      <Sheet abierto titulo="Un panel" onCerrar={vi.fn()}>
        <p>contenido</p>
      </Sheet>,
    )
    act(() => void vi.advanceTimersByTime(300))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('con movimiento reducido, o con animar={false}, se va de golpe', () => {
    conMatchMedia(true)
    const a = ciclo()
    a.cerrar()
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull()
    a.unmount()
    conMatchMedia(false)
    const b = render(
      <Sheet abierto titulo="Un panel" onCerrar={vi.fn()} animar={false}>
        <p>contenido</p>
      </Sheet>,
    )
    b.rerender(
      <Sheet abierto={false} titulo="Un panel" onCerrar={vi.fn()} animar={false}>
        <p>contenido</p>
      </Sheet>,
    )
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull()
  })
})
