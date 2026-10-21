import { grados, V, type Vec3 } from '../../../domain/patrones/algebra'
import { puntoDeHueso, type EsqueletoResuelto } from '../../../domain/patrones/esqueleto'
import { Malla, tubo, type Color } from '../../../domain/patrones/malla'
import type { ArticulacionDeLaCapa, CapaDeMomentos } from '../../../domain/sujeto/capaDeMomentos'

/**
 * LOS MOMENTOS ARTICULARES, EN GEOMETRÍA. Convierte lo que decidió `domain/sujeto/capaDeMomentos`
 * en mallas; no decide nada: si la capa viene vacía, las dos mallas salen sin vértices.
 *
 * Dos mallas, como `mallasDeFuerzas`: la primera SÓLIDA (el momento calculado: un arco que barre
 * más cuanto mayor es) y la segunda TRANSLÚCIDA (la banda estimada: un arco más grueso y un poco más
 * ancho, entre los barridos del p5 y del p95). Las dos van `encima` del cuerpo, igual que las
 * fuerzas: el eje de la cadera está dentro de la carne y con profundidad se veía a trozos.
 *
 * El arco vive en el plano sagital (el del cálculo): arranca hacia delante (+z) y sube (+y). Su radio
 * es media longitud del hueso que cuelga de la articulación, mayor que el de las fuerzas (un tercio),
 * y su color es otro, para que los dos arcos no se lean como uno.
 */

const COLOR_DEL_MOMENTO: Color = [0.1, 0.78, 0.86]
/** Cuánto se ve a través de la banda estimada. Distinto de 1 a propósito: estimado no es calculado. */
export const ALFA_DE_LA_BANDA = 0.35
/** Lo que barre el arco entero (fracción 1). */
const BARRIDO_ENTERO = 120
const PARTE_DEL_HUESO = 0.5
const HUESO_POR_DEFECTO = 0.3
const GROSOR_DEL_VALOR = 0.006
const GROSOR_DE_LA_BANDA = 0.013
const ENSANCHE_DE_LA_BANDA = 1.18
const PASOS = 24

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
  const solida = new Malla(1024)
  const banda = new Malla(1024)
  solida.encima = true
  banda.encima = true
  banda.alfa = ALFA_DE_LA_BANDA
  for (const e of capa.elementos) {
    const hueso = ejeDe(esq, HUESO_DE[e.articulacion])
    if (!hueso) continue
    const radio = (hueso.largo > 0 ? hueso.largo : HUESO_POR_DEFECTO) * PARTE_DEL_HUESO
    arco(solida, hueso.eje, radio, 0, e.fraccion * BARRIDO_ENTERO, GROSOR_DEL_VALOR)
    if (e.banda) {
      arco(banda, hueso.eje, radio * ENSANCHE_DE_LA_BANDA, e.banda.inf * BARRIDO_ENTERO, e.banda.sup * BARRIDO_ENTERO, GROSOR_DE_LA_BANDA)
    }
  }
  return [solida, banda]
}
