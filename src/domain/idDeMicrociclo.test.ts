import { describe, expect, it } from 'vitest'
import { idDeMicrocicloNuevo } from './idDeMicrociclo'
import type { Microciclo } from './types'

/**
 * EL ID DE UN MICROCICLO NUEVO DICE DE QUIÉN ES Y CUÁL ES: `m-<slug>-<numero>`.
 *
 * Decisión de Bryan del 2026-09-15. Hasta ese día la app fabricaba
 * `${origen.id}-prop${n}`, así que cada «Generar microciclo» añadía otro sufijo y el
 * id acababa contando la historia (`m-x-1-prop2-prop3`). En la base había 15 así.
 *
 * El slug es uno por persona y lo guarda la base (`usuarios_app.slug`, migración
 * 0081). La app no lo inventa: si la persona aún no lo tiene —la app se despliega
 * ANTES de aplicar la migración—, se queda el id de siempre, porque un id con la regla
 * y un slug inventado lo rechazaría el trigger igual que un `-prop`.
 */

function micro(id: string, numero: number, estado: Microciclo['estado']): Microciclo {
  return { id, usuarioId: 'u-valentina', numero, cadenciaDias: 7, estado, fechaInicio: '2026-09-01', sesiones: [] }
}

describe('idDeMicrocicloNuevo', () => {
  it('con slug sigue la regla m-<slug>-<numero>', () => {
    expect(idDeMicrocicloNuevo({ slug: 'valentina-cruz', numero: 23, origenId: 'm22', existentes: [] })).toBe(
      'm-valentina-cruz-23',
    )
  })

  it('no arrastra la historia del id de origen', () => {
    expect(
      idDeMicrocicloNuevo({ slug: 'valentina-cruz', numero: 3, origenId: 'm-x-1-prop2', existentes: [] }),
    ).toBe('m-valentina-cruz-3')
  })

  it('sin slug —antes de la 0081— se queda el id de siempre', () => {
    expect(idDeMicrocicloNuevo({ slug: undefined, numero: 23, origenId: 'm22', existentes: [] })).toBe('m22-prop23')
  })

  it('un slug vacío o en blanco cuenta como que no hay slug', () => {
    expect(idDeMicrocicloNuevo({ slug: '  ', numero: 23, origenId: 'm22', existentes: [] })).toBe('m22-prop23')
  })

  it('un slug que no tiene la forma de la base no se usa a medias: falla y lo dice', () => {
    expect(() =>
      idDeMicrocicloNuevo({ slug: 'Valentina Cruz', numero: 23, origenId: 'm22', existentes: [] }),
    ).toThrow(/Valentina Cruz/)
  })

  /**
   * La numeración se reinicia al cambiar de bloque. Con la regla, el M9 del bloque
   * nuevo tendría el MISMO id que el M9 del bloque viejo, y la subida es un upsert por
   * id: la propuesta se escribiría encima de una semana ya entrenada, sin error.
   */
  it('si el id ya es de un microciclo que no es una propuesta, no lo pisa: falla y dice cuál', () => {
    const cerrado = micro('m-valentina-cruz-9', 9, 'cerrado')
    expect(() =>
      idDeMicrocicloNuevo({ slug: 'valentina-cruz', numero: 9, origenId: 'm-valentina-cruz-8', existentes: [cerrado] }),
    ).toThrow(/m-valentina-cruz-9/)
  })

  it('si el id es de una propuesta guardada del mismo número, la reemplaza', () => {
    const guardada = micro('m-valentina-cruz-9', 9, 'propuesto')
    expect(
      idDeMicrocicloNuevo({ slug: 'valentina-cruz', numero: 9, origenId: 'm-valentina-cruz-8', existentes: [guardada] }),
    ).toBe('m-valentina-cruz-9')
  })
})
