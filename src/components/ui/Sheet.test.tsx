import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
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

describe('la hoja: umbrales del arrastre (cada rama se ve fallar si se rompe)', () => {
  const asa = () => screen.getByTestId('asa-de-la-hoja')
  /** Suelta tras `ms` milisegundos de arrastre y `dy` píxeles. */
  function arrastrar(dy: number, ms: number) {
    let ahora = 1000
    const reloj = vi.spyOn(performance, 'now').mockImplementation(() => ahora)
    puntero(asa(), 'pointerdown', 100)
    ahora += ms
    puntero(asa(), 'pointermove', 100 + dy)
    puntero(asa(), 'pointerup', 100 + dy)
    reloj.mockRestore()
  }
  afterEach(() => vi.restoreAllMocks())

  it('119 px despacio NO cierra y 121 px despacio SÍ', () => {
    const cerrar = vi.fn()
    const a = abrir({ onCerrar: cerrar })
    arrastrar(119, 5000)
    expect(cerrar).not.toHaveBeenCalled()
    a.unmount()
    const cerrar2 = vi.fn()
    abrir({ onCerrar: cerrar2 })
    arrastrar(121, 5000)
    expect(cerrar2).toHaveBeenCalledTimes(1)
  })

  it('un gesto RÁPIDO y corto (60 px en 50 ms) cierra; el mismo recorrido lento no', () => {
    const rapido = vi.fn()
    const a = abrir({ onCerrar: rapido })
    arrastrar(60, 50)
    expect(rapido).toHaveBeenCalledTimes(1)
    a.unmount()
    const lento = vi.fn()
    abrir({ onCerrar: lento })
    arrastrar(60, 2000)
    expect(lento).not.toHaveBeenCalled()
  })

  it('un gesto rapidísimo pero minúsculo (30 px) no es un cierre: solo es un roce', () => {
    const cerrar = vi.fn()
    abrir({ onCerrar: cerrar })
    arrastrar(30, 10)
    expect(cerrar).not.toHaveBeenCalled()
  })
})

describe('la hoja: hojas dentro de hojas', () => {
  function Anidadas({ interna, alExterna, alInterna }: { interna: boolean; alExterna: () => void; alInterna: () => void }) {
    return (
      <Sheet abierto titulo="Externa" onCerrar={alExterna}>
        <input aria-label="Campo externo" />
        <Sheet abierto={interna} titulo="Interna" onCerrar={alInterna}>
          <input aria-label="Campo interno" />
        </Sheet>
      </Sheet>
    )
  }

  it('Escape cierra SOLO la de arriba', async () => {
    const usuario = userEvent.setup()
    const alExterna = vi.fn()
    const alInterna = vi.fn()
    const { rerender } = render(<Anidadas interna={false} alExterna={alExterna} alInterna={alInterna} />)
    rerender(<Anidadas interna alExterna={alExterna} alInterna={alInterna} />)
    await usuario.keyboard('{Escape}')
    expect(alInterna).toHaveBeenCalledTimes(1)
    expect(alExterna).not.toHaveBeenCalled()
    // Cerrada la de arriba, la siguiente Escape es para la de abajo.
    rerender(<Anidadas interna={false} alExterna={alExterna} alInterna={alInterna} />)
    await usuario.keyboard('{Escape}')
    expect(alExterna).toHaveBeenCalledTimes(1)
  })

  it('la de abajo no le roba el foco a la de arriba', async () => {
    const usuario = userEvent.setup()
    const { rerender } = render(<Anidadas interna={false} alExterna={vi.fn()} alInterna={vi.fn()} />)
    rerender(<Anidadas interna alExterna={vi.fn()} alInterna={vi.fn()} />)
    const interna = screen.getByRole('dialog', { name: 'Interna' })
    expect(interna.contains(document.activeElement)).toBe(true)
    for (let i = 0; i < 5; i++) {
      await usuario.tab()
      expect(interna.contains(document.activeElement), `Tab ${i + 1}`).toBe(true)
    }
  })

  it('un Escape que un campo ya consumió (preventDefault) no cierra la hoja', async () => {
    const usuario = userEvent.setup()
    const cerrar = vi.fn()
    render(
      <Sheet abierto titulo="Con campo" onCerrar={cerrar}>
        <input
          aria-label="Motivo"
          onKeyDown={(e) => {
            if (e.key === 'Escape') e.preventDefault()
          }}
        />
      </Sheet>,
    )
    screen.getByRole('textbox', { name: 'Motivo' }).focus()
    await usuario.keyboard('{Escape}')
    expect(cerrar).not.toHaveBeenCalled()
  })
})

