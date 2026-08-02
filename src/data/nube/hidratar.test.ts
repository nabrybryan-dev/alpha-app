import { describe, expect, it } from 'vitest'
import { microciclosDe } from './hidratar'
import type { Microciclo } from '../../domain/types'

const blob = (id: string, estado: Microciclo['estado']): Microciclo => ({
  id,
  usuarioId: 'u-ase',
  numero: 22,
  cadenciaDias: 8,
  estado,
  fechaInicio: '2026-07-20',
  sesiones: [],
})

/**
 * La mitad de lectura del arreglo: el estado de un microciclo lo decide la COLUMNA,
 * no el blob. Ver el porqué largo en el encabezado de `microciclosDe`.
 */
describe('microciclosDe', () => {
  it('la columna manda sobre el estado que traiga el blob', () => {
    const [m] = microciclosDe([{ id: 'm22', estado: 'cerrado', datos: blob('m22', 'activo') }])
    expect(m.estado).toBe('cerrado')
  })

  /**
   * EL ESCENARIO QUE LO OBLIGA: el asesorado entrenó sin señal. Su cola sube el
   * microciclo con `estado: 'activo'` dentro del blob, pero el coach ya lo cerró.
   * Si ganara el blob, el servidor tendría dos activos y la persona podría abrir la
   * app y encontrarse la semana pasada.
   */
  it('el blob del asesorado no reabre el microciclo que el coach cerró', () => {
    const microciclos = microciclosDe([
      { id: 'm22', estado: 'cerrado', datos: blob('m22', 'activo') },
      { id: 'm23', estado: 'activo', datos: blob('m23', 'propuesto') },
    ])
    expect(microciclos.filter((m) => m.estado === 'activo')).toHaveLength(1)
    expect(microciclos.find((m) => m.estado === 'activo')?.id).toBe('m23')
  })

  it('conserva todo lo demás del blob: las series no se tocan', () => {
    const conSesiones = {
      ...blob('m22', 'activo'),
      sesiones: [{ id: 's1', nombre: 'FULL A', orden: 1, ejercicios: [] }],
    }
    const [m] = microciclosDe([{ id: 'm22', estado: 'cerrado', datos: conSesiones }])
    expect(m.sesiones).toHaveLength(1)
    expect(m.fechaInicio).toBe('2026-07-20')
  })

  /**
   * Una fila sin columna leída viene de un despliegue anterior. Sin este respaldo
   * el microciclo se quedaría sin estado y desaparecería de todas las pantallas,
   * que buscan `estado === 'activo'`.
   */
  it('sin columna, se queda con el estado del blob', () => {
    const [m] = microciclosDe([{ datos: blob('m22', 'activo') }])
    expect(m.estado).toBe('activo')
  })

  it('no inventa filas ni las reordena', () => {
    const filas = [
      { id: 'm21', estado: 'cerrado', datos: blob('m21', 'cerrado') },
      { id: 'm22', estado: 'activo', datos: blob('m22', 'activo') },
    ]
    expect(microciclosDe(filas).map((m) => m.id)).toEqual(['m21', 'm22'])
  })
})
