import type { Vec3 } from '../patrones/algebra'
import { Malla, type Color } from '../patrones/malla'

/**
 * Las primitivas del escenario, que se orientan solas.
 *
 * ## Por qué existe este archivo
 *
 * El motor descarta caras traseras —`gl.CULL_FACE` con `BACK`— así que el ORDEN de los
 * vértices de un triángulo no es un detalle de estilo: decide si la cara existe.
 * Enrollada al revés, la geometría se construye bien, se sube a la tarjeta, pasa por el
 * shader y **la GPU la tira en silencio**.
 *
 * Y así estuvo el escenario entero: la bahía, la retícula, la placa, el eje sagital y
 * los conos de encuadre miraban HACIA ABAJO. Desde donde mira la cámara no existían.
 * Medido sobre la escena real, antes y después: el fondo pasó de ocupar el 91,3 % del
 * lienzo al 6,7 %.
 *
 * Costó una tarde porque no hay nada que depurar. No falla, no avisa, y cualquier
 * comprobación que mire la malla dice que está perfecta — los vértices están, las
 * normales están, los índices están. Solo se ve mirando.
 *
 * ## La solución no es acordarse
 *
 * Arreglar los enrollados a mano fue un juego del topo: cada arreglo destapaba otra
 * cara al revés en otro sitio. Así que la primitiva **se orienta sola**: se le dice
 * hacia dónde MIRA la cara y ella decide el orden. Un dato —la normal— en vez de una
 * convención que hay que recordar en cada llamada.
 */

/** Producto vectorial de los dos lados de un triángulo: la normal de su enrollado. */
function normalDelEnrollado(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const u: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const v: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
}

/**
 * Un cuadrilátero que mira hacia `n`, en el orden que haga falta.
 *
 * Si el orden recibido produce una cara de espaldas, se invierte. El llamante escribe
 * las esquinas como le resulte natural y declara hacia dónde mira; el resto lo decide
 * la geometría.
 */
export function cuadro(m: Malla, p: [Vec3, Vec3, Vec3, Vec3], n: Vec3, c: Color): void {
  const w = normalDelEnrollado(p[0], p[1], p[2])
  const alReves = w[0] * n[0] + w[1] * n[1] + w[2] * n[2] < 0
  const orden = alReves ? [p[3], p[2], p[1], p[0]] : p
  const base = m.vertices
  for (const v of orden) m.vertice(v, n, c, 0)
  m.cuadro(base, base + 1, base + 2, base + 3)
}

/** Una losa horizontal a la altura `y`, mirando hacia arriba. */
export function losa(
  m: Malla,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number,
  c: Color,
): void {
  cuadro(
    m,
    [
      [x0, y, z0],
      [x1, y, z0],
      [x1, y, z1],
      [x0, y, z1],
    ],
    [0, 1, 0],
    c,
  )
}

/** Un disco horizontal mirando hacia arriba. */
export function disco(m: Malla, radio: number, y: number, c: Color, n = 64): void {
  const arriba: Vec3 = [0, 1, 0]
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2
    const a1 = ((i + 1) / n) * Math.PI * 2
    cuadro(
      m,
      [
        [0, y, 0],
        [Math.cos(a0) * radio, y, Math.sin(a0) * radio],
        [Math.cos(a1) * radio, y, Math.sin(a1) * radio],
        [0, y, 0],
      ],
      arriba,
      c,
    )
  }
}

/** Un anillo plano entre dos radios, mirando hacia arriba. */
export function anillo(
  m: Malla,
  rInt: number,
  rExt: number,
  y: number,
  c: Color,
  n = 64,
  desde = 0,
  hasta = 360,
): void {
  const arriba: Vec3 = [0, 1, 0]
  const r = (g: number) => (g * Math.PI) / 180
  for (let i = 0; i < n; i++) {
    const a0 = r(desde + ((hasta - desde) * i) / n)
    const a1 = r(desde + ((hasta - desde) * (i + 1)) / n)
    cuadro(
      m,
      [
        [Math.cos(a0) * rInt, y, Math.sin(a0) * rInt],
        [Math.cos(a0) * rExt, y, Math.sin(a0) * rExt],
        [Math.cos(a1) * rExt, y, Math.sin(a1) * rExt],
        [Math.cos(a1) * rInt, y, Math.sin(a1) * rInt],
      ],
      arriba,
      c,
    )
  }
}
