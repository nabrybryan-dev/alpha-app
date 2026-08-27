import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExerciseSlotMachine } from './ExerciseSlotMachine'
import { THEMES, temaDeEjercicio } from './slotThemes'

/** `matchMedia` no existe en jsdom: se declara con el valor que pida el test. */
function conMovimientoReducido(reducido: boolean) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: reducido && consulta.includes('prefers-reduced-motion'),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

const BASE = {
  index: 0,
  total: 5,
  nombre: 'Peso muerto rumano',
  patron: 'Bisagra de cadera',
  clase: 'Compuesto · Cadena posterior',
  tecnica: 'Excéntrico 3 s · cadera atrás',
  categoria: 'BISAGRA DE CADERA',
  rango: '8-12',
}

describe('ExerciseSlotMachine', () => {
  beforeEach(() => {
    conMovimientoReducido(false)
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('muestra el nombre del ejercicio', () => {
    render(<ExerciseSlotMachine {...BASE} />)
    expect(screen.getAllByText('Peso muerto rumano').length).toBeGreaterThan(0)
  })

  /**
   * El nombre completo tiene que estar SIEMPRE en el árbol de accesibilidad,
   * aunque el tambor esté parado en otro dato. La máquina es decorativa en su
   * movimiento, nunca en su información.
   */
  it('deja el nombre accesible aunque el tambor gire a otra parada', () => {
    render(<ExerciseSlotMachine {...BASE} />)
    act(() => {
      screen.getByRole('button', { name: /ver nota técnica/i }).click()
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getAllByText('Peso muerto rumano').length).toBeGreaterThan(0)
  })

  it('la palanca cambia de parada', () => {
    render(<ExerciseSlotMachine {...BASE} />)
    expect(screen.getByRole('button', { name: /ver ejercicio/i })).toHaveAttribute('aria-current', 'true')
    act(() => {
      screen.getByRole('button', { name: /girar información del ejercicio/i }).click()
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByRole('button', { name: /ver patrón/i })).toHaveAttribute('aria-current', 'true')
  })

  /** Cada ejercicio monta la máquina que le toca, y ciclan cada cinco. */
  describe('asignación de máquina', () => {
    it.each([
      [0, 'LIBERTY BELL'],
      [1, 'FRUIT MACHINE'],
      [2, 'SEVENS & BARS'],
      [3, 'DIAMOND SALON'],
      [4, 'CASH BONANZA'],
    ])('el ejercicio %i monta %s', (index, nombreMaquina) => {
      render(<ExerciseSlotMachine {...BASE} index={index} />)
      expect(screen.getByText(nombreMaquina)).toBeInTheDocument()
    })

    it('el sexto ejercicio vuelve a la primera máquina', () => {
      expect(temaDeEjercicio(5).nombre).toBe('LIBERTY BELL')
      expect(temaDeEjercicio(9).nombre).toBe('CASH BONANZA')
    })

    it('las cinco se distinguen: ni fuente, ni acento, ni cadencia se repiten', () => {
      expect(new Set(THEMES.map((t) => t.fuente)).size).toBe(5)
      expect(new Set(THEMES.map((t) => t.acento)).size).toBe(5)
      expect(new Set(THEMES.map((t) => t.step)).size).toBe(5)
      expect(new Set(THEMES.map((t) => t.marquesina)).size).toBeGreaterThan(1)
    })
  })

  it('con prefers-reduced-motion no hay blur ni escalonado', () => {
    conMovimientoReducido(true)
    const { container } = render(<ExerciseSlotMachine {...BASE} />)
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(container.innerHTML).not.toContain('blur(')
    // El gabinete conserva su estética: solo se apaga el movimiento.
    expect(screen.getByText('LIBERTY BELL')).toBeInTheDocument()
  })

  it('con movimiento reducido la ventana SIGUE enseñando su parada', () => {
    // El test que faltaba, y el que habría cazado el fallo: hasta el 27/08 el
    // `transform` del carrete se tiraba con reducido, y como la ventana lleva
    // `overflow: hidden` y alto fijo, solo quedaba visible la parada 0 — que
    // además va a opacidad 0 por no ser la elegida. Quien pedía menos movimiento
    // veía una ventana negra sin una sola letra.
    //
    // Se comprueba el desplazamiento y no el texto: las paradas están TODAS en el
    // DOM (es un carrete), así que buscar el texto pasaría igual estando roto.
    conMovimientoReducido(true)
    const { container } = render(<ExerciseSlotMachine {...BASE} />)
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    // El desplazamiento del carrete es el UNICO `translateY(` en linea del
    // gabinete (los demas centrados usan clases de Tailwind). Antes del arreglo
    // no habia ninguno: el atributo se escribia como `undefined`.
    expect(container.innerHTML).toContain('translateY(')
  })

  it('no gira solo: el reloj está anulado por defecto', () => {
    render(<ExerciseSlotMachine {...BASE} />)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    const antes = screen.getByRole('button', { name: /ver ejercicio/i }).getAttribute('aria-current')
    act(() => {
      vi.advanceTimersByTime(20000)
    })
    expect(screen.getByRole('button', { name: /ver ejercicio/i }).getAttribute('aria-current')).toBe(antes)
  })

  it('cada punto del paginador tiene 44px de área táctil', () => {
    render(<ExerciseSlotMachine {...BASE} />)
    const punto = screen.getByRole('button', { name: /ver patrón/i })
    expect(punto.style.width).toBe('44px')
    expect(punto.style.height).toBe('44px')
  })

  it('no se rompe con los datos opcionales ausentes', () => {
    render(<ExerciseSlotMachine index={2} total={5} nombre="Sentadilla" categoria="SENTADILLA" rango="6-8" />)
    expect(screen.getAllByText('Sentadilla').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /^ver /i })).toHaveLength(1)
  })

  it('numera el ejercicio con dos cifras', () => {
    render(<ExerciseSlotMachine {...BASE} index={2} total={5} />)
    expect(screen.getByText(/Ejercicio 03 \/ 05/)).toBeInTheDocument()
  })
})

/**
 * El nombre era la ÚNICA parada que no encogía nunca: `esNombre ? n : …` se
 * saltaba la comprobación de longitud. «Empuje de cadera (unilateral, con
 * pausa)» se pintaba al mismo tamaño que «Sentadilla» y se salía de una ventana
 * de 104 px con `overflow: hidden`, cortado a media letra.
 */
describe('los nombres largos caben', () => {
  const conNombre = (nombre: string, index = 0) =>
    render(<ExerciseSlotMachine {...BASE} index={index} nombre={nombre} />)

  /** Saca el tamaño de fuente del span que pinta el valor de la parada. */
  const tamañoDelValor = (container: HTMLElement): number => {
    const el = container.querySelector('[data-valor]') as HTMLElement
    return parseFloat(el.style.fontSize)
  }

  it('un nombre largo se pinta más pequeño que uno corto', () => {
    const corto = conNombre('Sentadilla')
    const largo = conNombre('Empuje de cadera (unilateral, con pausa)')
    expect(tamañoDelValor(largo.container)).toBeLessThan(tamañoDelValor(corto.container))
  })

  it('encoge por tramos: cuanto más largo, más pequeño', () => {
    const tam = (n: string) => tamañoDelValor(conNombre(n).container)
    const a = tam('Sentadilla')
    const b = tam('Peso muerto rumano con mancuernas')
    const c = tam('Empuje de cadera unilateral con pausa isométrica')
    expect(a).toBeGreaterThan(b)
    expect(b).toBeGreaterThan(c)
  })

  /** Encoger no puede llegar a ilegible: por eso existe «ver completo». */
  it('nunca baja de un tamaño legible', () => {
    const { container } = conNombre('Un nombre absurdamente largo que nadie escribiría jamás en la vida real')
    expect(tamañoDelValor(container)).toBeGreaterThanOrEqual(13)
  })

  it('el nombre sigue siendo el texto más grande del gabinete', () => {
    // Es el dato por el que se mira la máquina: encoge, pero no se degrada a
    // la altura de una etiqueta.
    const { container } = conNombre('Sentadilla')
    expect(tamañoDelValor(container)).toBeGreaterThan(15)
  })

  /** Pase lo que pase con el tamaño, el nombre entero está accesible. */
  it.each([0, 1, 2, 3, 4])('en la máquina %i el nombre completo sigue en el árbol', (index) => {
    const largo = 'Empuje de cadera (unilateral, con pausa)'
    conNombre(largo, index)
    expect(screen.getAllByText(largo).length).toBeGreaterThan(0)
  })
})

/**
 * «Ver completo», el toque que enseña la parada entera.
 *
 * jsdom no hace layout: `scrollHeight` siempre vale 0, así que el desbordamiento
 * se simula. Es la única forma de probar esto sin un navegador de verdad, y
 * merece la pena: la primera versión medía el `span` del texto —que no tiene
 * altura fija— en vez de la caja de la parada, así que el aviso no habría
 * aparecido NUNCA y nadie se habría enterado.
 */
describe('ver el texto completo cuando no cabe', () => {
  const LARGO = 'Empuje de cadera unilateral con pausa isométrica de tres segundos'

  /** Hace que las cajas de parada digan que su contenido desborda. */
  function conDesbordamiento(px: number) {
    return vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.hasAttribute('data-parada') ? this.clientHeight + px : 0
    })
  }

  afterEach(() => vi.restoreAllMocks())

  /** La medida ocurre en un requestAnimationFrame, no en un temporizador. */
  const asentar = () => act(async () => { await new Promise((r) => setTimeout(r, 40)) })

  it('si no desborda, no ofrece nada: sería ruido', async () => {
    conDesbordamiento(0)
    render(<ExerciseSlotMachine {...BASE} nombre={LARGO} />)
    await asentar()
    expect(screen.queryByRole('button', { name: /ver completo/i })).toBeNull()
  })

  /** 1-2 px son redondeo del navegador, no un recorte. */
  it('un par de píxeles de más no cuentan como recorte', async () => {
    conDesbordamiento(2)
    render(<ExerciseSlotMachine {...BASE} nombre={LARGO} />)
    await asentar()
    expect(screen.queryByRole('button', { name: /ver completo/i })).toBeNull()
  })

  it('cuando se corta de verdad, aparece el aviso', async () => {
    conDesbordamiento(40)
    render(<ExerciseSlotMachine {...BASE} nombre={LARGO} />)
    await asentar()
    expect(screen.getByRole('button', { name: /ver completo/i })).toBeInTheDocument()
  })

  it('al tocarlo se lee el nombre entero, y se puede cerrar', async () => {
    conDesbordamiento(40)
    render(<ExerciseSlotMachine {...BASE} nombre={LARGO} />)
    await asentar()

    await act(async () => {
      screen.getByRole('button', { name: /ver completo/i }).click()
    })
    const cerrar = screen.getByRole('button', { name: /^cerrar$/i })
    expect(cerrar.textContent).toContain(LARGO)

    await act(async () => {
      cerrar.click()
    })
    expect(screen.queryByRole('button', { name: /^cerrar$/i })).toBeNull()
  })
})