describe('la hoja: la salida tras un arrastre sigue hacia ABAJO', () => {
  afterEach(() => vi.unstubAllGlobals())
  const sinReducir = () =>
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))

  it('la animación de salida parte de donde soltó el dedo, no de 40 px', () => {
    sinReducir()
    function Controlada() {
      const [abierto, setAbierto] = useState(true)
      return (
        <Sheet abierto={abierto} titulo="Un panel" onCerrar={() => setAbierto(false)}>
          <p>contenido</p>
        </Sheet>
      )
    }
    render(<Controlada />)
    const asa = screen.getByTestId('asa-de-la-hoja')
    puntero(asa, 'pointerdown', 100)
    puntero(asa, 'pointermove', 400)
    puntero(asa, 'pointerup', 400)
    const panel = screen.getByTestId('panel-de-la-hoja')
    expect(panel.className).toMatch(/bajar-hoja/)
    // Soltó a 300 px: la salida termina más abajo (340), nunca por encima de donde estaba.
    expect(panel.style.getPropertyValue('--sale-hasta')).toBe('340px')
  })

  it('una salida normal (sin arrastre) termina a los 40 px de siempre', () => {
    sinReducir()
    const { rerender } = render(
      <Sheet abierto titulo="Un panel" onCerrar={vi.fn()}>
        <p>contenido</p>
      </Sheet>,
    )
    rerender(
      <Sheet abierto={false} titulo="Un panel" onCerrar={vi.fn()}>
        <p>contenido</p>
      </Sheet>,
    )
    expect(screen.getByTestId('panel-de-la-hoja').style.getPropertyValue('--sale-hasta')).toBe('')
  })

  it('al reabrir tras un arrastre, la hoja vuelve a su sitio', () => {
    sinReducir()
    const hoja = (abierto: boolean) => (
      <Sheet abierto={abierto} titulo="Un panel" onCerrar={vi.fn()}>
        <p>contenido</p>
      </Sheet>
    )
    const { rerender } = render(hoja(true))
    const asa = screen.getByTestId('asa-de-la-hoja')
    puntero(asa, 'pointerdown', 100)
    puntero(asa, 'pointermove', 300)
    rerender(hoja(false))
    rerender(hoja(true))
    expect(screen.getByTestId('panel-de-la-hoja').style.transform).toBe('')
  })
})

