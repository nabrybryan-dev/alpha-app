import { describe, expect, it } from 'vitest'
import { cargaPorGrupo, grupoDeCategoria } from './fatiga'
import type { EjercicioPrescrito, Microciclo } from './types'

let contador = 0

function ejercicio(categoria: string, sets: number, seriesHechas: number): EjercicioPrescrito {
  contador += 1
  return {
    id: `e-test-${contador}`,
    categoria,
    nombre: categoria,
    cues: '',
    prescripcion: '',
    descansoMin: 2,
    sets,
    rango: '8-10',
    repsDiana: 8,
    rirObjetivo: 2,
    series: Array.from({ length: seriesHechas }, (_, i) => ({
      orden: i + 1,
      cargaKg: 40,
      reps: 8,
      rir: 2,
    })),
  }
}

function microciclo(ejercicios: EjercicioPrescrito[]): Microciclo {
  return {
    id: 'm-test',
    usuarioId: 'u-test',
    numero: 1,
    cadenciaDias: 8,
    estado: 'activo',
    fechaInicio: '2026-07-10',
    sesiones: [{ id: 's1', nombre: 'UPPER A', orden: 1, ejercicios }],
  }
}

describe('grupoDeCategoria', () => {
  it('mapea las categorías del PANEL a grupos musculares', () => {
    expect(grupoDeCategoria('EMPUJE HORIZONTAL')).toBe('Pecho')
    expect(grupoDeCategoria('AISLAMIENTO PECTORAL')).toBe('Pecho')
    expect(grupoDeCategoria('DELTOIDES LATERALES')).toBe('Hombros')
    expect(grupoDeCategoria('EMPUJE VERTICAL')).toBe('Hombros')
    expect(grupoDeCategoria('TRACCION VERTICAL')).toBe('Espalda')
    expect(grupoDeCategoria('ESPALDA SUPERIOR')).toBe('Espalda')
    expect(grupoDeCategoria('TRÍCEPS')).toBe('Tríceps')
    expect(grupoDeCategoria('BÍCEPS')).toBe('Bíceps')
    expect(grupoDeCategoria('SENTADILLAS')).toBe('Cuádriceps')
    expect(grupoDeCategoria('BISAGRA DE CADERA')).toBe('Isquios')
    expect(grupoDeCategoria('AISLAMIENTO GLÚTEOS')).toBe('Glúteos')
    expect(grupoDeCategoria('PANTORRILLAS')).toBe('Pantorrillas')
  })

  it('resuelve la taxonomía simplificada de la app usando el nombre del ejercicio', () => {
    expect(grupoDeCategoria('DOMINANTE DE CADERA', 'Hip thrust con barra')).toBe('Glúteos')
    expect(grupoDeCategoria('DOMINANTE DE CADERA', 'Peso muerto rumano con barra')).toBe('Isquios')
    expect(grupoDeCategoria('DOMINANTE DE RODILLA', 'Prensa 45° pies altos')).toBe('Cuádriceps')
    expect(grupoDeCategoria('AISLAMIENTO', 'Curl femoral sentado')).toBe('Isquios')
    expect(grupoDeCategoria('AISLAMIENTO', 'Abducción de cadera en máquina')).toBe('Glúteos')
    expect(grupoDeCategoria('AISLAMIENTO', 'Elevaciones laterales con mancuernas')).toBe('Hombros')
    expect(grupoDeCategoria('AISLAMIENTO', 'Curl de bíceps en banco inclinado')).toBe('Bíceps')
    expect(grupoDeCategoria('AISLAMIENTO', 'Extensión de tríceps en polea con cuerda')).toBe('Tríceps')
    expect(grupoDeCategoria('AISLAMIENTO', 'Elevación de gemelo de pie')).toBe('Pantorrillas')
    expect(grupoDeCategoria('CORE', 'Plancha con carga')).toBe('Abdomen')
  })

  it('devuelve undefined para categorías no musculares', () => {
    expect(grupoDeCategoria('CARDIO HIIT')).toBeUndefined()
    expect(grupoDeCategoria('ENTRADA/PASARELA')).toBeUndefined()
  })
})

describe('cargaPorGrupo', () => {
  it('suma series hechas y pautadas por grupo a través de ejercicios', () => {
    const m = microciclo([
      ejercicio('EMPUJE HORIZONTAL', 3, 3),
      ejercicio('AISLAMIENTO PECTORAL', 3, 0),
    ])
    const pecho = cargaPorGrupo(m).find((c) => c.grupo === 'Pecho')
    expect(pecho).toMatchObject({ seriesHechas: 3, seriesPautadas: 6, pct: 50, nivel: 'en-trabajo' })
  })

  it('clasifica fresco (<25%) y cargado (>=75%)', () => {
    const m = microciclo([ejercicio('BÍCEPS', 4, 0), ejercicio('TRÍCEPS', 4, 4)])
    const carga = cargaPorGrupo(m)
    expect(carga.find((c) => c.grupo === 'Bíceps')?.nivel).toBe('fresco')
    expect(carga.find((c) => c.grupo === 'Tríceps')?.nivel).toBe('cargado')
  })

  it('el pct se limita a 100 aunque se registren series extra', () => {
    const m = microciclo([ejercicio('SENTADILLAS', 2, 4)])
    expect(cargaPorGrupo(m)[0].pct).toBe(100)
  })

  it('excluye categorías desconocidas', () => {
    const m = microciclo([ejercicio('CARDIO HIIT', 4, 2)])
    expect(cargaPorGrupo(m)).toHaveLength(0)
  })
})
