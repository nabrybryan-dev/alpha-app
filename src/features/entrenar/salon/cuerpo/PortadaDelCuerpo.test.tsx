import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortadaDelCuerpo, type PortadaDelCuerpoProps } from './PortadaDelCuerpo'
import { cifrasEnUnaLinea } from './cifrasEnUnaLinea'

const voz = vi.hoisted(() => ({ permitida: false }))
vi.mock('../voz/useVozPermitida', () => ({ useVozPermitida: () => voz.permitida }))

function props(sobre: Partial<PortadaDelCuerpoProps> = {}): PortadaDelCuerpoProps {
  return {
    vista: 'cuerpo',
    capa: 'musculo',
    rango: 'hoy',
    series: { dors: 2, bic: 1, trap: 1 },
    doloridas: [],
    alCambiarCapa: vi.fn(),
    alCambiarRango: vi.fn(),
    alCambiarVista: vi.fn(),
    ...sobre,
  }
}

const conGuia = (sobre: Partial<PortadaDelCuerpoProps> = {}) => props({ guia: 'indice', ...sobre })

describe('el micrófono de las órdenes de voz', () => {
  class Falso {
    static ultimo: Falso
    onresult: ((e: unknown) => void) | null = null
    onerror: unknown = null
    onend: (() => void) | null = null
    start = vi.fn()
    stop = vi.fn()
    abort = vi.fn()
    constructor() {
      Falso.ultimo = this
    }
  }
  const ventana = window as unknown as { webkitSpeechRecognition?: unknown }
  const decir = (texto: string) => {
    fireEvent.click(screen.getByRole('button', { name: /orden a Praxis/ }))
    act(() => {
      Falso.ultimo.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: texto }], { isFinal: true })] })
      Falso.ultimo.onend?.()
    })
  }

  beforeEach(() => {
    voz.permitida = true
    ventana.webkitSpeechRecognition = Falso
  })
  afterEach(() => {
    voz.permitida = false
    delete ventana.webkitSpeechRecognition
  })

  it('sin permiso no se pinta', () => {
    voz.permitida = false
    render(<PortadaDelCuerpo {...props()} />)
    expect(screen.queryByRole('button', { name: /orden a Praxis/ })).not.toBeInTheDocument()
  })

  it('una zona dicha abre la guía allí y lo dice', () => {
    const p = props({ alIrEnLaGuia: vi.fn(), azimutDelCuerpo: 0 })
    render(<PortadaDelCuerpo {...p} />)
    decir('muéstrame cuádriceps')
    expect(p.alIrEnLaGuia).toHaveBeenCalledWith('cua', 0)
    expect(screen.getByRole('status')).toHaveTextContent('Cuádriceps')
  })

  it('«me duele la rodilla» no mueve el cuerpo ni abre nada', () => {
    const p = props({ alIrEnLaGuia: vi.fn() })
    render(<PortadaDelCuerpo {...p} />)
    decir('me duele la rodilla')
    expect(p.alIrEnLaGuia).not.toHaveBeenCalled()
  })

  it('«me duele el pecho» es urgente: abre el panel donde salen las líneas, nunca la zona del pecho', () => {
    const p = props({ alIrEnLaGuia: vi.fn() })
    render(<PortadaDelCuerpo {...p} />)
    decir('me duele el pecho')
    expect(p.alIrEnLaGuia).toHaveBeenCalledTimes(1)
    expect(p.alIrEnLaGuia).toHaveBeenCalledWith({ paso: 0, zona: null }, 0)
  })

  it('una pregunta abre el panel y no contesta «no entendí»', () => {
    const p = props({ alIrEnLaGuia: vi.fn() })
    render(<PortadaDelCuerpo {...p} />)
    decir('cuántas series de pecho hago a la semana')
    expect(p.alIrEnLaGuia).toHaveBeenCalledWith({ paso: 0, zona: null }, 0)
    expect(screen.getByRole('status').textContent).toContain('cuántas series de pecho')
  })

  it('el botón sigue en la vista de movimiento, y desde ahí se vuelve al cuerpo con la voz', () => {
    const p = props({ vista: 'movimiento' })
    render(<PortadaDelCuerpo {...p} />)
    decir('volver al cuerpo')
    expect(p.alCambiarVista).toHaveBeenCalledWith('cuerpo')
  })
})

