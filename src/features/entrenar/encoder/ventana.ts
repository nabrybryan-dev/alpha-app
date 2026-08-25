/**
 * Qué se mira, dónde, y qué cuenta como haberlo encontrado.
 *
 * Aquí no hay estado: son funciones sobre una imagen y unos números. La política
 * —cuándo abrir la ventana, cuándo reenganchar, qué creerse— vive al lado, en
 * `seguimiento.ts`, y usa esto.
 *
 * La prueba del color es la del núcleo: `rgbAHsv` y `distanciaTono`, las mismas
 * funciones. Duplicarla aquí crearía un segundo criterio parecido al primero sin
 * serlo, y el día que alguien afinara uno el otro seguiría igual. Lo único que
 * cambia es por dónde pasa el bucle.
 */

import {
  distanciaTono,
  rgbAHsv,
  type DianaCuatro,
  type DosMarcadores,
  type Hsv,
  type MarcadorUnico,
  type Nube,
} from './nucleo/analisis.js'
import type { DiscoVisto } from './nucleo/disco.js'
import type { Referencia } from './tanda'

export type Deteccion = DianaCuatro | DosMarcadores | MarcadorUnico | DiscoVisto

export const esDiana = (d: Deteccion | undefined): d is DianaCuatro =>
  d !== undefined && 'nMarcas' in d && d.nMarcas === 4

export const esPareja = (d: Deteccion | undefined): d is DosMarcadores =>
  d !== undefined && 'a' in d && 'b' in d

export const esDisco = (d: Deteccion | undefined): d is DiscoVisto =>
  d !== undefined && 'cobertura' in d

export interface Recuadro {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface AjustesSeguimiento {
  referencia: Referencia
  /** Entre centros de marca, en mm. Solo con diana. */
  dianaMm: [number, number]
  tolTono: number
}

export interface Paso {
  det?: Deteccion
  /** Píxeles que casaron con el color. `null` con disco: ahí no se mira color. */
  nPix: number | null
  /** Dónde se miró. Se dibuja en la capa: una ventana que se sale de la imagen
   *  o que se queda atrás explica el fallo mucho mejor que un contador. */
  ventana?: Recuadro
  /** Fotogramas seguidos sin ver la referencia. */
  perdidos: number
}

/**
 * Los mínimos de saturación y brillo que corresponden al color que se fijó.
 *
 * Nunca por encima de los del núcleo —un marcador saturado se sigue filtrando
 * igual de duro— pero sí por debajo cuando la marca es pálida. El 0,6 es el
 * margen para que la misma marca siga casando cuando la luz del gimnasio le
 * quita saturación a media serie.
 */
export function umbralesDelColor(color: Hsv): { minSat: number; minVal: number } {
  return {
    minSat: Math.min(0.35, Math.max(0.08, color.s * 0.6)),
    minVal: Math.min(0.25, Math.max(0.08, color.v * 0.6)),
  }
}

/** El recuadro que envuelve lo detectado, con margen. */
export function recuadroDe(
  puntos: Array<{ x: number; y: number }>,
  margen: number,
  ancho: number,
  alto: number,
): Recuadro | undefined {
  if (puntos.length === 0) return undefined
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of puntos) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x)
    y1 = Math.max(y1, p.y)
  }
  if (!Number.isFinite(x0)) return undefined
  return {
    x0: Math.max(0, Math.floor(x0 - margen)),
    y0: Math.max(0, Math.floor(y0 - margen)),
    x1: Math.min(ancho - 1, Math.ceil(x1 + margen)),
    y1: Math.min(alto - 1, Math.ceil(y1 + margen)),
  }
}

/**
 * La nube de píxeles del color, mirando SOLO dentro del recuadro.
 *
 * La prueba del color es la del núcleo —`rgbAHsv` y `distanciaTono`, las mismas
 * funciones— porque duplicarla aquí crearía un segundo criterio parecido al
 * primero sin serlo, y el día que alguien afinara uno el otro seguiría igual.
 * Lo único que cambia es por dónde pasa el bucle.
 *
 * Las coordenadas que salen son las de la IMAGEN, no las del recuadro: quien
 * llama no tiene que deshacer ningún desplazamiento, y por tanto no puede
 * olvidarse de deshacerlo.
 */
export function nubeEnRecuadro(
  datos: Uint8ClampedArray,
  ancho: number,
  alto: number,
  objetivo: Hsv,
  recuadro: Recuadro,
  opciones: { tolTono?: number; minSat?: number; minVal?: number; paso?: number } = {},
): Nube {
  const { tolTono = 22, minSat = 0.35, minVal = 0.25, paso = 1 } = opciones
  const xs: number[] = []
  const ys: number[] = []
  const yFin = Math.min(alto - 1, recuadro.y1)
  const xFin = Math.min(ancho - 1, recuadro.x1)
  for (let y = Math.max(0, recuadro.y0); y <= yFin; y += paso) {
    for (let x = Math.max(0, recuadro.x0); x <= xFin; x += paso) {
      const i = (y * ancho + x) * 4
      const r = datos[i]
      const g = datos[i + 1]
      const b = datos[i + 2]
      if (r < 45 && g < 45 && b < 45) continue
      const hsv = rgbAHsv(r, g, b)
      if (hsv.s < minSat || hsv.v < minVal) continue
      if (distanciaTono(hsv.h, objetivo.h) > tolTono) continue
      xs.push(x)
      ys.push(y)
    }
  }
  return { xs, ys, n: xs.length }
}

/** ¿La detección incluye la marca que se tocó?
 *
 *  Es la pregunta que separa «he encontrado la referencia» de «he encontrado
 *  algo». Sin ella, `separarMarcadores` puede devolver la marca de la izquierda
 *  emparejada con el logo de la pared, y eso no es un fallo que se vea: es una
 *  pareja con su separación, su ángulo y su punto medio, que se mueve la mitad
 *  de lo que se mueve la barra. */
export function tocaAlguna(det: Deteccion, tocada: { x: number; y: number; n: number }): boolean {
  if (esDisco(det)) return Math.hypot(det.x - tocada.x, det.y - tocada.y) <= det.r
  // La tolerancia sale del tamaño de la propia mancha, no de un número fijo: con
  // 14 px fijos, una marca grande —un círculo de 5 cm a medio metro— se
  // rechazaba a sí misma, porque el centroide de la ventana del toque y el de la
  // detección completa no tienen por qué caer en el mismo píxel.
  const radio = Math.sqrt(tocada.n / Math.PI)
  const tolerancia = Math.max(14, radio * 1.5)
  return puntosDe(det).some((p) => Math.hypot(p.x - tocada.x, p.y - tocada.y) <= tolerancia)
}

/** Las dos esquinas que envuelven un círculo. */
export function esquinasDe(c: { x: number; y: number; r: number }): Array<{ x: number; y: number }> {
  return [
    { x: c.x - c.r, y: c.y - c.r },
    { x: c.x + c.r, y: c.y + c.r },
  ]
}

/** Los puntos que definen dónde está la referencia, para envolverlos. */
export function puntosDe(det: Deteccion): Array<{ x: number; y: number }> {
  if (esDiana(det)) return det.marcas
  if (esPareja(det)) return [det.a, det.b]
  if (esDisco(det)) return esquinasDe(det)
  return [{ x: det.x, y: det.y }]
}

