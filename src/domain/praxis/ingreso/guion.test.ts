import { describe, expect, it } from 'vitest'
import {
  CAMPOS_INGRESO, PREGUNTAS_POR_TEMA, TEMAS_SALUD, TURNOS_VOZ, camposAplicables, camposDeSalud, campoPorId, toquesPorTemas,
} from './guion.ts'

describe('guion mixto del ingreso', () => {
  it('REGLA DURA: todo campo de salud es toque, nunca voz', () => {
    expect(camposDeSalud().length).toBeGreaterThanOrEqual(9)
    for (const c of camposDeSalud()) expect(c.modo, c.id).toBe('toque')
    for (const c of CAMPOS_INGRESO.filter((x) => x.modo === 'voz')) expect(c.salud, c.id).toBe(false)
  })

  it('el PAR-Q y los datos de salud conocidos están marcados como salud', () => {
    for (const id of [
      'parq_enfermedad_cardiaca', 'parq_medicamento_presion', 'parq_huesos_articulaciones', 'lesiones',
      'ejercicios_limitados', 'medicacion', 'alergias_restricciones', 'tca_historia', 'solo_mujeres_ciclo',
    ]) {
      const c = campoPorId(id)
      expect(c, id).toBeDefined()
      expect(c?.salud, id).toBe(true)
      expect(c?.modo, id).toBe('toque')
    }
  })

  it('los toques de salud de sí/no tienen exactamente Sí y No', () => {
    for (const c of camposDeSalud().filter((x) => x.tipo === 'si_no')) expect(c.opciones, c.id).toEqual(['Sí', 'No'])
  })

  it('cada campo de voz pertenece a un turno y cada turno nombra solo campos de voz que existen', () => {
    const enTurnos = new Set(TURNOS_VOZ.flatMap((t) => t.campos))
    for (const c of CAMPOS_INGRESO.filter((x) => x.modo === 'voz')) {
      expect(c.turno, c.id).toBeDefined()
      expect(enTurnos.has(c.id), c.id).toBe(true)
    }
    for (const t of TURNOS_VOZ) {
      for (const id of t.campos) {
        const c = campoPorId(id)
        expect(c, id).toBeDefined()
        expect(c?.modo, id).toBe('voz')
        expect(c?.turno, id).toBe(t.id)
      }
    }
  })

  it('son pocos turnos naturales, y cortos', () => {
    expect(TURNOS_VOZ.length).toBeLessThanOrEqual(6)
    for (const t of TURNOS_VOZ) {
      expect(t.pregunta.split(/\s+/).length, t.id).toBeLessThanOrEqual(30)
      expect(t.pregunta, t.id).not.toMatch(/\busted\b/i)
    }
  })

  it('los campos de opción traen sus opciones y los ids no se repiten', () => {
    for (const c of CAMPOS_INGRESO.filter((x) => x.tipo === 'opcion')) expect(c.opciones?.length ?? 0, c.id).toBeGreaterThan(1)
    const ids = CAMPOS_INGRESO.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('cada tema de salud se traduce en preguntas de toque que existen y son de salud', () => {
    for (const t of TEMAS_SALUD) {
      expect(PREGUNTAS_POR_TEMA[t].length, t).toBeGreaterThan(0)
      for (const id of PREGUNTAS_POR_TEMA[t]) expect(campoPorId(id)?.salud, `${t}→${id}`).toBe(true)
    }
    expect(toquesPorTemas(['lesion', 'dolor'])).toEqual(['lesiones', 'parq_huesos_articulaciones'])
  })

  it('las condiciones filtran: el ciclo solo a mujeres y el detalle de medicación solo tras el PAR-Q', () => {
    const ids = (t: Record<string, string>) => camposAplicables('toque', t).map((c) => c.id)
    expect(ids({ genero: 'Masculino' })).not.toContain('solo_mujeres_ciclo')
    expect(ids({ genero: 'Femenino' })).toContain('solo_mujeres_ciclo')
    expect(ids({ parq_medicamento_presion: 'No' })).not.toContain('medicacion')
    expect(ids({ parq_medicamento_presion: 'Sí' })).toContain('medicacion')
  })
})
