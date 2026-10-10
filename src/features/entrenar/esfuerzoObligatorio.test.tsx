import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/dbInstance'
import {
  llevaEsfuerzo,
  MOTIVO_SIN_CONFIRMAR,
  MOTIVO_SIN_ESFUERZO,
  motivoDeNoGuardar,
  tieneEsfuerzo,
} from '../../domain/confirmacionSerie'
import type { EjercicioPrescrito } from '../../domain/types'
import { RegistroSerie, type RegistroSerieHandle } from './RegistroSerie'
import { RegistroSerieSalon } from './salon/registro/RegistroSerieSalon'

/**
 * SIN EL ESFUERZO NO SE GUARDA LA SERIE (decisión del coach, 2026-10-10).
 *
 * Desde el 2026-10-02 el RIR arranca vacío para que nadie guarde el objetivo como si fuera
 * lo que sintió. Faltaba la otra mitad: la serie se podía guardar con el RIR en blanco, y
 * 11 de las 108 series de la semana del 5-oct llegaron así. La cadena que arma la semana
 * siguiente no acepta una serie sin RIR, y las cinco personas con registro se quedaron sin
 * prescripción. El dato se pide donde nace: un toque antes de guardar.
 */

function ejercicio(parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e-esf',
    categoria: 'DOMINANTE DE CADERA',
    nombre: 'Hip thrust con barra',
    cues: '',
    prescripcion: '',
    descansoMin: 3,
    sets: 3,
    rango: '(8-12)',
    repsDiana: 10,
    rirObjetivo: 2,
    cargaKg: 85,
    unidadCarga: 'kg',
    series: [],
    ...parcial,
  }
}

const tal = () => screen.getByRole('button', { name: /^Hecho tal cual/ }) as HTMLButtonElement
const guardarBtn = () => screen.getByRole('button', { name: /^Guardar serie/ }) as HTMLButtonElement

describe('reglas (unidad)', () => {
  it('sin esfuerzo el motivo es el esfuerzo; con esfuerzo y sin confirmar, la confirmación', () => {
    expect(motivoDeNoGuardar(undefined, undefined)).toBe(MOTIVO_SIN_ESFUERZO)
    expect(motivoDeNoGuardar('editada', undefined)).toBe(MOTIVO_SIN_ESFUERZO)
    expect(motivoDeNoGuardar(undefined, 2)).toBe(MOTIVO_SIN_CONFIRMAR)
    expect(motivoDeNoGuardar('editada', 0)).toBeNull()
  })
})

describe('dónde aplica y qué cuenta como esfuerzo (unidad)', () => {
  it('un RIR es un entero de 0 a 5: ni null, ni texto, ni 6', () => {
    expect(tieneEsfuerzo(0)).toBe(true)
    expect(tieneEsfuerzo(5)).toBe(true)
    for (const malo of [undefined, null, 'Control', '2', 6, -1, 2.5, Number.NaN]) {
      expect(tieneEsfuerzo(malo as never)).toBe(false)
    }
  })

  it('isometría, control o movilidad no llevan RIR; un número, un rango o el FALLO sí', () => {
    for (const si of [0, 2, 'FALLO', 'fallo', '2-3', 'RIR 2']) expect(llevaEsfuerzo(si)).toBe(true)
    for (const no of ['ISOMETRÍA', 'Control', 'Movilidad', 'Suave', '', undefined, null]) expect(llevaEsfuerzo(no)).toBe(false)
  })

  it('donde no aplica, el esfuerzo no frena el guardado', () => {
    expect(motivoDeNoGuardar(undefined, undefined, false)).toBe(MOTIVO_SIN_CONFIRMAR)
    expect(motivoDeNoGuardar('editada', undefined, false)).toBeNull()
  })
})

describe('ejercicios donde el RIR no aplica (isometría, control)', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })
  const isometrico = () => ejercicio({ rirObjetivo: 'ISOMETRÍA' as never })

  it('tarjeta: «Hecho tal cual» guarda sin RIR, como siempre', () => {
    const alGuardar = vi.fn()
    render(<RegistroSerie ejercicio={isometrico()} orden={1} borradorId="iso1" onGuardar={alGuardar} />)
    expect(tal().disabled).toBe(false)
    fireEvent.click(tal())
    expect(alGuardar).toHaveBeenCalledWith({ orden: 1, cargaKg: 85, reps: 10, confirmada: 'tal_cual' })
  })

  it('salón: «Hecho tal cual» guarda sin RIR, como siempre', () => {
    const registrar = vi.spyOn(db.microciclos, 'registrarSerie').mockImplementation(() => {})
    render(<RegistroSerieSalon microcicloId="m-iso" ejercicio={isometrico()} />)
    fireEvent.click(tal())
    expect(registrar).toHaveBeenCalledWith('m-iso', 'e-esf', { orden: 1, cargaKg: 85, reps: 10, confirmada: 'tal_cual' })
  })
})

