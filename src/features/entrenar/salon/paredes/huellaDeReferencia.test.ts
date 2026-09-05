import { describe, expect, it } from 'vitest'
import { huellaDeReferencia } from './huellaDeReferencia'
import type { EjercicioPrescrito, Microciclo, SerieRegistrada } from '../../../../domain/types'

/**
 * QUÉ FANTASMA SE ENSEÑA, PROBADO.
 *
 * Lo que no puede pasar: enseñar la semana pasada teniendo hoy, enseñar una repetición de
 * OTRO ejercicio, o inventar un fantasma cuando no hay ninguna medida.
 */

const huella = (marca: number) => ({ duracionSeg: 2, fase: [0, marca, 1] })

function serie(orden: number, conHuella?: number): SerieRegistrada {
  return {
    orden,
    cargaKg: 80,
    reps: 8,
    rir: 2,
    ...(conHuella !== undefined
      ? { velocidad: { pvPct: 12, hayEscala: false, calidad: 'buena', huella: huella(conHuella) } }
      : {}),
  }
}

function ejercicio(parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e1',
    categoria: 'EMPUJE HORIZONTAL',
    nombre: 'Press de banca con barra',
    cues: '',
    prescripcion: '',
    descansoMin: 3,
    sets: 3,
    rango: '(8-10)',
    repsDiana: 8,
    rirObjetivo: 2,
    series: [],
    ...parcial,
  }
}

function microciclo(ejercicios: EjercicioPrescrito[]): Microciclo {
  return {
    id: 'm-previo',
    usuarioId: 'u1',
    numero: 3,
    cadenciaDias: 8,
    estado: 'cerrado',
    sesiones: [{ id: 's1', nombre: 'EMPUJE', orden: 1, ejercicios }],
  } as unknown as Microciclo
}

describe('huellaDeReferencia', () => {
  it('hoy manda: la última serie de HOY con huella, por orden', () => {
    const hoy = ejercicio({ series: [serie(1, 0.3), serie(3, 0.9), serie(2, 0.6)] })
    const previo = microciclo([ejercicio({ series: [serie(1, 0.1)] })])
    const r = huellaDeReferencia(hoy, previo)!
    expect(r.cuando).toBe('hoy')
    expect(r.huella.fase[1]).toBe(0.9)
  })

  it('sin huella hoy, la semana pasada del MISMO ejercicio por nombre', () => {
    const hoy = ejercicio({ series: [serie(1)] })
    const previo = microciclo([
      ejercicio({ id: 'otro', nombre: 'Remo con barra', series: [serie(1, 0.2)] }),
      ejercicio({ id: 'x', nombre: '  PRESS DE BANCA CON BARRA ', series: [serie(1, 0.4), serie(2, 0.7)] }),
    ])
    const r = huellaDeReferencia(hoy, previo)!
    expect(r.cuando).toBe('semana-pasada')
    expect(r.huella.fase[1]).toBe(0.7)
  })

  it('la huella articular del vídeo manda sobre las de barra, de hoy y de la semana pasada', () => {
    const hoy = ejercicio({ series: [serie(1, 0.3)] })
    const previo = microciclo([ejercicio({ series: [serie(1, 0.1)] })])
    const articular = { duracionSeg: 2.4, fase: [1, 0, 1], articular: { rodillaFlex: [0, 115, 0] } }
    const r = huellaDeReferencia(hoy, previo, articular)!
    expect(r.cuando).toBe('video')
    expect(r.huella).toBe(articular)
    // Una «articular» sin ángulos no manda: vuelve a la de hoy.
    expect(huellaDeReferencia(hoy, previo, { duracionSeg: 2, fase: [1, 0, 1] })!.cuando).toBe('hoy')
  })

  it('sin medida en ningún sitio, no hay fantasma', () => {
    expect(huellaDeReferencia(ejercicio(), microciclo([ejercicio()]))).toBeUndefined()
    expect(huellaDeReferencia(ejercicio(), undefined)).toBeUndefined()
    expect(huellaDeReferencia(undefined, undefined)).toBeUndefined()
  })

  it('una huella sin trayectoria no cuenta', () => {
    const rota = ejercicio({
      series: [{ ...serie(1), velocidad: { pvPct: 0, hayEscala: false, calidad: 'buena', huella: { duracionSeg: 2, fase: [0.5] } } }],
    })
    expect(huellaDeReferencia(rota, undefined)).toBeUndefined()
  })
})
