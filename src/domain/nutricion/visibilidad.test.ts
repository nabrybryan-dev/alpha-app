import { describe, expect, it } from 'vitest'
import {
  motivosDeRevision,
  necesitaRevision,
  visibilidadDe,
  VISIBILIDAD_EN_ESPERA,
  VISIBILIDAD_POR_DEFECTO,
  type Visibilidad,
} from './visibilidad'

describe('visibilidadDe', () => {
  it('sin decisión guardada, se ve todo', () => {
    // Es el caso normal: ver el propio progreso es parte del acompañamiento.
    expect(visibilidadDe(undefined)).toEqual(VISIBILIDAD_POR_DEFECTO)
  })

  it('respeta lo que decidió la nutricionista', () => {
    const decidida: Visibilidad = {
      verComposicion: false,
      verObjetivoCalorico: true,
      verContadorKcal: false,
      estado: 'decidido',
    }
    expect(visibilidadDe(decidida)).toEqual(decidida)
  })

  it('en espera retiene las tres, digan lo que digan los booleanos', () => {
    // Una fila puede quedar a medias: creada con los valores por defecto y
    // marcada para revisar. Lo que vale entonces es que falta la decisión.
    const aMedias: Visibilidad = {
      verComposicion: true,
      verObjetivoCalorico: true,
      verContadorKcal: true,
      estado: 'en_espera',
    }
    expect(visibilidadDe(aMedias)).toEqual(VISIBILIDAD_EN_ESPERA)
  })

  describe('el "en espera" derivado', () => {
    it('una señal sin decisión guardada retiene las cifras', () => {
      // La app del móvil no puede escribir la tabla de interruptores -es solo
      // del staff-, así que el estado se deduce en vez de guardarse.
      expect(visibilidadDe(undefined, { cicloAlterado: true })).toEqual(VISIBILIDAD_EN_ESPERA)
    })

    it('sin señales, se ve todo', () => {
      expect(visibilidadDe(undefined, { cicloAlterado: false })).toEqual(VISIBILIDAD_POR_DEFECTO)
    })

    it('una decisión ya tomada manda sobre la señal', () => {
      // Si la nutricionista miró y dijo que sí, la señal que la trajo aquí no
      // vuelve a esconder nada.
      const decidida: Visibilidad = {
        verComposicion: true,
        verObjetivoCalorico: true,
        verContadorKcal: true,
        estado: 'decidido',
      }
      expect(visibilidadDe(decidida, { cicloAlterado: true })).toEqual(decidida)
    })
  })

  it('el estado "automatico" con valores puestos también se respeta', () => {
    const tocada: Visibilidad = {
      verComposicion: false,
      verObjetivoCalorico: false,
      verContadorKcal: false,
      estado: 'automatico',
    }
    expect(visibilidadDe(tocada).verComposicion).toBe(false)
  })
})

describe('necesitaRevision', () => {
  it('sin señales, nadie tiene que mirar nada', () => {
    expect(necesitaRevision({})).toBe(false)
  })

  it('el antecedente de conducta alimentaria pesa solo', () => {
    expect(necesitaRevision({ antecedenteTca: true })).toBe(true)
  })

  it('un ciclo alterado también', () => {
    // Puede venir de comer poco sin que nadie lo haya llamado nunca así.
    expect(necesitaRevision({ cicloAlterado: true })).toBe(true)
  })

  it('y querer bajar de peso ganando masa a la vez', () => {
    expect(necesitaRevision({ objetivoContradictorio: true })).toBe(true)
  })

  it('UNA señal basta: el error no cuesta lo mismo en los dos sentidos', () => {
    // Retener unas cifras una semana de más se arregla con un clic. Enseñarlas
    // a quien no debía, no.
    expect(necesitaRevision({ cicloAlterado: true, antecedenteTca: false })).toBe(true)
  })

  it('las señales en false no la levantan', () => {
    expect(
      necesitaRevision({
        antecedenteTca: false,
        cicloAlterado: false,
        objetivoContradictorio: false,
      }),
    ).toBe(false)
  })
})

describe('motivosDeRevision', () => {
  it('dice por qué, para que no haya que adivinarlo', () => {
    expect(motivosDeRevision({ antecedenteTca: true })).toEqual([
      'antecedente de conducta alimentaria en la encuesta',
    ])
  })

  it('lista todas las que haya', () => {
    expect(motivosDeRevision({ antecedenteTca: true, cicloAlterado: true })).toHaveLength(2)
  })

  it('sin señales no inventa motivos', () => {
    expect(motivosDeRevision({})).toEqual([])
  })
})