describe('el centro: el cuerpo y una sola línea de Praxis', () => {
  it('Praxis dice lo trabajado y, al tocarla, empieza a contar el día', () => {
    const p = props({ alIrEnLaGuia: vi.fn(), azimutDelCuerpo: 0 })
    render(<PortadaDelCuerpo {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Praxis. Praxis. Hoy trabajaste: Dorsal 2 · Bíceps 1 · Trapecio 1' }))
    expect(p.alIrEnLaGuia).toHaveBeenCalledWith({ paso: 0, zona: null }, 0)
  })

  it('lo que falta manda sobre lo hecho; en Piel no se dice porque no se pinta', () => {
    const { unmount } = render(<PortadaDelCuerpo {...props({ porTrabajar: ['cua'] })} />)
    expect(screen.getByRole('button', { name: /Hoy te falta: Cuádriceps/ })).toBeInTheDocument()
    unmount()
    render(<PortadaDelCuerpo {...props({ porTrabajar: ['cua'], capa: 'piel' })} />)
    expect(screen.queryByRole('button', { name: /Hoy te falta/ })).toBeNull()
  })

  it('con rango semana no dice «hoy»', () => {
    render(<PortadaDelCuerpo {...props({ rango: 'semana' })} />)
    expect(screen.getByRole('button', { name: /Esta semana: Dorsal 2/ })).toBeInTheDocument()
  })

  it('sin series no inventa nada: invita a tocar', () => {
    render(<PortadaDelCuerpo {...props({ series: {} })} />)
    expect(screen.getByText('Toca un músculo para saber qué hace')).toBeInTheDocument()
  })

  it('el dolor sigue a la vista, en su propia línea y en rojo', () => {
    render(<PortadaDelCuerpo {...props({ doloridas: ['delt'] })} />)
    const linea = screen.getByText(/Te duele \(a rayas\): Deltoides/)
    expect(linea.getAttribute('style') ?? '').toContain('var(--rojo)')
  })

  it('sin dolor no hay línea de dolor', () => {
    render(<PortadaDelCuerpo {...props()} />)
    expect(screen.queryByText(/Te duele/)).toBeNull()
  })

  it('pertenece al hueco «cuerpo» del contrato del salón', () => {
    const { container } = render(<PortadaDelCuerpo {...props()} />)
    expect(container.querySelector('[data-hueco="cuerpo"]')).not.toBeNull()
  })
})

describe('el reloj en el cuerpo: solo lo que corre', () => {
  const reloj = (modo: 'sesion' | 'descanso') => ({
    textoDeCarga: '',
    modo,
    anclas: { abierto: 1000, cuenta: 1000, duracion: 120 },
    alTerminarLaCuenta: vi.fn(),
    cargaEnLaPared: false,
  })

  it('el tiempo de sesión no se pinta sobre el cuerpo', () => {
    const { container } = render(<PortadaDelCuerpo {...props({ reloj: reloj('sesion') })} />)
    expect(container.querySelector('[data-hueco-muro="reloj"]')).toBeNull()
  })

  it('la cuenta del descanso sí, y su franja no tapa el cuerpo aunque sus botones reciban toques', () => {
    const { container } = render(<PortadaDelCuerpo {...props({ reloj: reloj('descanso') })} />)
    const franja = container.querySelector('[data-hueco-muro="reloj"]')!.closest('.muro-escena')!
    expect(franja.className).toContain('pointer-events-none')
    expect(franja.className).toContain('[&_button]:pointer-events-auto')
  })
})

describe('lo que salió del centro sigue en la guía (relevo sin pérdidas)', () => {
  it('las tres capas, con la elegida marcada, y tocar una la cambia', () => {
    const p = conGuia()
    render(<PortadaDelCuerpo {...p} />)
    const grupo = screen.getByRole('radiogroup', { name: 'Capas del cuerpo' })
    const botones = within(grupo).getAllByRole('radio')
    expect(botones.map((b) => b.getAttribute('aria-label'))).toEqual(['Piel', 'Músculo', 'Hueso'])
    expect(within(grupo).getByRole('radio', { name: 'Músculo' })).toBeChecked()
    fireEvent.click(within(grupo).getByRole('radio', { name: 'Hueso' }))
    expect(p.alCambiarCapa).toHaveBeenCalledWith('hueso')
  })

  it('Hoy y Semana se cambian, y sigue avisando que cuenta lo anotado, no el estímulo', () => {
    const p = conGuia({ rango: 'semana' })
    render(<PortadaDelCuerpo {...p} />)
    expect(screen.getByText(/Series de la semana: cuenta lo anotado, no el estímulo/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Hoy' }))
    expect(p.alCambiarRango).toHaveBeenCalledWith('hoy')
  })

  it('el botón pasa al movimiento (la escena vieja sigue ahí)', () => {
    const p = conGuia()
    render(<PortadaDelCuerpo {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver el movimiento' }))
    expect(p.alCambiarVista).toHaveBeenCalledWith('movimiento')
  })

  it('en la vista de movimiento solo queda volver al cuerpo: ni guía ni línea', () => {
    const p = conGuia({ vista: 'movimiento' })
    render(<PortadaDelCuerpo {...p} />)
    expect(screen.queryByRole('radiogroup', { name: 'Capas del cuerpo' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Abrir Praxis/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver el cuerpo' }))
    expect(p.alCambiarVista).toHaveBeenCalledWith('cuerpo')
  })

  it('el índice lista las 15 zonas con sus series y marca la que duele', () => {
    render(<PortadaDelCuerpo {...conGuia({ doloridas: ['delt'] })} />)
    const guia = document.querySelector('[data-testigo="guia-de-praxis"]') as HTMLElement
    expect(within(guia).getAllByRole('listitem')).toHaveLength(15)
    expect(within(guia).getByText('Dorsal').closest('li')).toHaveTextContent('2')
    expect(within(guia).getByText('Deltoides').closest('li')).toHaveTextContent('Te duele')
  })

  it('tocar una zona del índice la abre', () => {
    const p = conGuia({ alIrEnLaGuia: vi.fn(), azimutDelCuerpo: 0 })
    render(<PortadaDelCuerpo {...p} />)
    fireEvent.click(screen.getByRole('button', { name: /^Glúteo/ }))
    expect(p.alIrEnLaGuia).toHaveBeenCalledWith('glu', 0)
  })

  it('el rojo es del dolor: la opción elegida no usa el botón rojo y se marca con aro', () => {
    render(<PortadaDelCuerpo {...conGuia()} />)
    const elegida = screen.getByRole('radio', { name: 'Músculo' })
    expect(elegida.className).not.toContain('btn-3d')
    expect(elegida.getAttribute('style') ?? '').toContain('inset 0 0 0 1.5px')
  })
})

describe('las cifras en una línea', () => {
  it('series, reps, descanso y RIR (o fallo)', () => {
    const base = { nombre: 'Remo', sets: 3, repsDiana: 9, descansoMin: 3 }
    expect(cifrasEnUnaLinea({ ...base, rirObjetivo: 2 })).toBe('3 series · 9 reps · 3 min · RIR 2')
    expect(cifrasEnUnaLinea({ ...base, descansoMin: 1.5, rirObjetivo: 'FALLO' })).toBe('3 series · 9 reps · 1,5 min · RIR fallo')
  })
})
