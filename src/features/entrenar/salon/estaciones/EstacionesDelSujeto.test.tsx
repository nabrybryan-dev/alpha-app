import { fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { EjercicioPrescrito } from '../../../../domain/types'
import type { ClaveDeEstacion } from './estacionesDeLaSerie'
import { EstacionesDelSujeto } from './EstacionesDelSujeto'

/**
 * LA CIFRA ENTRA, SE LEE Y SE RETIRA; Y VUELVE TOCANDO EL POSTE.
 *
 * Nace en rojo el 2026-09-11. Hasta ese día las cuatro cifras daban vueltas alrededor del
 * cuerpo en un ciclo que no terminaba, diciendo lo mismo que el muro de enfrente ya dice
 * grande y quieto, y tapando un 2,34 % de la pantalla medido contra un ruido del 0,03 %.
 * Decisión de Bryan: que se retiren y vuelvan al tocar.
 *
 * Aquí se comprueba la DECISIÓN, no los píxeles: que a los 3,8 s la cifra está marcada como
 * retirada, que tocar el poste la devuelve, y que el poste —lo que queda plantado— es lo
 * que se toca. Los píxeles son de `testigo/cifras-que-se-pisan.mjs`, que necesita un navegador.
 */

const EJERCICIO: EjercicioPrescrito = {
  id: 'e1',
  nombre: 'Sentadilla goblet',
  categoria: 'sentadilla',
  sets: 3,
  repsDiana: 12,
  rango: '(10-14)',
  descansoMin: 2,
  rirObjetivo: 2,
  cues: '',
  prescripcion: '',
  series: [],
}

function pintar(foco?: ClaveDeEstacion, alEnfacar?: (clave: ClaveDeEstacion) => void) {
  return render(
    <EstacionesDelSujeto
      ejercicio={EJERCICIO}
      azimut={0}
      suelo={658}
      foco={foco}
      onEnfocar={alEnfacar ?? (() => {})}
    />,
  )
}

const cifraDe = (clave: string) =>
  document.querySelector(`[data-cartel="${clave}"] .estacion-cifra`) as HTMLElement

describe('EstacionesDelSujeto', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('al llegar al ejercicio las cuatro cifras están puestas, para leerlas', () => {
    pintar()
    for (const clave of ['series', 'reps', 'descanso', 'rir']) {
      expect(cifraDe(clave).hasAttribute('data-retirada')).toBe(false)
    }
  })

  it('a los 3,8 s se retiran las cuatro: la prescripción se queda en el muro', () => {
    pintar()
    act(() => void vi.advanceTimersByTime(3800))
    for (const clave of ['series', 'reps', 'descanso', 'rir']) {
      expect(cifraDe(clave).hasAttribute('data-retirada')).toBe(true)
    }
  })

  it('el poste sigue plantado después de retirarse la cifra, y es lo que se toca', () => {
    pintar()
    act(() => void vi.advanceTimersByTime(3800))
    const postes = document.querySelectorAll('button[data-poste]')
    expect(postes).toHaveLength(4)
    // Y el cartel ya no es un botón: si lo fuera, quedaría una zona sensible invisible
    // colgada de donde estuvo el número.
    expect(document.querySelectorAll('button.estacion-cartel')).toHaveLength(0)
  })

  it('tocar el poste pide enfocar esa estación', () => {
    const alEnfocar = vi.fn()
    pintar(undefined, alEnfocar)
    act(() => void vi.advanceTimersByTime(3800))
    fireEvent.click(screen.getByRole('button', { name: /Descanso: 2/ }))
    expect(alEnfocar).toHaveBeenCalledWith('descanso')
  })

  it('la estación enfocada vuelve a verse aunque la lectura ya haya pasado', () => {
    pintar('descanso')
    act(() => void vi.advanceTimersByTime(3800))
    expect(cifraDe('descanso').hasAttribute('data-retirada')).toBe(false)
    expect(cifraDe('descanso').hasAttribute('data-fija')).toBe(true)
    // Y solo esa: las otras tres siguen retiradas.
    expect(cifraDe('series').hasAttribute('data-retirada')).toBe(true)
  })
})
