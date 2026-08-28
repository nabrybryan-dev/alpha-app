import { describe, expect, it } from 'vitest'
import {
  cargaSugerida,
  componerPrescripcion,
  parsearOndulada,
  parsearPrescripcion,
} from './prescripcion'
import type { EjercicioPrescrito } from './types'

/**
 * Los textos de este archivo imitan la forma de las prescripciones reales pero
 * **no son de nadie**: números y notas inventados. La forma es lo que se prueba.
 */

function ejercicio(parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e-test',
    categoria: 'DOMINANTE DE CADERA',
    nombre: 'Ejercicio de prueba',
    cues: '',
    prescripcion: '',
    descansoMin: 2,
    sets: 3,
    rango: '(8-12)',
    repsDiana: 10,
    rirObjetivo: 2,
    series: [],
    ...parcial,
  }
}

describe('parsearPrescripcion · cabecera canónica', () => {
  it('separa carga, unidad y nota de la forma canónica', () => {
    const r = parsearPrescripcion('60KG A 10 REPS; 3 SERIES (RIR 2). RANGO COMPLETO')
    expect(r.cargaKg).toBe(60)
    expect(r.unidadCarga).toBe('kg')
    expect(r.notaCoach).toBe('RANGO COMPLETO')
  })

  it('lee la carga decimal sin romperla', () => {
    // El fallo de la Fase 2: "16.KG". El punto decimal es parte del número.
    const r = parsearPrescripcion('62.5KG A 10 REPS; 3 SERIES (RIR 1). CONSOLIDA')
    expect(r.cargaKg).toBe(62.5)
  })

  it('acepta la coma decimal', () => {
    expect(parsearPrescripcion('17,5KG A 8 REPS; 3 SERIES (RIR 2). NOTA').cargaKg).toBe(17.5)
  })

  it('reconoce TOTAL entre la carga y las reps', () => {
    const r = parsearPrescripcion('81KG TOTAL A 9 REPS; 3 SERIES (RIR 1). ES EL ÚNICO REST-PAUSE')
    expect(r.cargaKg).toBe(81)
    expect(r.unidadCarga).toBe('total')
    expect(r.notaCoach).toBe('ES EL ÚNICO REST-PAUSE')
  })

  it('reconoce TOTALES en plural', () => {
    expect(parsearPrescripcion('35KG TOTALES A 10 REPS; 3 SERIES (RIR 3). NOTA').unidadCarga).toBe(
      'total',
    )
  })

  it('reconoce POR PIERNA', () => {
    const r = parsearPrescripcion('80KG POR PIERNA A 12 REPS; 3 SERIES (RIR 1). LÍNEA BASE')
    expect(r.cargaKg).toBe(80)
    expect(r.unidadCarga).toBe('por lado')
  })

  it('reconoce POR MANO, que no es lo mismo que por lado', () => {
    // Mancuernas: 15KG por mano son 30KG movidos. Confundirlo con "total"
    // duplicaría la carga en la progresión.
    const r = parsearPrescripcion('15KG POR MANO A 10 REPS; 3 SERIES (RIR 2). NOTA')
    expect(r.unidadCarga).toBe('por mano')
  })

  it('reconoce la unidad cuando va después de las reps', () => {
    const r = parsearPrescripcion('20KG A 8 REPS POR PIERNA; 3 SERIES. FOCO EN CONTROL')
    expect(r.cargaKg).toBe(20)
    expect(r.unidadCarga).toBe('por lado')
    expect(r.notaCoach).toBe('FOCO EN CONTROL')
  })
})