describe('ronda 3: la pila de hojas, el borde exacto y el gesto final', () => {
  afterEach(() => vi.restoreAllMocks())

  function Tres({ alUno, alDos, alTres }: { alUno: () => void; alDos: () => void; alTres: () => void }) {
    return (
      <Sheet abierto titulo="Uno" onCerrar={alUno}>
        <input aria-label="Campo uno" />
        <Sheet abierto titulo="Dos" onCerrar={alDos}>
          <input aria-label="Campo dos" />
          <Sheet abierto titulo="Tres" onCerrar={alTres}>
            <input aria-label="Campo tres" />
          </Sheet>
        </Sheet>
      </Sheet>
    )
  }

  it('tres hojas MONTADAS ya abiertas a la vez: Escape cierra la de más adentro, luego la siguiente', async () => {
    const usuario = userEvent.setup()
    const cierres: string[] = []
    render(<Tres alUno={() => cierres.push('uno')} alDos={() => cierres.push('dos')} alTres={() => cierres.push('tres')} />)
    await usuario.keyboard('{Escape}')
    expect(cierres).toEqual(['tres'])
  })

  it('tres hojas montadas a la vez: el foco da la vuelta DENTRO de la de más adentro', async () => {
    const usuario = userEvent.setup()
    render(<Tres alUno={vi.fn()} alDos={vi.fn()} alTres={vi.fn()} />)
    const tres = screen.getByRole('dialog', { name: 'Tres' })
    expect(tres.contains(document.activeElement)).toBe(true)
    for (let i = 0; i < 5; i++) {
      await usuario.tab()
      expect(tres.contains(document.activeElement), `Tab ${i + 1}`).toBe(true)
    }
  })

  it('si el foco se escapa con dos hojas abiertas, vuelve a la de ARRIBA (no a la de abajo)', () => {
    render(
      <>
        <button type="button">Detrás de todo</button>
        <Sheet abierto titulo="Fuera" onCerrar={vi.fn()}>
          <input aria-label="Campo fuera" />
          <Sheet abierto titulo="Dentro" onCerrar={vi.fn()}>
            <input aria-label="Campo dentro" />
          </Sheet>
        </Sheet>
      </>,
    )
    act(() => screen.getByRole('button', { name: 'Detrás de todo' }).focus())
    expect(screen.getByRole('dialog', { name: 'Dentro' }).contains(document.activeElement)).toBe(true)
  })

  it('dos hojas hermanas: la de abajo no le roba el foco a la que se abrió después', () => {
    const par = (b: boolean) => (
      <>
        <Sheet abierto titulo="Abajo" onCerrar={vi.fn()}>
          <input aria-label="Campo abajo" />
        </Sheet>
        <Sheet abierto={b} titulo="Arriba" onCerrar={vi.fn()}>
          <input aria-label="Campo arriba" />
        </Sheet>
      </>
    )
    const { rerender } = render(par(false))
    rerender(par(true))
    const arriba = screen.getByRole('dialog', { name: 'Arriba' })
    act(() => screen.getByRole('textbox', { name: 'Campo arriba' }).focus())
    expect(arriba.contains(document.activeElement)).toBe(true)
    expect(screen.getByRole('dialog', { name: 'Abajo' }).contains(document.activeElement)).toBe(false)
  })

  function arrastrar(dy: number, ms: number) {
    let ahora = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => ahora)
    const asa = screen.getByTestId('asa-de-la-hoja')
    puntero(asa, 'pointerdown', 100)
    ahora += ms
    puntero(asa, 'pointermove', 100 + dy)
    puntero(asa, 'pointerup', 100 + dy)
  }

  it('el borde exacto: 120 px despacio SÍ cierra (119 no, 121 sí)', () => {
    for (const [dy, cierra] of [[119, false], [120, true], [121, true]] as const) {
      const cerrar = vi.fn()
      const r = abrir({ onCerrar: cerrar })
      arrastrar(dy, 5000)
      expect(cerrar.mock.calls.length, `${dy} px`).toBe(cierra ? 1 : 0)
      r.unmount()
      vi.restoreAllMocks()
    }
  })

  it('si el padre NO cierra tras un arrastre largo, la hoja vuelve a su sitio', async () => {
    const cerrar = vi.fn() // el padre ignora el cierre
    abrir({ onCerrar: cerrar })
    arrastrar(300, 5000)
    expect(cerrar).toHaveBeenCalledTimes(1)
    const panel = screen.getByTestId('panel-de-la-hoja')
    await waitFor(() => expect(panel.style.transform).toBe(''))
    expect(panel.style.getPropertyValue('--sale-hasta')).toBe('')
  })

  it('arrastre LENTO y un golpe rápido al final: cuenta el final del gesto, no la media', () => {
    const cerrar = vi.fn()
    abrir({ onCerrar: cerrar })
    let ahora = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => ahora)
    const asa = screen.getByTestId('asa-de-la-hoja')
    puntero(asa, 'pointerdown', 100)
    ahora += 2000
    puntero(asa, 'pointermove', 140) // 40 px en 2 s: despacio
    ahora += 30
    puntero(asa, 'pointermove', 180) // 40 px en 30 ms: el golpe
    ahora += 10
    puntero(asa, 'pointerup', 180)
    expect(cerrar).toHaveBeenCalledTimes(1)
  })

  it('un arrastre lento de principio a fin, aunque largo de 80 px, no cierra', () => {
    const cerrar = vi.fn()
    abrir({ onCerrar: cerrar })
    arrastrar(80, 3000)
    expect(cerrar).not.toHaveBeenCalled()
  })
})