describe('un borrador viejo con el RIR estropeado no pasa la puerta', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('rir: null o texto en el borrador cuenta como no elegido', () => {
    localStorage.setItem('alpha-serie-viejo1', JSON.stringify({ cargaKg: 90, reps: 8, rir: 'Control', confirmada: 'editada' }))
    const alGuardar = vi.fn()
    render(<RegistroSerie ejercicio={ejercicio()} orden={1} borradorId="viejo1" onGuardar={alGuardar} />)
    expect(guardarBtn().disabled).toBe(true)
    fireEvent.click(guardarBtn())
    expect(alGuardar).not.toHaveBeenCalled()
  })
})

describe('RegistroSerie (tarjeta de la sesión) · el esfuerzo es obligatorio', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  function montar(conRef = false) {
    const alGuardar = vi.fn()
    const alPoder = vi.fn()
    const ref = createRef<RegistroSerieHandle>()
    render(
      <RegistroSerie
        ref={conRef ? ref : undefined}
        ejercicio={ejercicio()}
        orden={1}
        borradorId="esf1"
        mostrarBoton={!conRef}
        onGuardar={alGuardar}
        onPuedeGuardar={alPoder}
      />,
    )
    return { alGuardar, alPoder, ref }
  }

  it('«Hecho tal cual» sin RIR no guarda y dice que falta el esfuerzo', () => {
    const { alGuardar } = montar()
    expect(tal().disabled).toBe(true)
    fireEvent.click(tal())
    expect(alGuardar).not.toHaveBeenCalled()
    expect(screen.getByText(MOTIVO_SIN_ESFUERZO)).toBeInTheDocument()
  })

  it('con el RIR elegido, «Hecho tal cual» guarda con ese RIR, también el 0', () => {
    const { alGuardar } = montar()
    fireEvent.click(screen.getByRole('button', { name: 'RIR 0' }))
    expect(tal().disabled).toBe(false)
    fireEvent.click(tal())
    expect(alGuardar).toHaveBeenCalledWith({ orden: 1, cargaKg: 85, reps: 10, rir: 0, confirmada: 'tal_cual' })
  })

  it('cambiar un número sin RIR deja «Guardar» apagado; al elegirlo se enciende', async () => {
    const usuario = userEvent.setup()
    const { alGuardar, alPoder } = montar()
    await usuario.click(screen.getByRole('button', { name: 'Subir Carga' }))
    expect(guardarBtn().disabled).toBe(true)
    expect(screen.getByText(MOTIVO_SIN_ESFUERZO)).toBeInTheDocument()
    expect(alPoder).toHaveBeenLastCalledWith(false, MOTIVO_SIN_ESFUERZO)
    await usuario.click(screen.getByRole('button', { name: 'RIR 3' }))
    expect(guardarBtn().disabled).toBe(false)
    expect(alPoder).toHaveBeenLastCalledWith(true, null)
    await usuario.click(guardarBtn())
    expect(alGuardar).toHaveBeenCalledWith({ orden: 1, cargaKg: 86, reps: 10, rir: 3, confirmada: 'editada' })
  })

  it('soltar el RIR (tocar el mismo botón) vuelve a apagar el guardado', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.click(screen.getByRole('button', { name: 'Subir Carga' }))
    await usuario.click(screen.getByRole('button', { name: 'RIR 3' }))
    await usuario.click(screen.getByRole('button', { name: 'RIR 3' }))
    expect(guardarBtn().disabled).toBe(true)
  })

  it('el guardado desde fuera (ref) no guarda una serie editada sin RIR', async () => {
    const usuario = userEvent.setup()
    const { alGuardar, ref } = montar(true)
    await usuario.click(screen.getByRole('button', { name: 'Subir Carga' }))
    ref.current?.guardar()
    expect(alGuardar).not.toHaveBeenCalled()
  })
})

describe('RegistroSerieSalon · el esfuerzo es obligatorio', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  function montar() {
    const registrar = vi.spyOn(db.microciclos, 'registrarSerie').mockImplementation(() => {})
    render(<RegistroSerieSalon microcicloId="m-esf" ejercicio={ejercicio()} />)
    return registrar
  }

  it('«Hecho tal cual» sin RIR no escribe en la base', () => {
    const registrar = montar()
    expect(tal().disabled).toBe(true)
    fireEvent.click(tal())
    expect(registrar).not.toHaveBeenCalled()
    expect(screen.getByText(MOTIVO_SIN_ESFUERZO)).toBeInTheDocument()
  })

  it('editada sin RIR no se guarda; con RIR sí', async () => {
    const usuario = userEvent.setup()
    const registrar = montar()
    await usuario.click(screen.getByRole('button', { name: 'Subir Carga' }))
    expect(guardarBtn().disabled).toBe(true)
    await usuario.click(screen.getByRole('button', { name: 'RIR 1' }))
    await usuario.click(guardarBtn())
    expect(registrar).toHaveBeenCalledWith('m-esf', 'e-esf', {
      orden: 1,
      cargaKg: 86,
      reps: 10,
      rir: 1,
      confirmada: 'editada',
    })
  })
})