describe('parsearPrescripcion · lo que NO debe confundir', () => {
  it('no toma el TOTAL de la nota del coach como unidad de carga', () => {
    // Este es el caso que producía `null`: "TOTAL" aparece en la nota, no en la
    // cabecera. La unidad se lee solo de la cabecera.
    const r = parsearPrescripcion(
      '21KG A 8 REPS; 3 SERIES (RIR 1). ANOTA EL LASTRE, NO EL TOTAL: EN M18 QUEDÓ UN NÚMERO QUE NO CUADRA.',
    )
    expect(r.cargaKg).toBe(21)
    expect(r.unidadCarga).toBe('kg')
    expect(r.notaCoach).toBe('ANOTA EL LASTRE, NO EL TOTAL: EN M18 QUEDÓ UN NÚMERO QUE NO CUADRA.')
  })

  it('no toma un número de la nota como carga', () => {
    const r = parsearPrescripcion(
      '62.5KG TOTAL A 10 REPS; 3 SERIES (RIR 1). CONSOLIDA LOS 61.5 QUE MOVISTE.',
    )
    expect(r.cargaKg).toBe(62.5)
    expect(r.notaCoach).toBe('CONSOLIDA LOS 61.5 QUE MOVISTE.')
  })

  it('no corta la nota del coach a media oración', () => {
    const texto =
      '13KG A 15 REPS; 2 SERIES (RIR 1). PROGRESA +1KG VS M19. PAUTAMOS 25 Y ANOTASTE 11: CONFIRMA SI LA MÁQUINA MARCA POR LADO O EN PLACAS. VAMOS CON TU NÚMERO REAL.'
    const r = parsearPrescripcion(texto)
    expect(r.notaCoach).toBe(
      'PROGRESA +1KG VS M19. PAUTAMOS 25 Y ANOTASTE 11: CONFIRMA SI LA MÁQUINA MARCA POR LADO O EN PLACAS. VAMOS CON TU NÚMERO REAL.',
    )
  })

  it('no inventa carga cuando la prescripción es de porcentajes', () => {
    const r = parsearPrescripcion(
      'ONDULACIÓN ASCENDENTE SOBRE TU PROPIA CARGA: SERIE 1 AL 90% × 12 REPS · SERIE 2 AL 100% × 10 REPS (RIR 2). LOS PONES TÚ.',
    )
    expect(r.cargaKg).toBeUndefined()
    expect(r.reconocida).toBe(false)
  })

  it('no inventa carga cuando el coach pide que la registre el asesorado', () => {
    const r = parsearPrescripcion('REGISTRA TU CARGA A 11 REPS; 3 SERIES (RIR 3). ESE ES EL PUNTO CERO.')
    expect(r.cargaKg).toBeUndefined()
    expect(r.reconocida).toBe(false)
  })

  it('no inventa carga en trabajo sin peso', () => {
    expect(parsearPrescripcion('30 SEG POR LADO; 3 SERIES. DESCALZA.').cargaKg).toBeUndefined()
    expect(parsearPrescripcion('PESO CORPORAL A 12 REPS; 3 SERIES (RIR 2).').cargaKg).toBeUndefined()
    expect(parsearPrescripcion('30 METROS; 3 SERIES.').cargaKg).toBeUndefined()
  })

  it('no revienta con texto vacío', () => {
    const r = parsearPrescripcion('')
    expect(r.cargaKg).toBeUndefined()
    expect(r.reconocida).toBe(false)
    expect(r.notaCoach).toBe('')
  })
})

