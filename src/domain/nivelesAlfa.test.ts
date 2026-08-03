import { describe, expect, it } from 'vitest'
import type { DatosRuta } from './rutaEntrenamiento'
import {
  ERROR_RIR_MINIMO,
  PELDANO_MAXIMO,
  peldanoAlcanzado,
  peldanoTrasMicrociclo,
  requisitosParaPeldano,
  UMBRALES,
} from './nivelesAlfa'

const datosDe = (extra: Partial<DatosRuta> = {}): DatosRuta => ({
  microcicloNumero: 22,
  sesionesRegistradas: 0,
  sesionesTotales: 0,
  seriesPorGrupo: [],
  ...extra,
})

/** Alguien que cumple con holgura todo lo que la app puede medir. */
const asesoradoImpecable = (tecnicaPct: number): DatosRuta =>
  datosDe({
    sesionesRegistradas: 20,
    sesionesTotales: 20,
    desviacionRir: 0.3,
    seriesPorGrupo: [22, 21, 20],
    progresoFuerza: { mejoraron: 9, comparados: 10, microcicloPrevio: 21 },
    tecnicaPct,
    autorregulaConReadiness: true,
    respondeADescarga: true,
    estableEntreBloques: true,
  })

describe('umbrales por peldaño', () => {
  it('el listón sube en cada salto, nunca baja', () => {
    const saltos = [3, 4, 5, 6, 7] as const
    for (const destino of saltos) {
      const anterior = UMBRALES[destino - 1]
      const actual = UMBRALES[destino]
      expect(actual.consistenciaPct).toBeGreaterThanOrEqual(anterior.consistenciaPct)
      expect(actual.tecnicaPct).toBeGreaterThanOrEqual(anterior.tecnicaPct)
    }
  })

  /**
   * La evidencia sitúa el error de un lifter experimentado en 1-2 repeticiones.
   * Un umbral por debajo de eso no mide dominio, mide suerte. El requisito que
   * habia antes -menor a 0,5- era inalcanzable para cualquiera.
   */
  it('el error de RIR exigido nunca baja del suelo humano documentado', () => {
    for (const destino of [3, 4, 5, 6, 7] as const) {
      expect(UMBRALES[destino].errorRirMaximo).toBeGreaterThanOrEqual(ERROR_RIR_MINIMO)
    }
  })

  it('al primer salto no se le pide estimar el RIR', () => {
    expect(UMBRALES[2].errorRirMaximo).toBeUndefined()
  })

  /** Vivir en MRV es lo que el motor manda descargar: no se pide como requisito. */
  it('el volumen exigido se topa antes de MRV', () => {
    for (const destino of [2, 3, 4, 5, 6, 7] as const) {
      expect(UMBRALES[destino].seriesPorGrupo).toBeLessThanOrEqual(20)
    }
  })
})

describe('requisitosParaPeldano', () => {
  it('el salto a 02 no incluye ejes de etapas altas', () => {
    const ids = requisitosParaPeldano(2, datosDe()).map((r) => r.id)
    expect(ids).not.toContain('autorregulacion-real')
    expect(ids).not.toContain('descarga')
    expect(ids).not.toContain('estabilidad')
  })

  it('la autorregulación real aparece al entrar en avanzado', () => {
    const ids = requisitosParaPeldano(4, datosDe()).map((r) => r.id)
    expect(ids).toContain('autorregulacion-real')
  })

  it('la estabilidad entre bloques solo se pide para la cima', () => {
    expect(requisitosParaPeldano(6, datosDe()).map((r) => r.id)).not.toContain('estabilidad')
    expect(requisitosParaPeldano(7, datosDe()).map((r) => r.id)).toContain('estabilidad')
  })

  it('sin datos, los requisitos salen sin cumplir y lo dicen', () => {
    const requisitos = requisitosParaPeldano(3, datosDe())
    expect(requisitos.every((r) => !r.cumplido)).toBe(true)
    expect(requisitos.find((r) => r.id === 'error-rir')?.metrica).toMatch(/aún|sin/i)
  })

  /** La compuerta humana: nadie sube sin que el coach le haya visto ejecutar. */
  it('sin valoración de técnica, ese requisito no se cumple', () => {
    const requisitos = requisitosParaPeldano(3, asesoradoImpecable(0))
    expect(requisitos.find((r) => r.id === 'tecnica')?.cumplido).toBe(false)
  })
})

describe('peldanoAlcanzado', () => {
  it('sin historial, arranca en el primero', () => {
    expect(peldanoAlcanzado(datosDe())).toBe(1)
  })

  it('nadie arranca en el 03 por defecto', () => {
    const apenasEmpieza = datosDe({ sesionesRegistradas: 2, sesionesTotales: 6, tecnicaPct: 30 })
    expect(peldanoAlcanzado(apenasEmpieza)).toBeLessThan(3)
  })

  it('quien cumple todo llega a la cima', () => {
    expect(peldanoAlcanzado(asesoradoImpecable(95))).toBe(PELDANO_MAXIMO)
  })

  it('la técnica floja detiene la escalera donde toca', () => {
    // Técnica 60 cumple el umbral del 03 (55) pero no el del 04 (70).
    expect(peldanoAlcanzado(asesoradoImpecable(60))).toBe(3)
  })
})

describe('peldanoTrasMicrociclo', () => {
  it('sube de uno en uno aunque cumpla varios de golpe', () => {
    expect(peldanoTrasMicrociclo(1, asesoradoImpecable(95))).toBe(2)
  })

  /**
   * Un mes malo no devuelve a nadie a un peldaño anterior: el nivel describe lo
   * que llego a dominar. Bajarlo castiga justo cuando mas necesita quedarse.
   */
  it('no baja de nivel aunque el microciclo haya ido mal', () => {
    expect(peldanoTrasMicrociclo(5, datosDe())).toBe(5)
  })

  it('en la cima se queda en la cima', () => {
    expect(peldanoTrasMicrociclo(PELDANO_MAXIMO, asesoradoImpecable(95))).toBe(PELDANO_MAXIMO)
  })

  it('no sube si le falta un solo requisito', () => {
    const sinTecnica = { ...asesoradoImpecable(95), tecnicaPct: 10 }
    expect(peldanoTrasMicrociclo(2, sinTecnica)).toBe(2)
  })
})
