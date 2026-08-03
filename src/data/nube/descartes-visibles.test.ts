import { beforeEach, describe, expect, it } from 'vitest'
import { descartesPendientes, type OperacionPendiente } from './cola'

const CLAVE_DESCARTES = 'alpha-cola-descartes'

function apartar(ops: Partial<OperacionPendiente>[]): void {
  const completas = ops.map((op) => ({
    tabla: 'registro_comida',
    tipo: 'upsert' as const,
    payload: {},
    ...op,
  }))
  localStorage.setItem(CLAVE_DESCARTES, JSON.stringify(completas))
}

/**
 * El contador que hace visible lo que se descartó en silencio.
 *
 * El descarte protege el registro local de una cola atascada y eso está bien;
 * lo que faltaba era decirlo. El registro de comidas estuvo semanas sin subir y
 * el asesorado siguió anotando su día sin ver un solo aviso.
 */
describe('descartesPendientes', () => {
  beforeEach(() => localStorage.clear())

  it('sin nada apartado, no hay nada que avisar', () => {
    expect(descartesPendientes('u1')).toBe(0)
  })

  it('cuenta lo que se apartó', () => {
    apartar([{}, {}, {}])
    expect(descartesPendientes('u1')).toBe(3)
  })

  it('solo cuenta lo suyo: en un móvil compartido, lo de otro no es asunto suyo', () => {
    // Es la misma regla que aplica el rescate: lo sellado con dueño solo vuelve
    // cuando entra esa persona.
    apartar([{ duenio: 'u1' }, { duenio: 'u2' }, { duenio: 'u1' }])
    expect(descartesPendientes('u1')).toBe(2)
    expect(descartesPendientes('u2')).toBe(1)
  })

  it('lo que no tiene dueño sellado cuenta para quien pregunte', () => {
    // Es de antes de que se sellara el dueño: no se puede atribuir a nadie, y
    // esconderlo sería peor que atribuirlo de más.
    apartar([{}, { duenio: 'u2' }])
    expect(descartesPendientes('u1')).toBe(1)
  })

  it('un montón corrupto no rompe la pantalla', () => {
    localStorage.setItem(CLAVE_DESCARTES, 'esto no es json')
    expect(descartesPendientes('u1')).toBe(0)
  })

  it('sin usuario, cuenta solo lo que no tiene dueño', () => {
    apartar([{}, { duenio: 'u1' }])
    expect(descartesPendientes()).toBe(1)
  })
})
