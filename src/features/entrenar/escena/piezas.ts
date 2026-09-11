import { grados, V, type Vec3 } from '../../../domain/patrones/algebra'
import { Malla, type Color } from '../../../domain/patrones/malla'

/**
 * LOS SÓLIDOS DE LA ESCENA: el cuadrilátero que se orienta solo y lo que se construye
 * con él —cilindros y cajas—.
 *
 * Salieron de `sala.ts` (el cuadrilátero) y de `implementos.ts` (los cilindros y la
 * caja) el 2026-09-02, al amueblar la sala. Hasta entonces cada módulo tenía los suyos y
 * `tripode.ts` ya importaba el cuadrilátero de `sala.ts` con esta nota escrita al lado:
 * «se importa en vez de copiarse: dos copias se separan al primer ajuste».
 *
 * Amueblar pedía cajas y cilindros en un cuarto sitio. Con las primitivas repartidas eso
 * eran o una tercera copia o una importación cruzada entre la sala y los implementos —y
 * la sala ya construye implementos, así que el ciclo estaba servido. Aquí no importan
 * nada de la escena: son geometría y punto, y los cuatro módulos cuelgan de ellas.
 *
 * ## La regla que las gobierna a todas
 *
 * NINGUNA ESCRIBE UN ORDEN DE VÉRTICES A MANO. Se le dice a `cuadro` hacia dónde mira la
 * cara y él decide el enrollado. Escribirlo a mano fue lo que dejó el escenario entero de
 * espaldas sin dar un solo error: con `CULL_FACE` la GPU tira la cara en silencio y la
 * pieza desaparece, y desde fuera eso se ve igual que no haberla construido.
 */

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
export function base(eje: Vec3): { u: Vec3; w: Vec3 } {
  const aux: Vec3 = Math.abs(eje[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]
  const u = V.normalizar(V.cruz(eje, aux))
  return { u, w: V.normalizar(V.cruz(eje, u)) }
}

export function tapa(m: Malla, centro: Vec3, n: Vec3, radio: number, c: Color, seg = 16): void {
  const { u, w } = base(n)
  const k = m.vertices
  m.vertice(centro, n, c, 0)
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2
    m.vertice(
      V.sumar(centro, V.sumar(V.escalar(u, Math.cos(a) * radio), V.escalar(w, Math.sin(a) * radio))),
      n,
      c,
      0,
    )
  }
  for (let i = 0; i < seg; i++) m.triangulo(k, k + 1 + i, k + 2 + i)
}

/** El manto de un cilindro entre dos puntos, sin tapas. */
export function manto(m: Malla, a: Vec3, b: Vec3, radio: number, c: Color, seg = 12): void {
  const eje = V.normalizar(V.restar(b, a))
  const { u, w } = base(eje)
  const en = (p: Vec3, ang: number): Vec3 =>
    V.sumar(p, V.sumar(V.escalar(u, Math.cos(ang) * radio), V.escalar(w, Math.sin(ang) * radio)))
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2
    const a1 = ((i + 1) / seg) * Math.PI * 2
    const medio = (a0 + a1) / 2
    const n = V.sumar(V.escalar(u, Math.cos(medio)), V.escalar(w, Math.sin(medio)))
    cuadro(m, [en(a, a0), en(b, a0), en(b, a1), en(a, a1)], n, c)
  }
}

/** Cilindro cerrado. Las tapas se pueden quitar cuando quedan dentro de otra pieza. */
export function cilindro(
  m: Malla,
  a: Vec3,
  b: Vec3,
  radio: number,
  c: Color,
  seg = 12,
  tapar = true,
): void {
  manto(m, a, b, radio, c, seg)
  if (!tapar) return
  const eje = V.normalizar(V.restar(b, a))
  tapa(m, b, eje, radio, c, seg)
  tapa(m, a, V.escalar(eje, -1), radio, c, seg)
}

/**
 * Una caja con giro alrededor del eje vertical. Es el ladrillo de las máquinas:
 * bastidores, placas, respaldos y bases se construyen con cajas.
 */
/** El eje vertical. Lo usan la caja y cualquiera que necesite «hacia arriba». */
export const ARRIBA: Vec3 = [0, 1, 0]

export function caja(m: Malla, centro: Vec3, medias: Vec3, giroY: number, c: Color): void {
  const g = grados(giroY)
  const ex: Vec3 = [Math.cos(g), 0, -Math.sin(g)]
  const ez: Vec3 = [Math.sin(g), 0, Math.cos(g)]
  const ey = ARRIBA
  const p = (sx: number, sy: number, sz: number): Vec3 =>
    V.sumar(
      centro,
      V.sumar(
        V.escalar(ex, sx * medias[0]),
        V.sumar(V.escalar(ey, sy * medias[1]), V.escalar(ez, sz * medias[2])),
      ),
    )
  const caras: [Vec3, [Vec3, Vec3, Vec3, Vec3]][] = [
    [ez, [p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1)]],
    [V.escalar(ez, -1), [p(1, -1, -1), p(-1, -1, -1), p(-1, 1, -1), p(1, 1, -1)]],
    [ex, [p(1, -1, 1), p(1, -1, -1), p(1, 1, -1), p(1, 1, 1)]],
    [V.escalar(ex, -1), [p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1)]],
    [ey, [p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1), p(-1, 1, -1)]],
    [V.escalar(ey, -1), [p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1)]],
  ]
  for (const [n, q] of caras) cuadro(m, q, n, c)
}

