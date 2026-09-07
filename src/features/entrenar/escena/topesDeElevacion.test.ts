import { describe, expect, it } from 'vitest'
import { PATRONES } from '../../../domain/patrones/catalogo'
import { encuadreDelSalon } from './encuadreDelSalon'
import { HOLGURA_DEL_SUELO, HOLGURA_DEL_TECHO, INCLINACION_A_MANO, SALA, topesDeElevacion } from './sala'

/**
 * LA CÁMARA A MANO NO CRUZA NI EL SUELO NI EL TECHO. Medido el 2026-09-06 con toques
 * emulados: la órbita del salón heredaba los ±78° del estudio y un tirón vertical dejaba la
 * cámara a −78°, mirando la sala desde debajo del suelo. Bryan: «que no vaya a cruzarse
 * una pared o se pierda el diseño».
 */
const ojoA = (centroY: number, distancia: number, elevacion: number) =>
  centroY + distancia * Math.sin((elevacion * Math.PI) / 180)

describe('los topes de inclinación a mano', () => {
  it('con cada patrón del catálogo, el ojo se queda entre el suelo y el techo en los dos topes', () => {
    for (const p of PATRONES) {
      const e = encuadreDelSalon(p)
      const t = topesDeElevacion(e.centro, e.distancia)
      expect(t.min, p.id).toBeLessThan(t.max)
      expect(ojoA(e.centro[1], e.distancia, t.min), `${p.id}: bajo el suelo`).toBeGreaterThanOrEqual(HOLGURA_DEL_SUELO - 1e-9)
      expect(ojoA(e.centro[1], e.distancia, t.max), `${p.id}: sobre el techo`).toBeLessThanOrEqual(SALA.alto - HOLGURA_DEL_TECHO + 1e-9)
    }
  })

  it('nunca más abierto que la inclinación a mano, aunque la sala lo permita', () => {
    const t = topesDeElevacion([0, 1.0, 0], 2)
    expect(t.min).toBe(INCLINACION_A_MANO.min)
    expect(t.max).toBe(INCLINACION_A_MANO.max)
  })

  it('un sujeto colgado de una barra llega antes al techo con el mismo ángulo', () => {
    const dePie = topesDeElevacion([0, 1.0, 0], 6.3)
    const colgado = topesDeElevacion([0, 1.7, 0], 6.3)
    expect(colgado.max).toBeLessThan(dePie.max)
  })
})
