import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DiaRuta } from '../../../../domain/rutaEntrenamiento'
import type { Sesion } from '../../../../domain/types'
import { BarraDeSesion } from './BarraDeSesion'
import { DesplegableDeLaSemana } from './DesplegableDeLaSemana'
import { diaEnPantalla } from './diaEnPantalla'

/**
 * LA BANDA DE ARRIBA Y LA SEMANA QUE DESPLIEGA (Bryan, 25-oct).
 *
 * El fallo que dio pie a esto: con la sesión de hoy ya hecha, el salón enseña la próxima
 * —la del lunes— y la banda seguía diciendo DOMINGO. Leía «Sesión UPPER A · DOMINGO»
 * mientras la semana decía que el domingo era LEG A: las dos piezas no hablaban del
 * mismo día.
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
  dia(0, { estado: 'completada', esHoy: true, sesionId: 's-dom', titulo: 'LEG A', detalle: '5 ejercicios' }),
  dia(1, { estado: 'programada', sesionId: 's-lun', titulo: 'UPPER A', detalle: '5 ejercicios' }),
  dia(2, { estado: 'programada', sesionId: 's-mar', titulo: 'LEG B', detalle: '4 ejercicios' }),
  dia(3, {}),
  dia(4, { estado: 'programada', sesionId: 's-jue', titulo: 'FULL C', detalle: '6 ejercicios' }),
  dia(5, {}),
  dia(6, {}),
]

const sesion = (id: string, nombre: string) => ({ id, nombre, orden: 1, ejercicios: [] }) as Sesion

describe('diaEnPantalla', () => {
  it('sin día elegido es el día de la sesión que se ve, no hoy', () => {
    expect(diaEnPantalla(SEMANA, 's-lun', null)).toBe(1)
  })
  it('con un día elegido, es ese', () => {
    expect(diaEnPantalla(SEMANA, 's-lun', 4)).toBe(4)
  })
  it('sin sesión en pantalla, es hoy', () => {
    expect(diaEnPantalla(SEMANA, undefined, null)).toBe(0)
  })
})

describe('BarraDeSesion', () => {
  it('dice el día de la sesión que se ve y que es la próxima, no hoy', () => {
    render(<BarraDeSesion sesion={sesion('s-lun', 'UPPER A')} semana={SEMANA} onAbrirSemana={() => {}} />)
    const boton = screen.getByRole('button', { name: /cambiar de día/i })
    expect(boton).toHaveTextContent(/lunes/i)
    expect(boton).toHaveTextContent(/próxima/i)
    expect(boton).not.toHaveTextContent(/domingo/i)
  })

  it('con la sesión de hoy dice hoy', () => {
    render(<BarraDeSesion sesion={sesion('s-dom', 'LEG A')} semana={SEMANA} onAbrirSemana={() => {}} />)
    expect(screen.getByRole('button', { name: /cambiar de día/i })).toHaveTextContent(/domingo.*hoy/i)
  })

  it('una sesión por omisión de un día ya pasado está atrasada, no es la próxima', () => {
    const semana = SEMANA.map((d, i) =>
      i === 0 ? { ...d, estado: 'programada' as const, esHoy: false } : i === 2 ? { ...d, esHoy: true } : d,
    )
    render(<BarraDeSesion sesion={sesion('s-dom', 'LEG A')} semana={semana} onAbrirSemana={() => {}} />)
    const boton = screen.getByRole('button', { name: /cambiar de día/i })
    expect(boton).toHaveTextContent(/atrasada/i)
    expect(boton).not.toHaveTextContent(/próxima/i)
  })

  it('dice si la semana está desplegada', () => {
    render(
      <BarraDeSesion sesion={sesion('s-lun', 'UPPER A')} semana={SEMANA} onAbrirSemana={() => {}} semanaAbierta />,
    )
    expect(screen.getByRole('button', { name: /cambiar de día/i })).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('DesplegableDeLaSemana', () => {
  const montar = (diaActual = 1) => {
    const onElegir = vi.fn()
    const onCerrar = vi.fn()
    render(<DesplegableDeLaSemana semana={SEMANA} diaActual={diaActual} onElegir={onElegir} onCerrar={onCerrar} />)
    return { onElegir, onCerrar }
  }

  it('enseña los siete días a la vez, cada uno con su sesión y su estado, y todos se pueden tocar', () => {
    montar()
    const lista = screen.getByRole('dialog', { name: 'Tu semana' })
    const dias = within(lista).getAllByRole('button', { name: /^(domingo|lunes|martes|miércoles|jueves|viernes|sábado)/i })
    expect(dias).toHaveLength(7)
    for (const b of dias) expect(b).not.toBeDisabled()
    expect(dias[0]).toHaveTextContent(/LEG A/)
    expect(dias[0]).toHaveTextContent(/hecha/i)
    expect(dias[0]).toHaveTextContent(/hoy/i)
    expect(dias[1]).toHaveTextContent(/UPPER A/)
    expect(dias[3]).toHaveTextContent(/descanso/i)
  })

  it('un día programado que ya pasó sale «Sin hacer», y uno futuro «Pendiente», también cruzando de mes', () => {
    // Hoy es el jueves 29: lunes y martes ya pasaron sin hacerse; el domingo 01 es futuro.
    const semana = [
      dia(0, { estado: 'completada', sesionId: 's-dom', titulo: 'LEG A' }),
      dia(1, { estado: 'programada', sesionId: 's-lun', titulo: 'UPPER A' }),
      dia(2, { estado: 'programada', sesionId: 's-mar', titulo: 'LEG B' }),
      dia(3, {}),
      dia(4, { estado: 'hoy', esHoy: true, sesionId: 's-jue', titulo: 'FULL C' }),
      dia(5, {}),
      { ...dia(6, { estado: 'programada', sesionId: 's-sig', titulo: 'LEG A' }), fechaIso: '2026-11-01', numero: '01' },
    ]
    render(<DesplegableDeLaSemana semana={semana} diaActual={4} onElegir={() => {}} onCerrar={() => {}} />)
    expect(screen.getByRole('button', { name: /^lunes/i })).toHaveTextContent(/sin hacer/i)
    expect(screen.getByRole('button', { name: /^martes/i })).toHaveTextContent(/sin hacer/i)
    expect(screen.getByRole('button', { name: /^jueves/i })).toHaveTextContent(/toca hoy/i)
    expect(screen.getByRole('button', { name: /^sábado/i })).toHaveTextContent(/pendiente/i)
  })

  it('al cerrarse deja de escuchar Escape y devuelve el foco a quien la abrió', () => {
    const boton = document.createElement('button')
    document.body.appendChild(boton)
    boton.focus()
    const onCerrar = vi.fn()
    const { unmount } = render(
      <DesplegableDeLaSemana semana={SEMANA} diaActual={1} onElegir={() => {}} onCerrar={onCerrar} />,
    )
    expect(document.activeElement).not.toBe(boton)
    unmount()
    expect(document.activeElement).toBe(boton)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCerrar).not.toHaveBeenCalled()
    boton.remove()
  })

  it('marca el día que se está viendo', () => {
    montar(1)
    expect(screen.getByRole('button', { name: /^lunes/i })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: /^jueves/i })).not.toHaveAttribute('aria-current')
  })

  it('tocar un día lo elige', () => {
    const { onElegir } = montar()
    fireEvent.click(screen.getByRole('button', { name: /^jueves/i }))
    expect(onElegir).toHaveBeenCalledWith(4)
  })

  it('Escape y tocar fuera la cierran sin elegir', () => {
    const { onElegir, onCerrar } = montar()
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByTestId('fondo-de-la-semana'))
    expect(onCerrar).toHaveBeenCalledTimes(2)
    expect(onElegir).not.toHaveBeenCalled()
  })
})