describe('componerPrescripcion', () => {
  it('escribe la cabecera canónica desde los campos', () => {
    const e = ejercicio({ cargaKg: 60, unidadCarga: 'kg', repsDiana: 10, sets: 3, rirObjetivo: 2 })
    expect(componerPrescripcion(e)).toBe('60KG A 10 REPS; 3 SERIES (RIR 2).')
  })

  it('pega la nota del coach detrás, intacta', () => {
    const e = ejercicio({
      cargaKg: 60,
      unidadCarga: 'kg',
      notaCoach: 'RANGO COMPLETO. NO BAJES EL PECHO.',
    })
    expect(componerPrescripcion(e)).toBe(
      '60KG A 10 REPS; 3 SERIES (RIR 2). RANGO COMPLETO. NO BAJES EL PECHO.',
    )
  })

  it('escribe la unidad cuando no es kg simple', () => {
    const e = ejercicio({ cargaKg: 81, unidadCarga: 'total', repsDiana: 9, sets: 3, rirObjetivo: 1 })
    expect(componerPrescripcion(e)).toBe('81KG TOTAL A 9 REPS; 3 SERIES (RIR 1).')
  })

  it('no escribe decimales de adorno', () => {
    const e = ejercicio({ cargaKg: 62.5, repsDiana: 10, sets: 3, rirObjetivo: 1 })
    expect(componerPrescripcion(e)).toContain('62.5KG')
    expect(componerPrescripcion(ejercicio({ cargaKg: 60 }))).toContain('60KG')
  })

  it('devuelve el texto original tal cual cuando no hay carga que componer', () => {
    // Las de porcentaje y las de "registra tu carga" no se pueden regenerar: se
    // dejan exactamente como las escribió el coach.
    const original = 'REGISTRA TU CARGA A 11 REPS; 3 SERIES (RIR 3). ESE ES EL PUNTO CERO.'
    const e = ejercicio({ prescripcion: original })
    expect(componerPrescripcion(e)).toBe(original)
  })

  it('compone la escalera cuando el ejercicio viene ondulado', () => {
    const e = ejercicio({
      seriesPrescritas: [
        { orden: 1, reps: 10, rir: 1, cargaKg: 60 },
        { orden: 2, reps: 9, rir: 1, cargaKg: 60 },
        { orden: 3, reps: 8, rir: 1, cargaKg: 62.5 },
      ],
      notaCoach: 'SUBE LA CARGA Y BAJAN LAS REPS.',
    })
    expect(componerPrescripcion(e)).toBe(
      'ONDULACIÓN ASCENDENTE: 60KG×10 · 60KG×9 · 62.5KG×8 (RIR 1). SUBE LA CARGA Y BAJAN LAS REPS.',
    )
  })

  it('sobrevive a rirObjetivo con texto', () => {
    // Hay 11 ejercicios con rirObjetivo = "Isometría" / "Control" / "RIR 2-3".
    const e = ejercicio({ cargaKg: 20, rirObjetivo: 'Isometría' as unknown as number })
    expect(() => componerPrescripcion(e)).not.toThrow()
    expect(componerPrescripcion(e)).toBe('20KG A 10 REPS; 3 SERIES (ISOMETRÍA).')
  })

  it('sobrevive a repsDiana con texto', () => {
    const e = ejercicio({ cargaKg: 20, repsDiana: 'Control' as unknown as number })
    expect(() => componerPrescripcion(e)).not.toThrow()
  })
})

describe('parsearOndulada', () => {
  it('separa la nota de la escalera', () => {
    const r = parsearOndulada(
      'ONDULACIÓN ASCENDENTE: 60KG×10 · 60KG×9 · 62.5KG×8 (RIR 1). SUBE LA CARGA Y BAJAN LAS REPS.',
    )
    expect(r.reconocida).toBe(true)
    expect(r.notaCoach).toBe('SUBE LA CARGA Y BAJAN LAS REPS.')
  })

  it('NO muerde la familia de porcentajes, que no lleva kilos', () => {
    const r = parsearOndulada(
      'ONDULACIÓN ASCENDENTE SOBRE TU PROPIA CARGA: SERIE 1 AL 90% × 12 REPS (RIR 2). LOS PONES TÚ.',
    )
    expect(r.reconocida).toBe(false)
  })
})

