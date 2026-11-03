import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DiaRuta } from '../../../../domain/rutaEntrenamiento'
import { ALTO_FILA } from './fisicaDelTambor'
import { TamborDeLaSemana } from './TamborDeLaSemana'

/**
 * EL TAMBOR DE LA SEMANA (Bryan, 30-oct: vuelve, como en la maqueta 7).
 *
 * Cada prueba guarda algo que protegía la lista desplegable que el tambor sustituye de
 * nuevo (25-oct), más lo que ya falló una vez: dos días quedaban debajo de la ranura sin
 * poder tocarse.
 */

const dia = (i: number, cambios: Partial<DiaRuta>): DiaRuta => ({
  fechaIso: `2026-10-${String(25 + i).padStart(2, '0')}`,
  dia: (['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'] as const)[i],
  abreviatura: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][i],
  numero: String(25 + i),
  estado: 'descanso',
  esHoy: false,
  titulo: 'Descanso',
  detalle: 'Sin sesión programada.',
  ...cambios,
})

const SEMANA: DiaRuta[] = [
  dia(0, { estado: 'completada', sesionId: 's-dom', titulo: 'LEG A' }),
  dia(1, { estado: 'programada', sesionId: 's-lun', titulo: 'UPPER A' }),
  dia(2, { estado: 'programada', sesionId: 's-mar', titulo: 'LEG B' }),
  dia(3, { estado: 'hoy', esHoy: true, sesionId: 's-mie', titulo: 'UPPER B' }),
  dia(4, { estado: 'programada', sesionId: 's-jue', titulo: 'FULL C' }),
  dia(5, {}),
  dia(6, {}),
]

const movimientoReducido = (reducido: boolean) =>
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (q: string) =>
      ({
        matches: reducido && q.includes('reduce'),
        media: q,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        onchange: null,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  )

const montar = (diaActual = 3) => {
  const onElegir = vi.fn()
  const onCerrar = vi.fn()
  const r = render(<TamborDeLaSemana semana={SEMANA} diaActual={diaActual} onElegir={onElegir} onCerrar={onCerrar} />)
  return { onElegir, onCerrar, ...r }
}
const fila = (re: RegExp) => screen.getByRole('button', { name: re })
const arrastrar = (de: number, a: number) => {
  const t = screen.getByTestId('tambor-de-la-semana')
  fireEvent.pointerDown(t, { clientY: de, pointerId: 1 })
  fireEvent.pointerMove(t, { clientY: a, pointerId: 1 })
  fireEvent.pointerUp(t, { clientY: a, pointerId: 1 })
}

// jsdom no trae PointerEvent: sin él `clientY` se pierde y todo arrastre sería NaN.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventDeprueba extends MouseEvent {
    pointerId: number
    constructor(tipo: string, init: PointerEventInit = {}) {
      super(tipo, init)
      this.pointerId = init.pointerId ?? 1
    }
  }
  Object.defineProperty(window, 'PointerEvent', { value: PointerEventDeprueba, configurable: true })
}

afterEach(() => vi.restoreAllMocks())

