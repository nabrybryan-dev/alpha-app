import { describe, expect, it } from 'vitest'
import {
  BANDA_RIR,
  desviacionDeRir,
  hayNotaTecnicaNueva,
  puedeSobrecargar,
  RACHA_PARA_ESTANDARIZAR,
  siguienteEstado,
  SIN_ESTANDARIZAR,
  type EstadoEstandarizado,
} from './estandarizacion'
import type { EjercicioPrescrito, SerieRegistrada } from './types'

function ejercicio(
  parcial: Partial<EjercicioPrescrito> = {},
): EjercicioPrescrito {
  return {
    id: 'e1',
    categoria: 'EXTENSIÓN DE RODILLA',
    nombre: 'Extensión de rodilla en máquina',
    cues: 'CONTROLA EL RETORNO',
    prescripcion: '40KG A 10 REPS; 3 SERIES (RIR 2)',
    descansoMin: 2,
    sets: 3,
    rango: '(8-12)',
    repsDiana: 10,
    rirObjetivo: 2,
    series: [],
    ...parcial,
  } as EjercicioPrescrito
}

const serie = (orden: number, rir?: number): SerieRegistrada =>
  ({ orden, cargaKg: 40, reps: 10, ...(rir === undefined ? {} : { rir }) }) as SerieRegistrada

describe('nota técnica nueva', () => {
  it('el cue copiado tal cual no es nota nueva', () => {
    expect(hayNotaTecnicaNueva('CONTROLA EL RETORNO', 'CONTROLA EL RETORNO')).toBe(false)
  })

  it('mayúsculas, espacios de más y puntuación de borde no cuentan', () => {
    expect(hayNotaTecnicaNueva('CONTROLA EL RETORNO', 'controla  el retorno;')).toBe(false)
    expect(hayNotaTecnicaNueva('CODO FIJO.', ' CODO FIJO ')).toBe(false)
  })

  it('los acentos tampoco: el mismo cue tecleado con y sin tilde es el mismo cue', () => {
    expect(hayNotaTecnicaNueva('EXTENSIÓN COMPLETA', 'EXTENSION COMPLETA')).toBe(false)
  })

  it('añadir una instrucción sí es nota nueva', () => {
    expect(hayNotaTecnicaNueva('CODO FIJO', 'CODO FIJO; NO USES IMPULSO')).toBe(true)
  })

  it('quitar una instrucción también', () => {
    expect(hayNotaTecnicaNueva('CODO FIJO; NO USES IMPULSO', 'CODO FIJO')).toBe(true)
  })
})

describe('desviación de RIR', () => {
  it('sin series registradas no informa', () => {
    expect(desviacionDeRir(ejercicio({ series: [] }))).toBeUndefined()
  })

  it('las series sin RIR se saltan: ausente NO es cero', () => {
    // Contarlas como 0 diría que se llegó al fallo, que es lo contrario.
    expect(desviacionDeRir(ejercicio({ series: [serie(1), serie(2)] }))).toBeUndefined()
  })

  it('mezcla de series con y sin RIR: solo cuentan las que lo traen', () => {
    const e = ejercicio({ rirObjetivo: 2, series: [serie(1), serie(2, 3)] })
    expect(desviacionDeRir(e)).toBe(1)
  })

  it('toma la PEOR serie, no el promedio: una que se fue no se esconde', () => {
    const e = ejercicio({ rirObjetivo: 2, series: [serie(1, 2), serie(2, 2), serie(3, 5)] })
    expect(desviacionDeRir(e)).toBe(3)
  })

  it('sin RIR objetivo no hay contra qué comparar', () => {
    const e = ejercicio({ rirObjetivo: undefined, series: [serie(1, 2)] })
    expect(desviacionDeRir(e)).toBeUndefined()
  })
})

