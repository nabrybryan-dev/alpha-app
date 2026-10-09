import { describe, expect, it } from 'vitest'
import { microcicloAnterior } from './microcicloAnterior'
import { sumarDias } from './activacion'
import type { Microciclo } from './types'

/**
 * «EL ANTERIOR» ES EL QUE EMPEZÓ ANTES, NO EL DE NÚMERO MÁS BAJO.
 *
 * La Ruta del asesorado y el panel del coach comparan la fuerza de este microciclo
 * contra el anterior. Hasta el 2026-09-15 los dos elegían el anterior con
 * `filter(numero < actual).sort(numero desc)[0]`, y eso solo vale mientras la
 * numeración no se reinicia. Tres personas de la cartera ya la reiniciaron al
 * cambiar de bloque: su M3 del bloque nuevo convive con el M3 del bloque viejo, y
 * el M1 del bloque nuevo no tiene «anterior» por número aunque venga justo después
 * del M25. Medido ese día: no muerde a ningún activo, es latente. Decisión de
 * Bryan: ordenar por `fechaInicio` y desempatar por `numero`.
 *
 * El historial es ficticio: un bloque viejo 1..25 y uno nuevo 1..8, semanales.
 */

function micro(id: string, numero: number, fechaInicio: string, estado: Microciclo['estado'] = 'cerrado'): Microciclo {
  return { id, usuarioId: 'u-valentina', numero, cadenciaDias: 7, estado, fechaInicio, sesiones: [] }
}

const bloqueViejo = Array.from({ length: 25 }, (_, i) =>
  micro(`m-viejo-${i + 1}`, i + 1, sumarDias('2026-01-05', 7 * i)),
)
const inicioNuevo = sumarDias('2026-01-05', 7 * 25)
const bloqueNuevo = Array.from({ length: 8 }, (_, i) =>
  micro(`m-nuevo-${i + 1}`, i + 1, sumarDias(inicioNuevo, 7 * i), i === 7 ? 'activo' : 'cerrado'),
)
// Mezclado a propósito, y con el bloque viejo delante de los números que se repiten:
// el orden de llegada no puede decidir nada, y un `sort` estable por `numero` se
// quedaría con el primero que llegó.
const historial = [
  ...bloqueViejo.slice(0, 10),
  ...bloqueNuevo.slice(4),
  ...bloqueViejo.slice(10),
  ...bloqueNuevo.slice(0, 4),
]
const nuevo = (n: number) => bloqueNuevo[n - 1]
const viejo = (n: number) => bloqueViejo[n - 1]

describe('microcicloAnterior', () => {
  it('con la numeración reiniciada, el anterior del M3 nuevo es el M2 nuevo y no el M2 del bloque viejo', () => {
    expect(microcicloAnterior(historial, nuevo(3))?.id).toBe('m-nuevo-2')
  })

  it('el anterior del M1 del bloque nuevo es el M25 del bloque viejo', () => {
    expect(microcicloAnterior(historial, nuevo(1))?.id).toBe('m-viejo-25')
  })

  it('el anterior del activo es el que empezó justo antes', () => {
    expect(microcicloAnterior(historial, nuevo(8))?.id).toBe('m-nuevo-7')
  })

  it('dentro de un bloque sin reinicio sigue siendo el número anterior', () => {
    expect(microcicloAnterior(historial, viejo(12))?.id).toBe('m-viejo-11')
  })

  it('el primero de todos no tiene anterior', () => {
    expect(microcicloAnterior(historial, viejo(1))).toBeUndefined()
  })

  it('con la misma fecha de inicio desempata el número', () => {
    const a = micro('m-a', 4, '2026-09-01')
    const b = micro('m-b', 5, '2026-09-01')
    expect(microcicloAnterior([b, a], b)?.id).toBe('m-a')
    expect(microcicloAnterior([b, a], a)).toBeUndefined()
  })

  it('nunca se devuelve a sí mismo, aunque llegue repetido en la lista', () => {
    const actual = nuevo(2)
    expect(microcicloAnterior([actual, { ...actual }, nuevo(1)], actual)?.id).toBe('m-nuevo-1')
  })

  it('no muta la lista que recibe', () => {
    const copia = [...historial]
    microcicloAnterior(historial, nuevo(5))
    expect(historial).toEqual(copia)
  })
})
