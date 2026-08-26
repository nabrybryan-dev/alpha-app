import { describe, expect, it } from 'vitest'
import {
  causaDominante,
  huecosPorSalto,
  rangoConBandas,
  tramosDeEje,
  type FotogramaBrazo,
} from './medidaDePalancas'

/* Los datos son los del caso medido de `datos-de-ejemplo.json`: peso muerto, vista
 * lateral limpia, atleta de 174 cm, sigma de brazo 15 mm. */

function f(t: number, cadera: number, extra: Partial<FotogramaBrazo> = {}): FotogramaBrazo {
  return {
    t,
    ok: true,
    brazos: {
      cadera: { mm: cadera, unLado: false, derivado: false, sigmaExtraMm: 0 },
      lumbar: { mm: cadera + 51, unLado: false, derivado: true, sigmaExtraMm: 38 },
    },
    ...extra,
  }
}

const SERIE = [f(0, 291), f(0.24, 264), f(0.48, 213), f(0.6, 178), f(0.72, 131)]

describe('el rango del eje incluye las bandas, no solo los valores', () => {
  it('la banda del lumbar ensancha el rango por arriba', () => {
    // Si el rango se ajustara a los valores, el ±41 del lumbar se saldría del
    // lienzo — y justo la incertidumbre es lo que decide si el número sirve.
    const conBandas = rangoConBandas(SERIE, ['cadera', 'lumbar'], 15)
    const soloCadera = rangoConBandas(SERIE, ['cadera'], 15)
    expect(conBandas.max).toBeGreaterThan(soloCadera.max)
    // lumbar máximo 342 + (15 + 38) = 395, más el margen
    expect(conBandas.max).toBeGreaterThan(390)
  })

  it('el cero SIEMPRE entra en el rango', () => {
    // Un brazo negativo significa algo real: la carga pasó al otro lado del eje.
    // Si el cero se saliera del lienzo, ese cruce dejaría de verse.
    const todoPositivo = rangoConBandas(SERIE, ['cadera'], 15)
    expect(todoPositivo.min).toBeLessThanOrEqual(0)
  })

  it('una serie que cruza el cero conserva los dos lados', () => {
    const cruza = [f(0, 84), f(0.24, 29), f(0.48, -18), f(0.72, -52)]
    const r = rangoConBandas(cruza, ['cadera'], 15)
    expect(r.min).toBeLessThan(-52)
    expect(r.max).toBeGreaterThan(84)
  })
})

describe('los huecos cortan la curva, nunca se interpolan', () => {
  it('un fotograma con salto parte la serie en dos tramos', () => {
    const conSalto = [
      f(0, 291),
      f(0.24, 264),
      { ...f(0.48, 213), brazos: { cadera: { mm: 213, unLado: false, derivado: false, sigmaExtraMm: 0, salto: true } } },
      f(0.72, 131),
    ]
    const tramos = tramosDeEje(conSalto, 'cadera')
    expect(tramos).toHaveLength(2)
    expect(tramos[0]).toHaveLength(2)
    expect(tramos[1]).toHaveLength(1)
  })

  it('un fotograma sin medir también corta', () => {
    const conHueco = [f(0, 291), { t: 0.24, ok: false, motivo: 'sin_persona' }, f(0.48, 213)]
    expect(tramosDeEje(conHueco, 'cadera')).toHaveLength(2)
  })

  it('los instantes de salto se pueden rotular', () => {
    const conSalto = [
      f(0, 291),
      { ...f(0.84, 200), brazos: { cadera: { mm: 200, unLado: false, derivado: false, sigmaExtraMm: 0, salto: true } } },
    ]
    expect(huecosPorSalto(conSalto, 'cadera')).toEqual([0.84])
  })

  it('una serie limpia es un solo tramo', () => {
    expect(tramosDeEje(SERIE, 'cadera')).toHaveLength(1)
  })
})

describe('la causa dominante decide QUÉ FRASE se puede decir', () => {
  it('con el grueso en sin_consenso, no se arregla repitiendo', () => {
    // Significa que los dos detectores discrepan: algo tapa la articulación.
    const d = causaDominante({ sin_persona: 2, sin_carga: 1, sin_consenso: 89, sin_eje: 0, salto: 4 })
    expect(d?.causa).toBe('sin_consenso')
    expect(d?.remedio).toBe('no_se_arregla')
  })

  it('con el grueso en sin_persona, la pantalla tiene que decir lo CONTRARIO', () => {
    // Eso sí se arregla, y mandar a alguien a no repetir sería quitarle una toma
    // que sí iba a salir.
    const d = causaDominante({ sin_persona: 74, sin_carga: 3, sin_consenso: 2, sin_eje: 0, salto: 1 })
    expect(d?.causa).toBe('sin_persona')
    expect(d?.remedio).toBe('encuadre')
  })

  it('sin_carga también se arregla encuadrando', () => {
    const d = causaDominante({ sin_persona: 1, sin_carga: 40, sin_consenso: 3, sin_eje: 0, salto: 0 })
    expect(d?.remedio).toBe('encuadre')
  })

  it('sin_eje no se puede diagnosticar: viene de un solo detector', () => {
    // Con una pista de un detector no se sabe POR QUÉ se perdió el punto, y
    // llamarlo consenso sería inventarse la causa.
    const d = causaDominante({ sin_persona: 0, sin_carga: 0, sin_consenso: 0, sin_eje: 12, salto: 0 })
    expect(d?.causa).toBe('sin_eje')
    expect(d?.remedio).toBe('desconocido')
  })

  it('sin causas no se inventa un diagnóstico', () => {
    expect(causaDominante(undefined)).toBeUndefined()
    expect(
      causaDominante({ sin_persona: 0, sin_carga: 0, sin_consenso: 0, sin_eje: 0, salto: 0 }),
    ).toBeUndefined()
  })
})