describe('avance de la racha', () => {
  const limpio = ejercicio({ rirObjetivo: 2, series: [serie(1, 2), serie(2, 3)] })

  it('un ejercicio nuevo arranca en cero y no estandarizado', () => {
    const e = siguienteEstado(SIN_ESTANDARIZAR, undefined, limpio)
    expect(e).toMatchObject({ estado: 'no', microciclosOk: 0, motivo: 'ejercicio nuevo' })
  })

  it('hacen falta tres microciclos limpios, y ni uno menos', () => {
    let e: EstadoEstandarizado = SIN_ESTANDARIZAR
    for (let i = 0; i < RACHA_PARA_ESTANDARIZAR - 1; i++) {
      e = siguienteEstado(e, limpio, limpio)
      expect(e.estado).toBe('no')
    }
    e = siguienteEstado(e, limpio, limpio)
    expect(e).toMatchObject({ estado: 'si', microciclosOk: RACHA_PARA_ESTANDARIZAR })
    expect(puedeSobrecargar(e)).toBe(true)
  })

  it('una nota técnica nueva tira la racha entera', () => {
    let e: EstadoEstandarizado = SIN_ESTANDARIZAR
    e = siguienteEstado(e, limpio, limpio)
    e = siguienteEstado(e, limpio, limpio)
    expect(e.microciclosOk).toBe(2)

    const corregido = ejercicio({ ...limpio, cues: 'CONTROLA EL RETORNO; NO BLOQUEES' })
    e = siguienteEstado(e, limpio, corregido)
    expect(e).toMatchObject({ estado: 'no', microciclosOk: 0, motivo: 'nota tecnica nueva' })
  })

  it('un RIR fuera de banda también la tira', () => {
    const fuera = ejercicio({ rirObjetivo: 2, series: [serie(1, 2), serie(2, 2 + BANDA_RIR + 1)] })
    const e = siguienteEstado({ ...SIN_ESTANDARIZAR, microciclosOk: 2 }, limpio, fuera)
    expect(e).toMatchObject({ estado: 'no', microciclosOk: 0, motivo: 'rir fuera de banda' })
  })

  it('justo en el borde de la banda NO la tira', () => {
    const borde = ejercicio({ rirObjetivo: 2, series: [serie(1, 2 + BANDA_RIR)] })
    const e = siguienteEstado({ ...SIN_ESTANDARIZAR, microciclosOk: 1 }, limpio, borde)
    expect(e.microciclosOk).toBe(2)
  })

  it('sin RIR registrado la racha se queda QUIETA: ni suma ni rompe', () => {
    // No hay prueba de que la técnica aguante, pero tampoco de que falle.
    const sinDato = ejercicio({ rirObjetivo: 2, series: [serie(1)] })
    const e = siguienteEstado({ ...SIN_ESTANDARIZAR, microciclosOk: 2 }, limpio, sinDato)
    expect(e).toMatchObject({ microciclosOk: 2, motivo: 'sin RIR registrado' })
  })

  it('un ejercicio ya estandarizado que se queda sin RIR no pierde el estado', () => {
    const ya: EstadoEstandarizado = { estado: 'si', origen: 'derivado', microciclosOk: 4 }
    const sinDato = ejercicio({ rirObjetivo: 2, series: [serie(1)] })
    expect(siguienteEstado(ya, limpio, sinDato).estado).toBe('si')
  })
})

describe('el veto del coach', () => {
  const limpio = ejercicio({ rirObjetivo: 2, series: [serie(1, 2)] })

  it('congela el estado: la derivación no lo pisa por muchas semanas limpias', () => {
    const vetado: EstadoEstandarizado = { estado: 'no', origen: 'veto_coach', microciclosOk: 0 }
    let e = vetado
    for (let i = 0; i < 10; i++) e = siguienteEstado(e, limpio, limpio)
    expect(e).toEqual(vetado)
    expect(puedeSobrecargar(e)).toBe(false)
  })

  it('un veto en positivo también aguanta: el coach puede adelantar el aval', () => {
    const avalado: EstadoEstandarizado = { estado: 'si', origen: 'veto_coach', microciclosOk: 0 }
    const roto = ejercicio({ ...limpio, cues: 'OTRA COSA' })
    expect(siguienteEstado(avalado, limpio, roto)).toEqual(avalado)
  })
})
