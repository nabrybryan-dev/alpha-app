import { describe, expect, it } from 'vitest'
import { microcicloPropuesto } from './propuestaMicrociclo'
import type { Microciclo } from '../../domain/types'

/**
 * «Generar microciclo» ya no fabrica `-prop`. Ver `src/domain/idDeMicrociclo.ts`.
 *
 * Hasta el 2026-09-15 esta función construía `${origen.id}-prop${n + 1}`: dos
 * propuestas seguidas desde `m-x-1` daban `m-x-1-prop2-prop3`. Con la migración 0081
 * puesta, ese id lo rechaza la base, y desde un teléfono se va a la cola de descartes
 * sin que el coach lo vea.
 */

function micro(parcial: Partial<Microciclo> = {}): Microciclo {
  return {
    id: 'm-x-1',
    usuarioId: 'u-valentina',
    numero: 1,
    cadenciaDias: 7,
    estado: 'activo',
    fechaInicio: '2026-09-01',
    sesiones: [],
    ...parcial,
  }
}

describe('el id de la propuesta', () => {
  it('con el slug de la persona, sigue la regla m-<slug>-<numero>', () => {
    expect(microcicloPropuesto(micro(), { slug: 'valentina-cruz' }).id).toBe('m-valentina-cruz-2')
  })

  it('dos propuestas seguidas no encadenan -prop', () => {
    const primera = microcicloPropuesto(micro(), { slug: 'valentina-cruz' })
    const segunda = microcicloPropuesto({ ...primera, estado: 'activo' }, { slug: 'valentina-cruz' })
    expect(segunda.id).toBe('m-valentina-cruz-3')
    expect(segunda.id).not.toContain('prop')
  })

  it('sin slug —la app desplegada antes de la migración— se queda el id de siempre', () => {
    expect(microcicloPropuesto(micro()).id).toBe('m-x-1-prop2')
  })

  it('no pisa un microciclo ya entrenado que tenga el mismo id', () => {
    const cerrado = micro({ id: 'm-valentina-cruz-2', numero: 2, estado: 'cerrado' })
    expect(() =>
      microcicloPropuesto(micro(), { slug: 'valentina-cruz', existentes: [cerrado] }),
    ).toThrow(/m-valentina-cruz-2/)
  })
})