describe('cargaSugerida', () => {
  /**
   * Estos cuatro casos fallaban antes del 2026-08-09, cuando la sugerencia salía
   * de `parseFloat` sobre la frase entera (`RegistroSerie.tsx`): el primer número
   * del texto no siempre es la carga.
   */
  it('no propone segundos como si fueran kilos', () => {
    const e = ejercicio({ prescripcion: '30 SEG POR LADO; 3 SERIES. DESCALZA.' })
    expect(cargaSugerida(e, undefined)).toBeUndefined()
  })

  it('no propone metros como si fueran kilos', () => {
    expect(cargaSugerida(ejercicio({ prescripcion: '30 METROS; 3 SERIES.' }), undefined)).toBeUndefined()
  })

  it('no propone repeticiones como si fueran kilos', () => {
    expect(cargaSugerida(ejercicio({ prescripcion: '8 REPS POR LADO; 3 SERIES.' }), undefined)).toBeUndefined()
  })

  it('no inventa 20 kg cuando la prescripción va por porcentajes', () => {
    const e = ejercicio({ prescripcion: 'ONDULACIÓN ASCENDENTE SOBRE TU PROPIA CARGA: SERIE 1 AL 90% × 12 REPS.' })
    expect(cargaSugerida(e, undefined)).toBeUndefined()
  })

  it('usa la carga separada cuando existe', () => {
    expect(cargaSugerida(ejercicio({ cargaKg: 62.5 }), undefined)).toBe(62.5)
  })

  it('prefiere lo último que registró el asesorado sobre lo pautado', () => {
    const e = ejercicio({ cargaKg: 60, series: [{ orden: 1, cargaKg: 65, reps: 10, rir: 2 }] })
    expect(cargaSugerida(e, undefined)).toBe(65)
  })

  it('la serie ondulada manda sobre todo lo demás', () => {
    const e = ejercicio({ cargaKg: 60, series: [{ orden: 1, cargaKg: 65, reps: 10, rir: 2 }] })
    expect(cargaSugerida(e, { orden: 2, reps: 9, rir: 1, cargaKg: 67.5 })).toBe(67.5)
  })
})

describe('ida y vuelta · parsear y volver a componer no pierde nada', () => {
  const casos = [
    '60KG A 10 REPS; 3 SERIES (RIR 2). RANGO COMPLETO',
    '81KG TOTAL A 9 REPS; 3 SERIES (RIR 1). ES EL ÚNICO REST-PAUSE QUE QUEDA ESTA SEMANA.',
    '62.5KG TOTAL A 10 REPS; 3 SERIES (RIR 1). CONSOLIDA LOS 61.5 QUE MOVISTE.',
    '15KG POR MANO A 10 REPS; 3 SERIES (RIR 2). LAS 10 REPS MANDAN.',
  ]

  for (const texto of casos) {
    it(`reconstruye «${texto.slice(0, 34)}…»`, () => {
      const r = parsearPrescripcion(texto)
      expect(r.reconocida).toBe(true)
      const e = ejercicio({
        prescripcion: texto,
        cargaKg: r.cargaKg,
        unidadCarga: r.unidadCarga,
        repsDiana: r.repsDiana ?? 10,
        sets: r.sets ?? 3,
        // El tipo declara `number` pero la base guarda textos ("Isometría") en 11
        // ejercicios. El cast reproduce lo que de verdad llega de la nube.
        rirObjetivo: (r.rirObjetivo ?? 2) as number,
        notaCoach: r.notaCoach,
      })
      expect(componerPrescripcion(e)).toBe(texto)
    })
  }
})

