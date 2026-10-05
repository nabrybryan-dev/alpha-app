import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { HuecoDeDatos } from './HuecoDeDatos'
import type { EjercicioPrescrito } from '../../../../domain/types'

/**
 * EL HUECO DE LOS KILOS CON UN PESO QUE NO ES NÚMERO.
 *
 * `cargaKg` es opcional en el tipo, pero los planes reales guardan `null` cuando el ③ no pone
 * kilos. El hueco comparaba contra `undefined`, dejaba pasar el `null` y llamaba a
 * `toFixed` sobre él: la pantalla de Entrenar entera caía al ErrorBoundary. Visto en
 * producción el 14-sep (Juliana) y medido contra los planes reales: 45 ejercicios en 6
 * asesorados. Las dos pruebas van en pareja: sin kilos no revienta, y con kilos los sigue
 * enseñando.
 */

function ejercicio(parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e1',
    categoria: 'EXTENSIÓN DE CADERA',
    nombre: 'Empuje de cadera con barra',
    cues: '',
    prescripcion: 'PESO CORPORAL A 12 REPS; 3 SERIES.',
    descansoMin: 1.5,
    sets: 3,
    rango: '10-12',
    repsDiana: 12,
    rirObjetivo: 2,
    series: [],
    ...parcial,
  }
}

function hueco(ej: EjercicioPrescrito, cargaPrevia?: number) {
  return render(
    <HuecoDeDatos
      muestra="carga"
      ejercicio={ej}
      textoDeCarga="Sin kilos: peso corporal"
      cargaPrevia={cargaPrevia}
      modo="sesion"
      anclas={{} as never}
      alTerminarLaCuenta={() => {}}
    />,
  )
}

describe('HuecoDeDatos con la carga', () => {
  it('con `cargaKg: null` no revienta: enseña la frase de carga y no un número', () => {
    const { container } = hueco(ejercicio({ cargaKg: null as never }), 20)
    expect(container.textContent).toContain('Sin kilos: peso corporal')
    expect(container.textContent).not.toMatch(/\bnull\b|La semana pasada/)
  })

  it('con kilos de verdad los sigue enseñando, con la comparación de la semana pasada', () => {
    const { container } = hueco(ejercicio({ cargaKg: 32.5 }), 30)
    expect(container.textContent).toContain('32,5')
    expect(container.textContent).toContain('La semana pasada')
  })
})
