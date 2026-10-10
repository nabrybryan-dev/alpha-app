import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/dbInstance'
import { confirmacionTrasCambio, sePuedeGuardar } from '../../domain/confirmacionSerie'
import type { EjercicioPrescrito, SerieRegistrada } from '../../domain/types'
import { RegistroSerie, type RegistroSerieHandle } from './RegistroSerie'
import { RegistroSerieSalon, type RegistroSerieSalonHandle } from './salon/registro/RegistroSerieSalon'

/**
 * LA PAUTA ES UNA SUGERENCIA: no cuenta como hecha hasta «Hecho tal cual» o hasta cambiar un
 * número (decisión del coach, 2026-10-02: «como firmar un recibo»). Hasta entonces el 87,5 %
 * de los registros eran idénticos a lo prescrito y no se sabía qué había hecho cada quien.
 *
 * Se prueba lo mismo en los dos sitios que registran —la tarjeta de la sesión y el salón—.
 */

function ejercicio(parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e-tc',
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

const tal = () => screen.getByRole('button', { name: /^Hecho tal cual/ })
const guardarBtn = () => screen.getByRole('button', { name: /^Guardar serie/ }) as HTMLButtonElement
const carga = () => screen.getByLabelText('Carga en kg') as HTMLInputElement

describe('reglas de la confirmación (unidad)', () => {
  it('sin confirmar no se puede guardar; editada sí', () => {
    expect(sePuedeGuardar(undefined)).toBe(false)
    expect(sePuedeGuardar('editada')).toBe(true)
  })

  it('un cambio real marca editada; el mismo valor no', () => {
    expect(confirmacionTrasCambio(undefined, 85, 86)).toBe('editada')
    expect(confirmacionTrasCambio(undefined, 85, 85)).toBeUndefined()
    expect(confirmacionTrasCambio('editada', 85, 85)).toBe('editada')
  })
})

describe('RegistroSerie (tarjeta de la sesión) · la pauta es sugerencia', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  function montar(conRef = false) {
    const alGuardar = vi.fn()
    const ref = createRef<RegistroSerieHandle>()
    render(
      <RegistroSerie
        ref={conRef ? ref : undefined}
        ejercicio={ejercicio()}
        orden={1}
        borradorId="tc1"
        mostrarBoton={!conRef}
        onGuardar={alGuardar}
      />,
    )
    return { alGuardar, ref }
  }

  it('sin tocar nada «Guardar» está apagado y dice por qué; la pauta se ve como sugerida', () => {
    const { alGuardar } = montar()
    const g = guardarBtn()
    expect(g.disabled).toBe(true)
    // Sin RIR lo primero que falta es el esfuerzo; con él, el motivo vuelve a ser la confirmación.
    expect(screen.getByText(/Marca cuántas repeticiones te quedaban/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'RIR 2' }))
    expect(screen.getByText(/Toca «Hecho tal cual» o cambia la carga o las reps/)).toBeInTheDocument()
    expect(g.getAttribute('aria-describedby')).toBeTruthy()
    expect(screen.getAllByText(/sugerida/).length).toBeGreaterThanOrEqual(2)
    fireEvent.click(g)
    expect(alGuardar).not.toHaveBeenCalled()
  })

  it('el guardado desde fuera (ref) tampoco guarda la pauta en silencio', () => {
    const { alGuardar, ref } = montar(true)
    ref.current?.guardar()
    expect(alGuardar).not.toHaveBeenCalled()
  })

  it('«Hecho tal cual» guarda carga y reps de la pauta con confirmada: tal_cual, con el RIR ya elegido', () => {
    const { alGuardar } = montar()
    fireEvent.click(screen.getByRole('button', { name: 'RIR 2' }))
    fireEvent.click(tal())
    expect(alGuardar).toHaveBeenCalledTimes(1)
    expect(alGuardar).toHaveBeenCalledWith({ orden: 1, cargaKg: 85, reps: 10, rir: 2, confirmada: 'tal_cual' })
  })

  it('el RIR que eligió es el que viaja', () => {
    const { alGuardar } = montar()
    fireEvent.click(screen.getByRole('button', { name: 'RIR 3' }))
    fireEvent.click(tal())
    expect(alGuardar.mock.calls[0][0]).toEqual({ orden: 1, cargaKg: 85, reps: 10, rir: 3, confirmada: 'tal_cual' })
  })

  it('cambiar un número habilita «Guardar» y la serie sale con confirmada: editada', async () => {
    const usuario = userEvent.setup()
    const { alGuardar } = montar()
    await usuario.click(screen.getByRole('button', { name: 'Subir Carga' }))
    await usuario.click(screen.getByRole('button', { name: 'RIR 2' }))
    expect(guardarBtn().disabled).toBe(false)
    expect(screen.queryByRole('button', { name: /^Hecho tal cual/ })).toBeNull()
    await usuario.click(guardarBtn())
    expect(alGuardar).toHaveBeenCalledWith({ orden: 1, cargaKg: 86, reps: 10, rir: 2, confirmada: 'editada' })
  })

  it('entrar y salir del campo sin cambiar nada NO cuenta como editar', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.click(carga())
    await usuario.tab()
    expect(guardarBtn().disabled).toBe(true)
  })

  it('el botón tiene nombre accesible con los números que firma', () => {
    montar()
    expect(tal()).toHaveAccessibleName('Hecho tal cual: 85 kilos, 10 repeticiones')
  })
})

