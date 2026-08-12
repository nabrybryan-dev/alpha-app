import { describe, expect, it } from 'vitest'
import { alineado, desalineadosDe, revisarAlineacion } from './alineacion'
import type { EjercicioPrescrito } from './types'

function ejercicio(parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e1',
    categoria: 'DOMINANTE DE CADERA',
    nombre: 'Hip thrust con barra',
    cues: '',
    prescripcion: '',
    descansoMin: 3,
    sets: 3,
    rango: '(8-12)',
    repsDiana: 10,
    rirObjetivo: 2,
    series: [],
    ...parcial,
  }
}

/**
 * Los casos de este archivo son los del incidente del 2026-08-12: 128 ejercicios
 * de 13 asesorados leyendo una cosa mientras la app operaba con otra.
 */
describe('revisarAlineacion', () => {
  it('no dice nada cuando la frase y los campos cuadran', () => {
    const e = ejercicio({
      prescripcion: '85KG A 10 REPS; 3 SERIES (RIR 2). PROGRESA +5KG VS M21.',
      cargaKg: 85,
      repsDiana: 10,
      sets: 3,
      rirObjetivo: 2,
    })
    expect(revisarAlineacion(e)).toEqual([])
    expect(alineado(e)).toBe(true)
  })

  /**
   * El caso más repetido del incidente: 63 ejercicios de 9 asesorados. `sets`
   * decide cuándo se da el ejercicio por terminado, así que la app les cerraba
   * la tercera serie que su propia prescripción les estaba pidiendo.
   */
  it('caza las series que la app recorta respecto a la frase', () => {
    const e = ejercicio({
      prescripcion: '19KG A 12 REPS; 3 SERIES (RIR 2). REPITE LA CARGA.',
      cargaKg: 19,
      repsDiana: 12,
      sets: 2,
      rirObjetivo: 2,
    })
    expect(revisarAlineacion(e)).toEqual([{ campo: 'sets', enLaFrase: 3, enElCampo: 2 }])
  })

  /**
   * 69 ejercicios de 6 asesorados. El RIR elige el coeficiente de %1RM: pedir
   * RIR 1 y operar con RIR 2 hace que el motor proponga casi un 5 % menos carga.
   */
  it('caza el RIR que el motor usaría por debajo de lo pedido', () => {
    const e = ejercicio({
      prescripcion: '15KG A 13 REPS; 3 SERIES (RIR 1). REPITE LA CARGA.',
      cargaKg: 15,
      repsDiana: 13,
      sets: 3,
      rirObjetivo: 2,
    })
    expect(revisarAlineacion(e)).toEqual([{ campo: 'rirObjetivo', enLaFrase: 1, enElCampo: 2 }])
  })

  it('lista todos los desajustes de un ejercicio, no solo el primero', () => {
    const e = ejercicio({
      prescripcion: '20KG A 8 REPS; 4 SERIES (RIR 0).',
      cargaKg: 25,
      repsDiana: 10,
      sets: 3,
      rirObjetivo: 2,
    })
    expect(revisarAlineacion(e).map((d) => d.campo)).toEqual([
      'cargaKg',
      'repsDiana',
      'sets',
      'rirObjetivo',
    ])
  })

  /**
   * En un ondulado manda la escalera, que lista las series una a una. Con `sets`
   * por debajo, la app cierra el ejercicio antes de la serie tope —la más pesada
   * de la ondulación ascendente— y la persona nunca llega a hacerla. Pasó.
   */
  it('en un ondulado manda la escalera, no la frase', () => {
    const e = ejercicio({
      prescripcion: 'ONDULACIÓN ASCENDENTE: 45KG×10 · 47.5KG×9 · 50KG×8 (RIR 2).',
      sets: 2,
      seriesPrescritas: [
        { orden: 1, reps: 10, rir: 2, cargaKg: 45 },
        { orden: 2, reps: 9, rir: 2, cargaKg: 47.5 },
        { orden: 3, reps: 8, rir: 2, cargaKg: 50 },
      ],
    })
    expect(revisarAlineacion(e)).toEqual([{ campo: 'sets', enLaFrase: 3, enElCampo: 2 }])
  })

  it('un ondulado con sus series cuadradas no se queja de la carga', () => {
    const e = ejercicio({
      prescripcion: 'ONDULACIÓN ASCENDENTE: 45KG×10 · 47.5KG×9 (RIR 2).',
      sets: 2,
      cargaKg: undefined,
      seriesPrescritas: [
        { orden: 1, reps: 10, rir: 2, cargaKg: 45 },
        { orden: 2, reps: 9, rir: 2, cargaKg: 47.5 },
      ],
    })
    expect(revisarAlineacion(e)).toEqual([])
  })

  /**
   * Las frases sin cabecera legible —porcentajes, peso corporal, tiempo, metros—
   * no se pueden contrastar. Callar es lo correcto: inventarles una discrepancia
   * llenaría el barrido de ruido y nadie volvería a mirarlo.
   */
  it('calla cuando la frase no tiene cabecera que contrastar', () => {
    expect(alineado(ejercicio({ prescripcion: 'PESO CORPORAL A 12 REPS; 3 SERIES (RIR 2).' }))).toBe(true)
    expect(alineado(ejercicio({ prescripcion: '30 SEG POR LADO; 3 SERIES.' }))).toBe(true)
    expect(alineado(ejercicio({ prescripcion: '' }))).toBe(true)
  })

  it('un RIR que no es un número no se contrasta contra uno que sí', () => {
    const e = ejercicio({
      prescripcion: '40KG A 12 REPS; 3 SERIES (RIR 2-3).',
      cargaKg: 40,
      repsDiana: 12,
      sets: 3,
      rirObjetivo: 2,
    })
    expect(revisarAlineacion(e)).toEqual([])
  })

  /**
   * Un campo ausente no está desalineado: está sin rellenar. `cargaKg` está hoy
   * vacío en los 506 ejercicios activos, y tratarlo como desajuste llenaba el
   * barrido de 279 falsos positivos que tapaban los reales.
   */
  it('un campo que todavía no existe no es un desajuste: está por rellenar', () => {
    const e = ejercicio({
      prescripcion: '40KG A 12 REPS; 3 SERIES (RIR 2).',
      repsDiana: 12,
      cargaKg: undefined,
    })
    expect(revisarAlineacion(e)).toEqual([])
  })

  it('pero en cuanto el campo existe y no cuadra, se reporta', () => {
    const e = ejercicio({
      prescripcion: '40KG A 12 REPS; 3 SERIES (RIR 2).',
      repsDiana: 12,
      cargaKg: 45,
    })
    expect(revisarAlineacion(e)).toEqual([{ campo: 'cargaKg', enLaFrase: 40, enElCampo: 45 }])
  })
})

describe('desalineadosDe', () => {
  it('devuelve solo los que fallan, con su id y su nombre', () => {
    const bueno = ejercicio({
      id: 'ok',
      prescripcion: '40KG A 12 REPS; 3 SERIES (RIR 2).',
      cargaKg: 40,
      repsDiana: 12,
      sets: 3,
      rirObjetivo: 2,
    })
    const malo = ejercicio({
      id: 'mal',
      nombre: 'Remo en máquina',
      prescripcion: '19KG A 12 REPS; 3 SERIES (RIR 2).',
      cargaKg: 19,
      repsDiana: 12,
      sets: 2,
      rirObjetivo: 2,
    })
    const r = desalineadosDe([bueno, malo])
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('mal')
    expect(r[0].nombre).toBe('Remo en máquina')
    expect(r[0].desajustes[0].campo).toBe('sets')
  })

  it('una sesión entera alineada devuelve una lista vacía', () => {
    expect(desalineadosDe([ejercicio(), ejercicio({ id: 'e2' })])).toEqual([])
  })
})
