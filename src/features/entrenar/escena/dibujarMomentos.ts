import { grados, V, type Vec3 } from '../../../domain/patrones/algebra'
import { puntoDeHueso, type EsqueletoResuelto } from '../../../domain/patrones/esqueleto'
import { Malla, tubo, type Color } from '../../../domain/patrones/malla'
import type { ArticulacionDeLaCapa, CapaDeMomentos } from '../../../domain/sujeto/capaDeMomentos'

/**
 * LOS MOMENTOS ARTICULARES, EN GEOMETRÍA. Convierte lo que decidió `domain/sujeto/capaDeMomentos`
 * en mallas; no decide nada: si la capa viene vacía, las mallas salen sin vértices.
 *
 * Tres mallas, de más a menos presencia, según el ESTADO de la cifra (P-12):
 *   0. `calculado`: arco SÓLIDO (`alfa` 1). Hoy la capa no produce ninguno —todo momento sale de la
 *      tabla poblacional y es `estimado`—, pero el estado manda el dibujo y no al revés.
 *   1. `estimado`: el arco del valor, TRANSLÚCIDO (`ALFA_DEL_VALOR`).
 *   2. la banda p5-p95: un arco más grueso y un poco más ancho, aún más translúcido (`ALFA_DE_LA_BANDA`).
 * Las tres van `encima` del cuerpo, igual que las fuerzas: el eje de la cadera está dentro de la carne
 * y con profundidad se veía a trozos.
 *
 * El arco vive en el plano sagital (el del cálculo): arranca hacia delante (+z) y sube (+y). Su radio
 * es media longitud del hueso que cuelga de la articulación, mayor que el de las fuerzas (un tercio),
 * y su color es otro, para que los dos arcos no se lean como uno.
 *
 * SOLO EN LA POSE DEL CÁLCULO (C-3 de la revisión de Opus): los números son de una pose fija; pintar
 * los arcos en todas las fases de la animación diría que el momento no cambia al bajar. Así que las
 * mallas salen vacías salvo cuando el esqueleto pasa por esa pose (`enLaPoseDelCalculo`).
 */

const COLOR_DEL_MOMENTO: Color = [0.1, 0.78, 0.86]
/** Cuánto se ve a través del arco de un valor estimado. Distinto de 1 a propósito: estimado no es calculado. */
export const ALFA_DEL_VALOR = 0.7
/** Cuánto se ve a través de la banda. Menos que el valor: el intervalo acompaña, no manda. */
export const ALFA_DE_LA_BANDA = 0.35
/** Lo que barre el arco entero (fracción 1). */
const BARRIDO_ENTERO = 120
const PARTE_DEL_HUESO = 0.5
const HUESO_POR_DEFECTO = 0.3
const GROSOR_DEL_VALOR = 0.006
const GROSOR_DE_LA_BANDA = 0.013
const ENSANCHE_DE_LA_BANDA = 1.18
const PASOS = 24
/** Cuánto se puede apartar el esqueleto de la pose del cálculo y seguir contando como «en la pose» (rad, ~11°). */
export const TOLERANCIA_DE_POSE = 0.2

const HUESO_DE: Record<ArticulacionDeLaCapa, string> = { tobillo: 'pie', rodilla: 'tibia', cadera: 'muslo' }

/** El arranque del hueso, a medio camino entre los dos lados; `undefined` si el rig no lo tiene. */
function ejeDe(esq: EsqueletoResuelto, raiz: string): { eje: Vec3; largo: number } | undefined {
  const d = `${raiz}D`
  const i = `${raiz}I`
  if (!esq.mundo[d] || !esq.mundo[i]) return undefined
  const a = puntoDeHueso(esq, d, 0)
  const b = puntoDeHueso(esq, i, 0)
  const punta = puntoDeHueso(esq, d, 1)
  return {
    eje: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    largo: Math.hypot(punta[0] - a[0], punta[1] - a[1], punta[2] - a[2]),
  }
}

/**
 * Los ángulos de tibia y muslo respecto de la vertical, con la convención de `dinamica.ts`: sobre la
 * dirección del extremo distal al proximal y positivos hacia +z. En el rig la tibia arranca en la
 * rodilla y el muslo en la cadera, así que proximal = punto 0 del hueso y distal = punto 1.
 */
export function poseDelEsqueleto(esq: EsqueletoResuelto): { tibia: number; muslo: number } | undefined {
  if (!esq.mundo.tibiaD || !esq.mundo.musloD) return undefined
  const ang = (hueso: string) => {
    const prox = puntoDeHueso(esq, hueso, 0)
    const dist = puntoDeHueso(esq, hueso, 1)
    return Math.atan2(prox[2] - dist[2], prox[1] - dist[1])
  }
  return { tibia: ang('tibiaD'), muslo: ang('musloD') }
}

/** ¿Pasa ahora el esqueleto por la pose con la que se calcularon los momentos? */
export function enLaPoseDelCalculo(
  esq: EsqueletoResuelto,
  pose: { tibia: number; muslo: number },
  tolerancia = TOLERANCIA_DE_POSE,
): boolean {
  const ahora = poseDelEsqueleto(esq)
  if (!ahora) return false
  return Math.abs(ahora.tibia - pose.tibia) <= tolerancia && Math.abs(ahora.muslo - pose.muslo) <= tolerancia
}

function arco(m: Malla, eje: Vec3, radio: number, desde: number, hasta: number, grosor: number): void {
  if (!(hasta > desde)) return
  const puntos: Vec3[] = []
  for (let k = 0; k <= PASOS; k++) {
    const a = grados(desde + ((hasta - desde) * k) / PASOS)
    puntos.push(V.sumar(eje, [0, Math.sin(a) * radio, Math.cos(a) * radio]))
  }
  tubo(m, puntos, () => grosor, { radial: 6, color: COLOR_DEL_MOMENTO, tapar: true })
}

export function mallasDeMomentos(capa: CapaDeMomentos, esq: EsqueletoResuelto): Malla[] {
  const calculados = new Malla(1024)
  const estimados = new Malla(1024)
  const banda = new Malla(1024)
  for (const m of [calculados, estimados, banda]) m.encima = true
  estimados.alfa = ALFA_DEL_VALOR
  banda.alfa = ALFA_DE_LA_BANDA
  const salida = [calculados, estimados, banda]
  if (!capa.poseDelCalculo || !enLaPoseDelCalculo(esq, capa.poseDelCalculo)) return salida
  for (const e of capa.elementos) {
    const hueso = ejeDe(esq, HUESO_DE[e.articulacion])
    if (!hueso) continue
    const radio = (hueso.largo > 0 ? hueso.largo : HUESO_POR_DEFECTO) * PARTE_DEL_HUESO
    arco(e.estado === 'calculado' ? calculados : estimados, hueso.eje, radio, 0, e.fraccion * BARRIDO_ENTERO, GROSOR_DEL_VALOR)
    if (e.banda) {
      arco(banda, hueso.eje, radio * ENSANCHE_DE_LA_BANDA, e.banda.inf * BARRIDO_ENTERO, e.banda.sup * BARRIDO_ENTERO, GROSOR_DE_LA_BANDA)
    }
  }
  return salida
}
