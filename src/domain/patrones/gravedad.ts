/**
 * El peso del sujeto, y dónde cae.
 *
 * Es el puente de física que faltaba entre la pose y el gesto. Un cuerpo de pie
 * obedece a Newton antes que a nadie: la resultante de su peso —la suma de
 * todos los segmentos, que es la ley del paralelogramo aplicada a fuerzas
 * paralelas— tiene que caer DENTRO del apoyo, o el sujeto se va de bruces. Esa
 * sola restricción es la que hace que una sentadilla eche la cadera atrás
 * cuando la rodilla va adelante: no es estética, es equilibrio.
 *
 * Las masas por segmento son las fracciones antropométricas de siempre
 * (Dempster y sucesores), redondeadas: el reparto es lo que importa, no el
 * decimal. Suman 1 con los dos lados contados.
 */

import { type Vec3 } from './algebra'
import { puntoDeHueso, type EsqueletoResuelto } from './esqueleto'

/**
 * Fracción de la masa corporal de cada segmento, y en qué punto del hueso está
 * su centro (0 = proximal, 1 = distal).
 *
 * El tronco se reparte entre pelvis, lumbar y tórax; la cabeza pesa un 8 % —más
 * de lo que parece, y por eso adelantarla mueve tanto el equilibrio.
 */
const SEGMENTOS: [string, number, number][] = [
  ['pelvis', 0.142, 0.5],
  ['lumbar', 0.139, 0.5],
  ['torax', 0.216, 0.55],
  ['cuello', 0.014, 0.5],
  ['craneo', 0.067, 0.5],
  ['brazoD', 0.028, 0.44],
  ['brazoI', 0.028, 0.44],
  ['antebrazoD', 0.016, 0.43],
  ['antebrazoI', 0.016, 0.43],
  ['manoD', 0.006, 0.5],
  ['manoI', 0.006, 0.5],
  ['musloD', 0.1, 0.43],
  ['musloI', 0.1, 0.43],
  ['tibiaD', 0.047, 0.43],
  ['tibiaI', 0.047, 0.43],
  ['pieD', 0.014, 0.5],
  ['pieI', 0.014, 0.5],
]

/** El centro de masas del cuerpo entero, en coordenadas de mundo. */
export function centroDeMasas(esq: EsqueletoResuelto): Vec3 {
  let x = 0
  let y = 0
  let z = 0
  let masa = 0
  for (const [hueso, fraccion, t] of SEGMENTOS) {
    const p = puntoDeHueso(esq, hueso, t)
    x += p[0] * fraccion
    y += p[1] * fraccion
    z += p[2] * fraccion
    masa += fraccion
  }
  return [x / masa, y / masa, z / masa]
}

/**
 * La base de apoyo en el eje anteroposterior: del talón a la punta del pie.
 *
 * Con margen hacia fuera de cero a propósito: el equilibrio real se lleva en
 * el mediopié, y un centro de masas jugando con el borde ya es un gesto que
 * nadie sostiene con carga.
 */
export function baseDeApoyo(
  esq: EsqueletoResuelto,
  pies: ('D' | 'I')[],
  extra: [string, number][] = [],
): { min: number; max: number } | null {
  if (pies.length === 0 && extra.length === 0) return null
  let min = Infinity
  let max = -Infinity
  for (const lado of pies) {
    const talon = puntoDeHueso(esq, 'pie' + lado, 0)
    const punta = puntoDeHueso(esq, 'pie' + lado, 1)
    min = Math.min(min, talon[2], punta[2])
    max = Math.max(max, talon[2], punta[2])
  }
  for (const [hueso, t] of extra) {
    const p = puntoDeHueso(esq, hueso, t)
    min = Math.min(min, p[2])
    max = Math.max(max, p[2])
  }
  return { min, max }
}

/**
 * Cuánto se sale el peso del apoyo, en metros. Cero si cae dentro.
 *
 * Es el número que delata un gesto imposible: un patrón que lo dispare está
 * dibujando algo que en el gimnasio termina en el suelo.
 */
export function desequilibrio(
  esq: EsqueletoResuelto,
  pies: ('D' | 'I')[],
  extra: [string, number][] = [],
): number {
  const base = baseDeApoyo(esq, pies, extra)
  if (!base) return 0
  const com = centroDeMasas(esq)
  if (com[2] < base.min) return base.min - com[2]
  if (com[2] > base.max) return com[2] - base.max
  return 0
}

/** La plomada: del centro de masas al suelo, para poder dibujarla. */
export function plomada(esq: EsqueletoResuelto): { desde: Vec3; hasta: Vec3 } {
  const com = centroDeMasas(esq)
  return { desde: com, hasta: [com[0], 0.005, com[2]] }
}

export const _soloParaTests = { SEGMENTOS }
