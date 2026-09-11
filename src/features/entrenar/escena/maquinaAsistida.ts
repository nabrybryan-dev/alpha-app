import { V, type Vec3 } from '../../../domain/patrones/algebra'
import type { Malla } from '../../../domain/patrones/malla'
import { puntoDeHueso, type EsqueletoResuelto } from '../../../domain/patrones/esqueleto'
import { caja, manto } from './piezas'
import { ACERO, BASTIDOR, CAUCHO, PLACA, TAPIZADO } from './materia'

/**
 * LA MÁQUINA DE DOMINADA ASISTIDA: un bastidor que carga con el atleta.
 *
 * Bryan la pidió el 2026-09-06 («las dominadas asistidas, puedes buscar un vídeo de
 * referencia»): hasta entonces la asistida se dibujaba como una dominada a secas, una barra
 * fija con dos montantes, y el sujeto sentado en el aire. Referencia usada, con su vídeo:
 *
 * - Vídeo: «Exercise Tutorial: Technogym Wide Grip Assisted Pull-Up Machine» (Travis
 *   Tarrant), https://www.youtube.com/watch?v=uuioMSFzQ8U — se sube por los escalones
 *   laterales, se agarra la barra y se ponen las rodillas en la rodillera; la rodillera va
 *   unida por una palanca a la pila de placas, y CUANTO MÁS PESO, MÁS AYUDA.
 * - Medidas: Life Fitness Signature Series Assist Dip Chin, 134 × 170 × 225 cm y pila de
 *   85 kg (ficha del fabricante). De ahí el ancho del bastidor y la altura del techo.
 *
 * Dos convenciones conviven aquí A PROPÓSITO, y conviene saberlo antes de tocar nada:
 * - El BASTIDOR va clavado al suelo en coordenadas del mundo del sujeto, como toda máquina
 *   (`construirMaquina`): el sujeto está en el origen mirando a +Z y la pila, detrás.
 * - La RODILLERA se calcula CONTRA EL CUERPO, fase a fase, como el banco (`banco.ts`): en la
 *   máquina real sube y baja con quien se arrodilla en ella. Si se plantara a una altura
 *   fija, el sujeto la atravesaría a mitad de repetición.
 *
 * La BARRA sale de las manos: en una dominada las manos están fijas al mundo y es el cuerpo el
 * que sube (`apoyo: 'manos'` en la ficha `dominada_asistida`), así que la barra a la altura de
 * las manos ES la barra fija, y el techo del bastidor se construye justo encima de ella.
 */

/** Medio ancho del bastidor: 134 cm de máquina. */
const SEMIANCHO = 0.67
/** Dónde va la columna de la pila, detrás del sujeto (la máquina tiene 170 cm de fondo). */
const Z_COLUMNA = -0.8
/** La pila de placas, un poco más atrás que su columna. */
const Z_PILA = Z_COLUMNA - 0.28
/** Los montantes laterales, ligeramente por detrás de las manos. */
const Z_MONTANTES = -0.15
/** Cuánto sobresale el travesaño por encima de la barra. */
const SOBRE_LA_BARRA = 0.08
/** Lo que la barra vuela más allá de cada mano. */
const VUELO_BARRA = 0.3
const RADIO_BARRA = 0.016
/** El escalón para subirse, a los lados y algo por delante. */
const X_ESCALON = 0.48
const Z_ESCALON = 0.12
const ALTO_ESCALON = 0.36
/** Las asas de fondos: del montante hacia delante, a la altura de la cadera de pie. */
const X_ASA = 0.3
const ALTO_ASA = 1.32
const Z_ASA_FIN = 0.3
/** Radio de la espinilla: la rodillera se pone justo debajo del hueso, no dentro. */
const RADIO_ESPINILLA = 0.05
/** Medias de la rodillera (ancho, grosor, largo a lo largo de la espinilla). */
export const RODILLERA: Vec3 = [0.28, 0.035, 0.22]

/**
 * El centro de la rodillera, bajo las espinillas del sujeto tal como están en esta fase.
 *
 * Se toman las cuatro esquinas —rodilla y tobillo de cada tibia— y la rodillera se cuelga
 * del punto más bajo, menos el radio de la espinilla y su propio grosor: así ninguna parte
 * de la pierna la atraviesa aunque las dos tibias no estén a la misma altura.
 */
export function rodilleraBajo(esq: EsqueletoResuelto): Vec3 {
  const puntos = ['tibiaD', 'tibiaI'].flatMap((h) => [puntoDeHueso(esq, h, 0), puntoDeHueso(esq, h, 1)])
  let x = 0
  let z = 0
  let yMin = Infinity
  for (const p of puntos) {
    x += p[0]
    z += p[2]
    yMin = Math.min(yMin, p[1])
  }
  return [x / puntos.length, yMin - RADIO_ESPINILLA - RODILLERA[1], z / puntos.length]
}

