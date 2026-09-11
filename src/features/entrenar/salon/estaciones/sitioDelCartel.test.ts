import { describe, expect, it } from 'vitest'

import {
  BANDA_DE_SESION,
  desvioDelCartel,
  HOLGURA_DEL_CARTEL,
  SUELO_DE_LOS_CARTELES,
} from './sitioDelCartel'

/**
 * EL GUARDIÁN DE QUE UN CARTEL NO SE DIBUJA ENCIMA DEL SUJETO.
 *
 * Nace en rojo por lo medido el 2026-09-10 con `testigo/carteles-y-sujeto.mjs`: las cuatro
 * estaciones tapaban entre el 9 % y el 37 % de la TINTA del cuerpo en las trece posiciones
 * de cámara probadas, con la mediana en el 25 %. Aquí no se miden píxeles —eso es del
 * testigo, y hace falta un navegador— sino la decisión: dado dónde cae el cartel y dónde
 * está el cuerpo, hacia dónde se aparta. Las dos medidas hacen falta y ninguna sustituye a
 * la otra: esta corre en milisegundos y no ve un píxel; el testigo ve píxeles y tarda tres
 * minutos.
 *
 * Los dos cuerpos de las pruebas son los dos que de verdad se dan y que piden salidas
 * OPUESTAS: **de pie** (estrecho y de la cabeza a los pies, sin aire arriba ni abajo) y
 * **tumbado en un banco** (una banda que cruza la pantalla, sin aire a los lados).
 */

const MARCO = { arriba: BANDA_DE_SESION, abajo: 844 - SUELO_DE_LOS_CARTELES, ancho: 390 }

/** Un cartel de 132×92 centrado en `x`, con su borde de abajo en `y`. */
function cartel(x: number, y: number) {
  return { x0: x - 66, x1: x + 66, y0: y - 92, y1: y }
}

/** Dónde queda un cartel después de apartarse. */
function tras(c: ReturnType<typeof cartel>, d: { dx: number; dy: number }) {
  return { x0: c.x0 + d.dx, x1: c.x1 + d.dx, y0: c.y0 + d.dy, y1: c.y1 + d.dy }
}

function pisa(c: { x0: number; x1: number; y0: number; y1: number }, cuerpo: typeof DE_PIE) {
  return c.x1 > cuerpo.x0 && c.x0 < cuerpo.x1 && c.y1 > cuerpo.y0 && c.y0 < cuerpo.y1
}

const DE_PIE = { x0: 150, y0: 120, x1: 260, y1: 658 }
const TUMBADO = { x0: 40, y0: 460, x1: 350, y1: 545 }

describe('desvioDelCartel', () => {
  it('no mueve nada si el visor todavía no ha medido el cuerpo', () => {
    expect(desvioDelCartel(cartel(195, 534), undefined, MARCO)).toEqual({ dx: 0, dy: 0 })
  })

  it('no mueve el cartel que está a un lado del cuerpo', () => {
    expect(desvioDelCartel(cartel(60, 534), DE_PIE, MARCO)).toEqual({ dx: 0, dy: 0 })
  })

  it('no mueve el cartel que cae por encima de la cabeza', () => {
    expect(desvioDelCartel(cartel(195, 100), DE_PIE, MARCO)).toEqual({ dx: 0, dy: 0 })
  })

  it('aparta DE LADO el cartel que cae sobre un cuerpo de pie', () => {
    // De pie no hay aire ni sobre la cabeza (36 px) ni bajo los pies (42): el cartel mide
    // 92. El sitio libre está a los lados, y ahí va.
    const d = desvioDelCartel(cartel(195, 534), DE_PIE, MARCO)
    expect(d.dy).toBe(0)
    expect(d.dx).not.toBe(0)
    const puesto = tras(cartel(195, 534), d)
    expect(pisa(puesto, DE_PIE)).toBe(false)
    expect(puesto.x0).toBeGreaterThanOrEqual(0)
    expect(puesto.x1).toBeLessThanOrEqual(MARCO.ancho)
  })

  it('aparta EN VERTICAL el cartel que cae sobre un cuerpo tumbado', () => {
    // Tumbado el cuerpo cruza la pantalla de lado a lado: apartarse en horizontal sacaría el
    // cartel del marco, así que sube —que está más cerca que bajar—.
    const d = desvioDelCartel(cartel(195, 510), TUMBADO, MARCO)
    expect(d.dx).toBe(0)
    expect(d.dy).toBeLessThan(0)
    const puesto = tras(cartel(195, 510), d)
    expect(pisa(puesto, TUMBADO)).toBe(false)
    expect(puesto.y1).toBe(TUMBADO.y0 - HOLGURA_DEL_CARTEL)
  })

  it('baja cuando bajar está más cerca que subir', () => {
    // El mismo cuerpo tumbado y un cartel que lo pisa por su borde de ABAJO: ahí bajar son
    // 27 px y subir 170. Se elige el corto, y por eso hay dos pruebas y no una.
    const d = desvioDelCartel(cartel(195, 620), TUMBADO, MARCO)
    expect(d.dy).toBeGreaterThan(0)
    expect(tras(cartel(195, 620), d).y0).toBe(TUMBADO.y1 + HOLGURA_DEL_CARTEL)
  })

  it('nunca deja el cartel bajo el panel, bajo la nav ni sobre la banda de la sesión', () => {
    const casos = [
      { c: cartel(195, 650), cuerpo: { x0: 40, y0: 600, x1: 350, y1: 690 } },
      { c: cartel(195, 300), cuerpo: { x0: 40, y0: 100, x1: 350, y1: 400 } },
      { c: cartel(195, 400), cuerpo: { x0: 0, y0: 90, x1: 390, y1: 700 } },
    ]
    for (const { c, cuerpo } of casos) {
      const puesto = tras(c, desvioDelCartel(c, cuerpo, MARCO))
      expect(puesto.y0).toBeGreaterThanOrEqual(MARCO.arriba)
      expect(puesto.y1).toBeLessThanOrEqual(MARCO.abajo)
    }
  })

  it('con el cuerpo llenando la pantalla se aparta lo que puede, sin salirse', () => {
    // No hay salida por ningún lado: el contrato es sacar el número del centro del cuerpo,
    // no quedarse quieto. Devolver 0 aquí sería dejarlo en mitad del pecho.
    const cuerpo = { x0: 0, y0: 90, x1: 390, y1: 700 }
    const d = desvioDelCartel(cartel(195, 400), cuerpo, MARCO)
    expect(d.dx === 0 && d.dy === 0).toBe(false)
  })
})
