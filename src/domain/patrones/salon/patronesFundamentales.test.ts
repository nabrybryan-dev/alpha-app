import { describe, expect, it } from 'vitest'
import { dominadaCerrada } from './dominadaCerrada'
import {
  pesoMuertoConvencional,
  pesoMuertoRumanoReferencia,
} from './pesoMuertoConvencional'
import { cambioDeRodilla } from './tipos'

describe('patrones fundamentales del salón', () => {
  it('modela la dominada como cadena cerrada con manos fijas y raíz ascendente', () => {
    expect(dominadaCerrada.cadena).toBe('cerrada')
    expect(dominadaCerrada.apoyo).toBe('manos')
    expect(dominadaCerrada.raizCorporal.finMetros).toBeGreaterThan(
      dominadaCerrada.raizCorporal.inicioMetros,
    )
  })

  it('distingue el peso muerto convencional desde suelo del rumano', () => {
    expect(pesoMuertoConvencional.id).not.toBe(pesoMuertoRumanoReferencia.id)
    expect(pesoMuertoConvencional.cargaInicial).toBe('suelo')
    expect(pesoMuertoRumanoReferencia.cargaInicial).toBe('suspendida')
    expect(cambioDeRodilla(pesoMuertoConvencional)).toBeGreaterThan(25)
    expect(cambioDeRodilla(pesoMuertoRumanoReferencia)).toBeLessThanOrEqual(15)
  })
})