describe('TamborDeLaSemana', () => {
  it('lleva los siete días, ninguno desactivado ni fuera del orden del teclado', () => {
    movimientoReducido(false)
    montar()
    const f = within(screen.getByRole('dialog', { name: 'Tu semana' })).getAllByRole('button', {
      name: /^(domingo|lunes|martes|miércoles|jueves|viernes|sábado)/i,
    })
    expect(f).toHaveLength(7)
    for (const b of f) {
      expect(b).not.toBeDisabled()
      expect(b.getAttribute('tabindex')).not.toBe('-1')
    }
  })

  it('abre en el día que está en pantalla', () => {
    movimientoReducido(false)
    montar(4)
    expect(fila(/^jueves/i)).toHaveAttribute('aria-pressed', 'true')
    expect(fila(/^lunes/i)).toHaveAttribute('aria-pressed', 'false')
  })

  it('elegir un día NO empieza esa sesión: tocarlo solo lo centra, y «Mirar este día» lo elige', () => {
    movimientoReducido(false)
    const { onElegir } = montar(3)
    fireEvent.click(fila(/^viernes/i))
    expect(onElegir).not.toHaveBeenCalled()
    expect(fila(/^viernes/i)).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /mirar este día/i }))
    expect(onElegir).toHaveBeenCalledTimes(1)
    expect(onElegir).toHaveBeenCalledWith(5)
  })

  it('con el teclado se alcanzan los siete días: flechas, Inicio, Fin, y cada día al enfocarse', () => {
    movimientoReducido(false)
    const { onElegir } = montar(3)
    const tambor = screen.getByTestId('tambor-de-la-semana')
    fireEvent.keyDown(tambor, { key: 'End' })
    expect(fila(/^sábado/i)).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(tambor, { key: 'Home' })
    expect(fila(/^domingo/i)).toHaveAttribute('aria-pressed', 'true')
    for (let k = 0; k < 6; k++) fireEvent.keyDown(tambor, { key: 'ArrowDown' })
    expect(fila(/^sábado/i)).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(tambor, { key: 'ArrowDown' }) // contra el tope no se sale
    expect(fila(/^sábado/i)).toHaveAttribute('aria-pressed', 'true')
    fireEvent.focus(fila(/^martes/i))
    expect(fila(/^martes/i)).toHaveAttribute('aria-pressed', 'true')
    expect(onElegir).not.toHaveBeenCalled()
  })

  it('con el dedo se alcanzan los siete: se arrastra hasta cada extremo y a un día intermedio', () => {
    movimientoReducido(true)
    const { onElegir } = montar(3)
    // El dedo sube = el tambor avanza hacia el sábado.
    arrastrar(600, 600 - ALTO_FILA * 20)
    expect(fila(/^sábado/i)).toHaveAttribute('aria-pressed', 'true')
    arrastrar(100, 100 + ALTO_FILA * 20)
    expect(fila(/^domingo/i)).toHaveAttribute('aria-pressed', 'true')
    arrastrar(600, 600 - ALTO_FILA * 2)
    expect(fila(/^martes/i)).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /mirar este día/i }))
    expect(onElegir).toHaveBeenCalledWith(2)
  })

  it('arrastrar no elige el día que queda bajo el dedo al soltar', () => {
    movimientoReducido(true)
    const { onElegir } = montar(3)
    arrastrar(300, 200)
    fireEvent.click(fila(/^viernes/i)) // el click que el navegador lanza tras un arrastre
    expect(onElegir).not.toHaveBeenCalled()
  })

  it('un toque sin recorrido no es un arrastre: el dedo temblón sigue centrando el día tocado', () => {
    movimientoReducido(true)
    montar(3)
    arrastrar(300, 297) // 3 px: por debajo del umbral
    fireEvent.click(fila(/^viernes/i))
    expect(fila(/^viernes/i)).toHaveAttribute('aria-pressed', 'true')
  })

  it('Escape y tocar fuera la cierran sin elegir', () => {
    movimientoReducido(false)
    const { onElegir, onCerrar } = montar()
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByTestId('fondo-de-la-semana'))
    expect(onCerrar).toHaveBeenCalledTimes(2)
    expect(onElegir).not.toHaveBeenCalled()
  })

  it('al cerrarse deja de escuchar Escape y devuelve el foco a quien la abrió', () => {
    movimientoReducido(false)
    const boton = document.createElement('button')
    document.body.appendChild(boton)
    boton.focus()
    const onCerrar = vi.fn()
    const { unmount } = render(
      <TamborDeLaSemana semana={SEMANA} diaActual={1} onElegir={() => {}} onCerrar={onCerrar} />,
    )
    unmount()
    expect(document.activeElement).toBe(boton)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCerrar).not.toHaveBeenCalled()
    boton.remove()
  })

  it('no gira la sala al arrastrarlo: lleva data-no-orbita', () => {
    movimientoReducido(false)
    montar()
    expect(screen.getByRole('dialog', { name: 'Tu semana' }).closest('[data-no-orbita]')).not.toBeNull()
  })

  it('se puede volver a hoy', () => {
    movimientoReducido(false)
    const { onElegir } = montar(1)
    fireEvent.click(screen.getByRole('button', { name: /volver a hoy/i }))
    expect(onElegir).toHaveBeenCalledWith(3)
  })

  it('con movimiento reducido no hay inercia: al soltar encaja sin pedir ni un cuadro de animación', () => {
    movimientoReducido(true)
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    montar(3)
    arrastrar(400, 200)
    expect(raf).not.toHaveBeenCalled()
    const centro = screen.getByTestId('tambor-de-la-semana').style.getPropertyValue('--centro')
    expect(Number.isInteger(Number(centro))).toBe(true)
  })

  it('cada día dice su estado: uno programado que ya pasó sale «sin hacer», y uno futuro «pendiente»', () => {
    movimientoReducido(false)
    montar(3)
    expect(fila(/^lunes/i)).toHaveAccessibleName(/sin hacer/i)
    expect(fila(/^miércoles/i)).toHaveAccessibleName(/toca hoy/i)
    expect(fila(/^jueves/i)).toHaveAccessibleName(/pendiente/i)
    expect(fila(/^domingo/i)).toHaveAccessibleName(/hecha/i)
    expect(fila(/^viernes/i)).toHaveAccessibleName(/descanso/i)
  })
})
