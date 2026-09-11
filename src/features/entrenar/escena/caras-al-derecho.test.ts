import { describe, expect, it } from 'vitest'
import { Malla } from '../../../domain/patrones/malla'
import { construirLaboratorio } from '../../../domain/escenario/laboratorio'
import { construirSala } from './sala'
import { construirTripode } from './tripode'

/**
 * NINGUNA CARA PUEDE ESTAR DEL REVÉS.
 *
 * El motor descarta caras traseras —`gl.CULL_FACE` con `BACK`— así que el orden de los
 * vértices de un triángulo NO es un detalle: decide si la cara existe. Enrollada al
 * revés, la geometría se sube correcta, ocupa memoria, pasa por el shader y **la tarjeta
 * la tira en silencio**.
 *
 * Ya pasó una vez en este mismo escenario (PR #183, agosto de 2026): la bahía entera, la
 * retícula, la placa, el eje sagital y los conos de encuadre miraban HACIA ABAJO. Vistos
 * desde arriba —que es de donde mira la cámara— no existían. Medido sobre la escena
 * real: el fondo pasó de ocupar el 91,3 % del lienzo al 6,7 % al arreglarlo.
 *
 * Costó una tarde entera porque no hay nada que depurar: no falla, no avisa, y las
 * comprobaciones que miran la malla dicen que todo está bien. Solo se ve mirando.
 *
 * Este guardián vigila las TRES piezas que construyen el escenario del encoder tal como
 * viven hoy en `main` —el laboratorio, la sala y el trípode—, y no la versión de aquel
 * PR: `sala.ts` y `tripode.ts` se reescribieron enteros en septiembre (sala de Blender,
 * mobiliario, oclusión del aparato) y nada comprobaba su enrollado. El motivo del PR
 * original vale igual sobre la geometría nueva.
 *
 * ## Por qué se admite holgura y qué significa el umbral
 *
 * La prueba es geométrica y no necesita GPU: la normal que se deduce del ORDEN de los
 * vértices —el producto vectorial de sus dos lados— tiene que apuntar al mismo lado que
 * la normal que el vértice declara. En una superficie curva la normal del vértice está
 * suavizada entre varios triángulos y no coincide exactamente con la de uno solo; lo que
 * NO se admite es que apunten a lados CONTRARIOS, que es lo que significa estar del
 * revés.
 */

function triangulosDe(m: Malla): { desviados: string[]; total: number } {
  const desviados: string[] = []
  let total = 0
  for (let t = 0; t < m.indice.length; t += 3) {
    const [ia, ib, ic] = [m.indice[t], m.indice[t + 1], m.indice[t + 2]]
    const p = (i: number) => [m.posicion[i * 3], m.posicion[i * 3 + 1], m.posicion[i * 3 + 2]] as const
    const a = p(ia)
    const b = p(ib)
    const c = p(ic)
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    // Normal del enrollado: u × v.
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const largo = Math.hypot(n[0], n[1], n[2])
    // Un triángulo degenerado no tiene lado: no dice nada y no se dibuja.
    if (largo < 1e-9) continue
    total++
    const dec = [m.normal[ia * 3], m.normal[ia * 3 + 1], m.normal[ia * 3 + 2]]
    const coseno = (n[0] * dec[0] + n[1] * dec[1] + n[2] * dec[2]) / largo
    if (coseno < -0.1) {
      desviados.push(`tri ${t / 3} en (${a.map((q) => q.toFixed(2)).join(', ')}) coseno ${coseno.toFixed(2)}`)
    }
  }
  return { desviados, total }
}

describe('las caras del escenario del encoder miran hacia fuera', () => {
  it.each([
    [
      'el laboratorio',
      () => {
        const m = new Malla()
        construirLaboratorio(m)
        return m
      },
    ],
    [
      'la sala',
      () => {
        const m = new Malla()
        construirSala(m, { veces: 3, cuanto: 8, esfuerzo: 2 }, 0)
        return m
      },
    ],
    [
      'el trípode',
      () => {
        const m = new Malla()
        construirTripode(m, { anguloGrados: 180, distancia: 3, altura: 1 })
        return m
      },
    ],
  ])('%s no tiene ni una cara del revés', (_nombre, construir) => {
    const { desviados, total } = triangulosDe(construir())
    expect(total).toBeGreaterThan(40)
    expect(desviados.slice(0, 4)).toEqual([])
  })
})
