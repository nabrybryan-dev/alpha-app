import { describe, expect, it } from 'vitest'
import { PATRONES, type Patron } from '../src/domain/patrones/catalogo'
import { esqueletoEnFase } from '../src/domain/patrones/escena'
import { puntoDeHueso, type EsqueletoResuelto } from '../src/domain/patrones/esqueleto'
import { ESQUELETO, PLANTA_NEUTRA } from '../src/domain/patrones/huesosNeutros'

/**
 * NADA DEL CUERPO POR DEBAJO DE LA GOMA DEL SUELO.
 *
 * Lo vio Bryan a ojo el 2026-09-06 —«el pie de atrás del búlgaro se hunde»— y al medirlo
 * no era uno: eran **diez patrones**, y de dos clases distintas.
 *
 * | qué | cuánto | por qué |
 * | --- | --- | --- |
 * | búlgara: rodilla y pie de atrás | −7,5 cm | la pose bajaba a una profundidad imposible |
 * | los dos de muñeca, rotación de cadera, extensión de rodilla, jalón, plancha, press inclinado, crunch, movilidad torácica | −2,5 a −6 cm | `apoyo: 'ninguno'` no corregía la altura: la ponía a mano `raizInicio` |
 *
 * Los del segundo grupo los arregla `resolverConApoyo` de una vez, subiendo al sujeto
 * cuando algo suyo cruza el suelo. El primero no se puede arreglar así —subir el cuerpo
 * entero despegaría el pie que estaba plantado— y se arregló en la ficha.
 *
 * ## La sonda del pie se toma DOS VECES, y es la mitad de la prueba
 *
 * La planta está 7,5 cm por debajo del tobillo, pero el hueso del pie lleva un reposo de
 * −90° sobre X: los 7,5 cm van por su **+Z local**, que apunta hacia abajo solo mientras el
 * pie esté horizontal. Con el pie inclinado apunta de lado, y entonces:
 *
 * - restarle 7,5 cm a la Y del mundo cuenta de MÁS —así salieron cuatro hundimientos de
 *   medio centímetro que no existían, en la dorsiflexión y el apoyo a una pierna—;
 * - medir solo por el +Z local cuenta de MENOS cuando el pie está de puntillas, porque
 *   entonces el punto que toca el suelo no es la planta sino la punta del hueso. Con esa
 *   sonda sola, la plancha salía hundida 5,7 cm y la corrección la dejó FLOTANDO 7.
 *
 * Se toma el menor de los dos y desaparecen los dos errores. Es el mismo error de signo que
 * ya costó una medida el 2026-09-04, escrito en `esqueleto.ts`.
 */

const FASES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]

/** La sonda: en los pies, 7,5 cm por el +Z local del hueso; en el resto, el hueso. */
function masBajoDe(esq: EsqueletoResuelto): { y: number; hueso: string } {
  let peor = { y: Infinity, hueso: '' }
  for (const h of ESQUELETO) {
    const esPie = h.nombre.startsWith('pie')
    for (const t of [0, 0.5, 1]) {
      const y = esPie
        ? Math.min(
            puntoDeHueso(esq, h.nombre, t)[1],
            puntoDeHueso(esq, h.nombre, t, [0, 0, PLANTA_NEUTRA])[1],
          )
        : puntoDeHueso(esq, h.nombre, t)[1]
      if (y < peor.y) peor = { y, hueso: h.nombre }
    }
  }
  return peor
}

function loMasBajoDelCiclo(patron: Patron): { y: number; hueso: string; fase: number } {
  let peor = { y: Infinity, hueso: '', fase: 0 }
  for (const fase of FASES) {
    const m = masBajoDe(esqueletoEnFase(patron, fase))
    if (m.y < peor.y) peor = { ...m, fase }
  }
  return peor
}

describe('la sonda mide donde está la planta, no donde está el hueso', () => {
  it('en un patrón de pie la planta cae en el suelo, no 7,5 cm por debajo', () => {
    // Si la sonda estuviera mal —restando de la Y en vez de ir por el +Z del hueso—, este
    // número saldría negativo en cuanto el pie se inclinara, y toda la lista de abajo
    // pasaría a estar llena de hundimientos inventados.
    const m = masBajoDe(esqueletoEnFase(PATRONES.find((p) => p.id === 'flexion_codo')!, 0))
    expect(m.y).toBeCloseTo(0, 2)
  })

  it('y sabe distinguir: con el pie 10 cm más arriba, la planta sale 10 cm más arriba', () => {
    // Un instrumento que devolviera siempre 0 pasaría la prueba de arriba. Éste no: la
    // suspensión cuelga de una barra y sus pies están muy por encima del suelo.
    const colgado = masBajoDe(esqueletoEnFase(PATRONES.find((p) => p.id === 'suspension')!, 0))
    expect(colgado.y).toBeGreaterThan(0.05)
  })
})

describe('ningún patrón del catálogo mete nada bajo el suelo', () => {
  // Medio centímetro de margen: por debajo de eso es ruido de coma flotante del solver.
  const TOPE = -0.005

  it.each(PATRONES.map((p) => [p.id, p] as const))('%s', (_id, patron) => {
    const peor = loMasBajoDelCiclo(patron)
    expect(
      peor.y,
      `${patron.id}: ${peor.hueso} llega a ${(peor.y * 100).toFixed(1)} cm en la fase ${peor.fase}`,
    ).toBeGreaterThan(TOPE)
  })
})

describe('y el sujeto tampoco flota, que es el fallo simétrico', () => {
  it('quien apoya en el suelo lo toca', () => {
    // Subir al que se hunde es fácil de escribir mal: basta con pasarse. Los patrones de
    // pie tienen que seguir TOCANDO el suelo, no quedarse a un centímetro de él.
    for (const p of PATRONES.filter((x) => x.apoyo === 'suelo')) {
      const peor = loMasBajoDelCiclo(p)
      expect(peor.y, `${p.id} flota a ${(peor.y * 100).toFixed(1)} cm`).toBeLessThan(0.01)
    }
  })
})
