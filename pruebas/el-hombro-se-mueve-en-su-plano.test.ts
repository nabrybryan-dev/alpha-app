import { describe, expect, it } from 'vitest'
import { PATRONES, PATRON_POR_ID, type Patron } from '../src/domain/patrones/catalogo'
import { esqueletoEnFase } from '../src/domain/patrones/escena'
import { poseAnimada } from '../src/domain/patrones/movimiento'
import { puntoDeHueso } from '../src/domain/patrones/esqueleto'

/**
 * EL HOMBRO Y EL CODO, MEDIDOS SOBRE EL HUESO.
 *
 * Encargo de Bryan del 2026-09-07: «que pueda revisar bien todos los ejercicios que requieran
 * involucrar la articulación glenohumeral, porque como tiene tanta capacidad de ejercer
 * movimiento en diferentes ángulos, al conjugar las abducciones, aducciones, las flexiones,
 * extensiones, rotaciones externas e internas, te puedes confundir… se ven antinaturales.
 * Incluso hacen acciones en el codo que no puede hacer».
 *
 * Lo que este guardián protege no son números bonitos: son tres cosas que ya estuvieron mal.
 *
 * 1. **El codo hace el ángulo que la ficha escribe.** Los tres canales del hombro son ángulos
 *    de Euler encadenados, y hasta el 2026-09-07 el codo flexionaba «en el plano sagital del
 *    cuerpo» deshaciendo la abducción del padre. Eso daba
 *    `cos(codo real) = sin²(abducción) + cos²(abducción)·cos(codo escrito)`: con el hombro a
 *    90° el codo DESAPARECÍA. Medido ese día, antes de arreglarlo: el press de banca escribía
 *    100° y enseñaba 60; el jalón escribía 130 y enseñaba 90; la apertura de pecho escribía 30
 *    —«el codo mantiene su ángulo», dice su clave— y enseñaba 3.
 * 2. **El codo no se dobla hacia el otro lado.** Es una bisagra.
 * 3. **La elevación lateral sube por el plano escapular.** Su propia clave dice «codo
 *    ligeramente por delante del cuerpo, no clavado al lado», y hacía lo contrario: el húmero
 *    arrancaba a 32° del plano frontal y acababa a −2°, o sea clavado al lado a la altura del
 *    hombro, que es la postura que pellizca.
 *
 * El instrumento con el que se miran todos los patrones, y del que salen estos números, es
 * `scripts/medir-hombro.mjs`.
 */

const FASES = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]
const grados = (r: number) => (r * 180) / Math.PI
type V3 = readonly [number, number, number]
const resta = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cruz = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const punto = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norma = (v: V3) => Math.hypot(v[0], v[1], v[2])
const unitario = (v: V3): V3 => { const n = norma(v) || 1; return [v[0] / n, v[1] / n, v[2] / n] }
const angulo = (a: V3, b: V3) => grados(Math.acos(Math.max(-1, Math.min(1, punto(a, b) / ((norma(a) * norma(b)) || 1)))))

/** El brazo derecho en el sistema del tronco, que es como se describe un gesto en anatomía. */
function brazo(patron: Patron, fase: number) {
  const esq = esqueletoEnFase(patron, fase)
  const p = (h: string, t: number) => puntoDeHueso(esq, h, t) as unknown as V3
  const hombro = p('brazoD', 0)
  const codo = p('brazoD', 1)
  const muneca = p('antebrazoD', 1)
  const arriba = unitario(resta(p('torax', 1), p('pelvis', 0)))
  const fueraCrudo = resta(hombro, p('brazoI', 0))
  const fuera = unitario(resta(fueraCrudo, [arriba[0] * punto(fueraCrudo, arriba), arriba[1] * punto(fueraCrudo, arriba), arriba[2] * punto(fueraCrudo, arriba)]))
  const humero = resta(codo, hombro)
  const antebrazo = resta(muneca, codo)
  return {
    // Ángulo entre húmero y antebrazo tal y como lo escribe el catálogo: 0 = codo estirado.
    codo: 180 - angulo([-humero[0], -humero[1], -humero[2]], antebrazo),
    elevacion: angulo(humero, [-arriba[0], -arriba[1], -arriba[2]]),
    // 0° = brazo hacia el lado (plano frontal), 90° = brazo al frente.
    plano: grados(Math.atan2(punto(humero, unitario(cruz(arriba, fuera))), punto(humero, fuera))),
  }
}

describe('el codo hace lo que la ficha dice, en cualquier postura del hombro', () => {
  it('ningún patrón se desvía más de 2° del `codoFlex` que se está dibujando', () => {
    for (const p of PATRONES) {
      for (const f of FASES) {
        // Contra la pose ANIMADA, no contra la del catálogo: la capa de vida mueve hasta 5,5°
        // el codo de quien no lo usa —un peso muerto, una extensión de cadera—, y eso es un
        // adorno querido, no un error de rig. Lo que aquí se afirma es que el hueso hace lo
        // que la pose dice, venga de donde venga.
        const { pose } = poseAnimada(p, f, 1, 0)
        const escrito = pose.codoFlexD ?? pose.codoFlex ?? 0
        const real = brazo(p, f).codo
        expect(
          Math.abs(real - escrito),
          `${p.id} en la fase ${f}: la ficha escribe ${escrito.toFixed(0)}° de codo y el hueso hace ${real.toFixed(0)}°`,
        ).toBeLessThanOrEqual(2)
      }
    }
  })

  it('ningún codo se dobla hacia el otro lado', () => {
    for (const p of PATRONES) {
      for (const f of FASES) {
        expect(brazo(p, f).codo, `${p.id} hiperextiende el codo en la fase ${f}`).toBeGreaterThanOrEqual(-5)
      }
    }
  })
})

describe('la elevación lateral sube por el plano escapular', () => {
  it('el húmero se queda entre 20° y 40° del plano frontal en todo el recorrido', () => {
    for (const f of FASES) {
      const { plano, elevacion } = brazo(PATRON_POR_ID.abduccion_hombro, f)
      // Con el brazo casi colgando el plano es ruido: un grado de nada lo manda de −80 a 80.
      if (elevacion < 25) continue
      expect(plano, `la elevación lateral va a ${plano.toFixed(0)}° del plano frontal en la fase ${f}`).toBeGreaterThan(20)
      expect(plano).toBeLessThan(40)
    }
  })

  it('y llega a la altura del hombro, ni un dedo más, como dice su clave', () => {
    const arriba = brazo(PATRON_POR_ID.abduccion_hombro, 1)
    expect(arriba.elevacion).toBeGreaterThan(85)
    expect(arriba.elevacion).toBeLessThan(100)
  })
})