describe('las tres formas de escribir las repeticiones', () => {
  /**
   * Contrastado contra las 901 prescripciones distintas de produccion el
   * 2026-08-26, comparando el parser nuevo con el ANTERIOR sacado de git —sin
   * transcribir la expresion a mano, que es donde se cuelan los errores—:
   * **735 identicas, 0 regresiones, 0 cambios de extraccion, 39 nuevas**.
   */
  it('la canonica «A 12 REPS» sigue leyendose igual', () => {
    const r = parsearPrescripcion('40KG A 12 REPS; 3 SERIES (RIR 2). MANTEN.')
    expect(r).toMatchObject({ reconocida: true, cargaKg: 40, repsDiana: 12, sets: 3, rirObjetivo: 2 })
    expect(r.notaCoach).toBe('MANTEN.')
  })

  it('«A 12» sin la palabra REPS', () => {
    const r = parsearPrescripcion('100KG A 12; 2 SERIES (RIR 2). MANTEN.')
    expect(r).toMatchObject({ reconocida: true, cargaKg: 100, repsDiana: 12, sets: 2 })
    expect(r.notaCoach).toBe('MANTEN.')
  })

  it('«x13», con la equis pegada o separada', () => {
    expect(parsearPrescripcion('117.5KG x13 (RIR 2); 3 SERIES. PROGRESA.')).toMatchObject({
      reconocida: true, cargaKg: 117.5, repsDiana: 13, sets: 3,
    })
    expect(parsearPrescripcion('170KG x 15; 3 SERIES.')).toMatchObject({
      reconocida: true, cargaKg: 170, repsDiana: 15, sets: 3,
    })
  })

  it('el rango entre parentesis tras REPS se lee y se descarta', () => {
    // Duplica lo que ya dice el campo `rango`; la diana es el primer numero.
    const r = parsearPrescripcion('12.5KG A 11 REPS (10-12); 2 SERIES (RIR 1). NOTA.')
    expect(r).toMatchObject({ reconocida: true, cargaKg: 12.5, repsDiana: 11, sets: 2, rirObjetivo: 1 })
    expect(r.notaCoach).toBe('NOTA.')
  })

  it('unidades nuevas: TOTALES EN BARRA y DE CADA UNO', () => {
    expect(parsearPrescripcion('35KG TOTALES EN BARRA A 10 REPS; 3 SERIES (RIR 3).')).toMatchObject({
      reconocida: true, cargaKg: 35, unidadCarga: 'total', repsDiana: 10,
    })
    // «DE CADA UNO» describe dos movimientos por serie, no una carga por lado:
    // los 3,4 kg son los que se cogen.
    expect(parsearPrescripcion('3.4KG A 15 REPS DE CADA UNO; 2 SERIES.')).toMatchObject({
      reconocida: true, cargaKg: 3.4, unidadCarga: 'kg', repsDiana: 15,
    })
  })

  /**
   * EL ANCLAJE QUE HACE SEGURO EL «A 12» SIN PALABRA, y sin el la ampliacion
   * seria peligrosa: exige `;` inmediatamente despues. Estas dos frases llevan
   * un numero tras la `A` que **no son repeticiones**, y ninguna entra.
   */
  it('«A N» sin punto y coma pegado NO se lee, y es lo que salva a los pasos', () => {
    // 20 son PASOS de un paseo del granjero, no repeticiones.
    expect(parsearPrescripcion('10KG A 20 PASOS; 3 SERIES (RIR 2).').reconocida).toBe(false)
    // 12-15 son reps pero luego vienen 5 parciales: la cabecera no cuenta eso.
    expect(parsearPrescripcion('70KG A 12-15 + 5 PARCIALES; 3 SERIES (RIR 1).').reconocida).toBe(false)
  })

  it('los drop sets siguen fuera: no tienen UNA carga', () => {
    // Igual que un ondulado, un drop set no cabe en un solo `cargaKg`.
    expect(parsearPrescripcion('170KG x15, BAJAS A 85KG x10 HASTA EL FALLO; 3 SERIES.').reconocida).toBe(false)
    expect(parsearPrescripcion('95KG x8 -> 65KG x6 -> 48KG x FALLO; 2 SERIES.').reconocida).toBe(false)
  })

  it('las de tecnica con dos puntos siguen fuera', () => {
    expect(
      parsearPrescripcion('80KG TOTAL (40 CADA UNA): 6 REPS + PAUSA 15-20 SEG + 3-4 REPS; 3 SERIES.').reconocida,
    ).toBe(false)
  })
})
