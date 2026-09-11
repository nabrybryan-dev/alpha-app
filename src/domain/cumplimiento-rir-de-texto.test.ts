/**
 * Una serie con TEXTO en el RIR no puede envenenar la desviación de nadie.
 *
 * MEDIDO EN PRODUCCIÓN el 2026-09-11: **55 series de dos personas** guardan texto donde
 * va un número —«Control», «Isometría», «RIR 2-3»—, todas en microciclos cerrados. El
 * tipo dice `rir?: number`, pero el dato baja de un JSONB que nadie valida al leerlo, así
 * que el tipo ahí es una promesa, no una garantía.
 *
 * LO QUE HACÍA, Y POR QUÉ NO SE VEÍA. El filtro era `s.rir !== undefined`, y una cadena lo
 * pasa. Entonces `suma + s.rir` deja de sumar y **pega texto**: `0 + 'Control'` es
 * `'0Control'`, y al dividir sale NaN. No hay excepción, no hay pantalla en rojo: sale un
 * número que no es un número y sigue su camino. `desviacionRirMedia` lo mete en la media
 * —NaN sí es distinto de undefined—, así que **UNA serie envenena el microciclo entero**,
 * y en la Escala Alfa `NaN >= umbral` es siempre falso: el requisito del RIR queda
 * imposible de cumplir sin que nadie sepa por qué.
 *
 * Hoy no muerde a nadie porque esas 55 están en microciclos CERRADOS y la Ruta lee el
 * activo. Esto es para que el día que una caiga en uno vivo, no pase nada.
 */
import { describe, expect, it } from 'vitest'
import { desviacionRir } from './cumplimiento'
import { desviacionRirMedia } from './readiness'
import type { Microciclo, SerieRegistrada } from './types'

const serie = (rir: unknown, reps = 10): SerieRegistrada =>
  ({ orden: 1, cargaKg: 40, reps, rir } as unknown as SerieRegistrada)

const microcicloCon = (series: SerieRegistrada[]): Microciclo =>
  ({
    id: 'm-prueba',
    usuarioId: 'u1',
    numero: 3,
    estado: 'activo',
    cadenciaDias: 7,
    fechaInicio: '2026-09-15',
    sesiones: [
      {
        id: 's1',
        nombre: 'SESIÓN 1',
        orden: 1,
        ejercicios: [
          { id: 'e1', nombre: 'PRENSA', categoria: 'RODILLA', sets: 2, rirObjetivo: 2, series },
          { id: 'e2', nombre: 'REMO', categoria: 'TRACCION', sets: 2, rirObjetivo: 2,
            series: [serie(2), serie(2)] },
        ],
      },
    ],
  } as unknown as Microciclo)

describe('un RIR de texto no cuenta como número', () => {
  it('un ejercicio entero de texto no da desviación, en vez de dar NaN', () => {
    const d = desviacionRir(2, [serie('Control'), serie('Control')])
    expect(d).toBeUndefined()
    expect(Number.isNaN(d as unknown as number)).toBe(false)
  })

  it('con texto MEZCLADO entre números, la media sale de los números', () => {
    // 2 y 4 con objetivo 2 → media 3 → desviación +1. El «Control» se salta.
    expect(desviacionRir(2, [serie(2), serie('Control'), serie(4)])).toBe(1)
  })

  it('UNA serie de texto no envenena el microciclo entero', () => {
    // El otro ejercicio está limpio y clava el objetivo: la media tiene que ser 0.
    const media = desviacionRirMedia(microcicloCon([serie('Isometría'), serie('Isometría')]))
    expect(media).toBe(0)
    expect(Number.isNaN(media as number)).toBe(false)
  })

  it('«RIR 2-3» tampoco: un número escrito como frase no es un número', () => {
    expect(desviacionRir(2, [serie('RIR 2-3'), serie('RIR 2-3')])).toBeUndefined()
  })

  it('y lo que SÍ es un número sigue contando igual que siempre', () => {
    expect(desviacionRir(2, [serie(3), serie(3)])).toBe(1)
    expect(desviacionRir(2, [serie(0), serie(0)])).toBe(-2)
  })
})