/**
 * Los dos extremos de la barra, a partir de las manos.
 *
 * Con dos manos la barra sigue su eje y vuela un poco más allá de cada una. Con una sola
 * —o con las dos en el mismo punto, que en un eje normalizado sería dividir por cero— cruza
 * al sujeto de lado a lado, que es lo único que una barra de dominadas puede hacer.
 */
export function barraDe(manos: readonly Vec3[]): [Vec3, Vec3] {
  if (manos.length >= 2) {
    const entre = V.restar(manos[1], manos[0])
    if (V.largo(entre) > 1e-6) {
      const eje = V.normalizar(entre)
      return [V.restar(manos[0], V.escalar(eje, VUELO_BARRA)), V.sumar(manos[1], V.escalar(eje, VUELO_BARRA))]
    }
  }
  const c = manos[0]
  return [
    [c[0] - 0.55, c[1], c[2]],
    [c[0] + 0.55, c[1], c[2]],
  ]
}

/** El techo del bastidor: justo sobre la barra, y nunca tan bajo que no sea una máquina. */
export function techoSobre(barra: readonly [Vec3, Vec3]): number {
  return Math.max((barra[0][1] + barra[1][1]) / 2 + SOBRE_LA_BARRA, 1)
}

export function construirMaquinaAsistida(m: Malla, esq: EsqueletoResuelto, manos: readonly Vec3[]): void {
  const barra = barraDe(manos)
  const techo = techoSobre(barra)

  // La barra, lisa: una barra de dominadas no lleva mangas.
  manto(m, barra[0], barra[1], RADIO_BARRA, ACERO, 10)
  // Los dos brazos que la cuelgan del travesaño.
  for (const ext of barra) manto(m, [ext[0], techo, Z_MONTANTES], ext, 0.02, BASTIDOR, 8)

  for (const lado of [-1, 1]) {
    // El montante con su pie.
    const x = lado * SEMIANCHO
    caja(m, [x, techo / 2, Z_MONTANTES], [0.035, techo / 2, 0.035], 0, BASTIDOR)
    caja(m, [x, 0.03, Z_MONTANTES], [0.08, 0.03, 0.45], 0, BASTIDOR)
    // El escalón para subirse, con su poste.
    caja(m, [lado * X_ESCALON, ALTO_ESCALON, Z_ESCALON], [0.13, 0.015, 0.16], 0, CAUCHO)
    caja(m, [lado * X_ESCALON, ALTO_ESCALON / 2, Z_ESCALON], [0.02, ALTO_ESCALON / 2, 0.02], 0, BASTIDOR)
    // El asa de fondos: un soporte desde el montante y el asa hacia delante.
    caja(m, [lado * ((X_ASA + SEMIANCHO) / 2), ALTO_ASA, Z_MONTANTES], [(SEMIANCHO - X_ASA) / 2, 0.02, 0.02], 0, BASTIDOR)
    manto(m, [lado * X_ASA, ALTO_ASA, Z_MONTANTES], [lado * X_ASA, ALTO_ASA, Z_ASA_FIN], 0.016, ACERO, 8)
    // Las guías de la pila.
    manto(m, [lado * 0.1, 0.08, Z_PILA], [lado * 0.1, techo - 0.1, Z_PILA], 0.012, ACERO, 8)
  }
  // El travesaño que une los montantes, y el larguero que lo ata a la columna.
  caja(m, [0, techo, Z_MONTANTES], [SEMIANCHO + 0.035, 0.035, 0.035], 0, BASTIDOR)
  caja(m, [0, techo, (Z_COLUMNA + Z_MONTANTES) / 2], [0.035, 0.035, (Z_MONTANTES - Z_COLUMNA) / 2], 0, BASTIDOR)
  // La columna de la pila y la pila.
  caja(m, [0, techo / 2, Z_COLUMNA], [0.09, techo / 2, 0.12], 0, BASTIDOR)
  caja(m, [0, 0.5, Z_PILA], [0.16, 0.42, 0.1], 0, PLACA)

  // La rodillera, bajo las espinillas de ESTA fase, y la palanca que la lleva a la columna.
  const r = rodilleraBajo(esq)
  caja(m, r, RODILLERA, 0, TAPIZADO)
  const zTrasero = r[2] - RODILLERA[2]
  caja(m, [r[0], r[1], (zTrasero + Z_COLUMNA) / 2], [0.03, 0.025, Math.abs(zTrasero - Z_COLUMNA) / 2], 0, BASTIDOR)
  // El carro que corre por la columna.
  caja(m, [0, r[1], Z_COLUMNA], [0.11, 0.06, 0.14], 0, BASTIDOR)
}