describe('RegistroSerieSalon (salón) · la pauta es sugerencia', () => {
  let espia: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    localStorage.clear()
    espia = vi.spyOn(db.microciclos, 'registrarSerie').mockImplementation(() => {})
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('sin tocar nada no se puede guardar, ni por el botón ni por el mando de fuera', () => {
    const ref = createRef<RegistroSerieSalonHandle>()
    render(<RegistroSerieSalon ref={ref} microcicloId="m-tc" ejercicio={ejercicio()} />)
    expect(guardarBtn().disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'RIR 2' }))
    expect(screen.getByText(/Toca «Hecho tal cual»/)).toBeInTheDocument()
    fireEvent.click(guardarBtn())
    ref.current?.guardar()
    expect(espia).not.toHaveBeenCalled()
  })

  it('«Hecho tal cual» guarda la pauta con la bandera tal_cual, aunque el borrador viejo diga otra cosa', () => {
    localStorage.setItem('alpha-serie-m-tc-e-tc-1', JSON.stringify({ cargaKg: 12, reps: 3 }))
    render(<RegistroSerieSalon microcicloId="m-tc" ejercicio={ejercicio()} />)
    fireEvent.click(screen.getByRole('button', { name: 'RIR 2' }))
    fireEvent.click(tal())
    expect(espia).toHaveBeenCalledTimes(1)
    expect(espia).toHaveBeenCalledWith('m-tc', 'e-tc', { orden: 1, cargaKg: 85, reps: 10, rir: 2, confirmada: 'tal_cual' })
  })

  it('editar guarda con la bandera editada', async () => {
    const usuario = userEvent.setup()
    render(<RegistroSerieSalon microcicloId="m-tc" ejercicio={ejercicio()} />)
    await usuario.click(screen.getByRole('button', { name: 'Bajar Reps' }))
    await usuario.click(screen.getByRole('button', { name: 'RIR 2' }))
    await usuario.click(guardarBtn())
    expect(espia).toHaveBeenCalledWith('m-tc', 'e-tc', { orden: 1, cargaKg: 85, reps: 9, rir: 2, confirmada: 'editada' })
  })
})

describe('series antiguas, sin bandera', () => {
  it('se guardan y se leen tal cual: ausente = «no se sabe»', () => {
    const micro = db.microciclos.byUsuario('u-valentina').find((m) => m.sesiones.some((s) => s.ejercicios.length > 0))!
    const ej = micro.sesiones.find((s) => s.ejercicios.length > 0)!.ejercicios[0]
    const vieja: SerieRegistrada = { orden: 98, cargaKg: 50, reps: 8, rir: 2 }
    const nueva: SerieRegistrada = { orden: 99, cargaKg: 50, reps: 8, confirmada: 'tal_cual' }
    db.microciclos.registrarSerie(micro.id, ej.id, vieja)
    db.microciclos.registrarSerie(micro.id, ej.id, nueva)
    const leido = db.microciclos
      .byUsuario('u-valentina')
      .find((m) => m.id === micro.id)!
      .sesiones.flatMap((s) => s.ejercicios)
      .find((e) => e.id === ej.id)!
    expect(leido.series.find((s) => s.orden === 98)).toEqual(vieja)
    expect(leido.series.find((s) => s.orden === 98)).not.toHaveProperty('confirmada')
    expect(leido.series.find((s) => s.orden === 99)?.confirmada).toBe('tal_cual')
  })
})
