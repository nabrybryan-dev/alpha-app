import { aportesDeCategoria } from '../../../../domain/taxonomia'
import type { EjercicioPrescrito, Sesion } from '../../../../domain/types'
import { NOMBRE_DE_REGION, REGIONES, type IdDeRegion } from '../../sujeto/regiones'
import type { CapaDelCuerpo } from '../../sujeto/pintura'
import { GRUPO_A_REGIONES, lecturaCorta, type SeriesPorRegion, type TinteDelCuerpo } from '../../sujeto/tinte'

/**
 * LA GUÍA DE PRAXIS EN ENTRENAR: qué dice cada zona del cuerpo, sin modelo y sin red.
 *
 * Sale de lo que la app ya tiene (la sesión y su taxonomía) y de un texto fijo por región. No es la
 * charla de Praxis, que sigue cerrada a asesorados: aquí no se escribe nada ni se llama a nadie, así
 * que navegar no gasta la clave. Las cuentas son las de `seriesPorRegion`, para que el panel y el mapa
 * no den dos números. No hay porcentajes de activación: el laboratorio no los puede afirmar.
 */

export interface FichaDeRegion {
  partes: string
  queHace: string
}

export const FICHA_DE_REGION: Readonly<Record<IdDeRegion, FichaDeRegion>> = {
  pecho: {
    partes: 'Pectoral mayor (fibras altas y bajas) y pectoral menor',
    queHace: 'Lleva el brazo hacia adelante y hacia el centro del cuerpo, como al empujar.',
  },
  delt: {
    partes: 'Deltoides (anterior, medio y posterior) y manguito rotador',
    queHace: 'Levanta el brazo en todas las direcciones; el manguito mantiene estable el hombro.',
  },
  bic: {
    partes: 'Bíceps (cabeza larga y corta), braquial y coracobraquial',
    queHace: 'Dobla el codo y ayuda a girar la palma hacia arriba.',
  },
  tri: {
    partes: 'Tríceps (cabezas larga, lateral y medial) y ancóneo',
    queHace: 'Estira el codo; la cabeza larga también lleva el brazo hacia atrás.',
  },
  ante: {
    partes: 'Flexores y extensores de muñeca y dedos, y braquiorradial',
    queHace: 'Cierra la mano, sostiene el agarre y mueve la muñeca.',
  },
  abd: {
    partes: 'Recto abdominal y transverso',
    queHace: 'Acerca las costillas a la pelvis y da firmeza al tronco.',
  },
  obl: {
    partes: 'Oblicuos externo e interno y serrato anterior',
    queHace: 'Gira e inclina el tronco; el serrato lleva el omóplato hacia adelante.',
  },
  trap: {
    partes: 'Trapecio (alto, medio y bajo), romboides y elevador de la escápula',
    queHace: 'Sube, junta y baja los omóplatos.',
  },
  dors: {
    partes: 'Dorsal ancho, redondo mayor y músculos de la espalda media',
    queHace: 'Lleva el brazo hacia abajo y atrás, como al halar; los profundos sostienen la espalda.',
  },
  lumb: {
    partes: 'Erectores lumbares, multífido y cuadrado lumbar',
    queHace: 'Mantiene firme la parte baja de la espalda y ayuda a extenderla.',
  },
  glu: {
    partes: 'Glúteo mayor, medio y menor, y rotadores de la cadera',
    queHace: 'Extiende y abre la cadera, y la estabiliza al apoyarte en una pierna.',
  },
  cua: {
    partes: 'Recto femoral y vastos lateral, medial e intermedio',
    queHace: 'Estira la rodilla; el recto femoral también ayuda a subir el muslo.',
  },
  isq: {
    partes: 'Bíceps femoral, semitendinoso y semimembranoso',
    queHace: 'Dobla la rodilla y lleva la cadera hacia atrás.',
  },
  adu: {
    partes: 'Aductor mayor, largo y corto, grácil y pectíneo',
    queHace: 'Acerca la pierna al centro del cuerpo y ayuda a estabilizar la cadera.',
  },
  gem: {
    partes: 'Gemelos, sóleo, tibial anterior y peroneos',
    queHace: 'Empuja el pie contra el suelo y estabiliza el tobillo.',
  },
}

export interface EnfoqueDeRegion {
  azimut: 0 | 180
  /** Altura del punto al que mira la cámara, en metros del sujeto (cuerpo de 1,72 m). */
  alto: number
  distancia: number
  elevacion: number
}

/**
 * Cómo se acerca la cámara a cada zona. `alto` queda por debajo del músculo porque el panel de la guía
 * tapa la mitad baja de la pantalla: así la zona cae en la mitad de arriba. La pierna mira desde más
 * alto para no meter la cámara bajo el suelo.
 */
export const ENFOQUE_DE_REGION: Readonly<Record<IdDeRegion, EnfoqueDeRegion>> = {
  pecho: { azimut: 0, alto: 0.96, distancia: 2.4, elevacion: 2 },
  delt: { azimut: 0, alto: 1.03, distancia: 2.4, elevacion: 2 },
  bic: { azimut: 0, alto: 0.84, distancia: 2.4, elevacion: 2 },
  tri: { azimut: 180, alto: 0.84, distancia: 2.4, elevacion: 2 },
  ante: { azimut: 0, alto: 0.56, distancia: 2.4, elevacion: 2 },
  abd: { azimut: 0, alto: 0.74, distancia: 2.4, elevacion: 2 },
  obl: { azimut: 0, alto: 0.72, distancia: 2.4, elevacion: 2 },
  trap: { azimut: 180, alto: 1.08, distancia: 2.4, elevacion: 2 },
  dors: { azimut: 180, alto: 0.9, distancia: 2.4, elevacion: 2 },
  lumb: { azimut: 180, alto: 0.66, distancia: 2.4, elevacion: 2 },
  glu: { azimut: 180, alto: 0.52, distancia: 2.4, elevacion: 2 },
  cua: { azimut: 0, alto: 0.22, distancia: 2.4, elevacion: 4 },
  isq: { azimut: 180, alto: 0.22, distancia: 2.4, elevacion: 4 },
  adu: { azimut: 0, alto: 0.32, distancia: 2.4, elevacion: 4 },
  gem: { azimut: 180, alto: 0, distancia: 2.4, elevacion: 12 },
}

export interface TrabajoDeRegion {
  /** El lugar del ejercicio en la sesión: lo que entiende el salón para ir a él. */
  indice: number
  ejercicio: EjercicioPrescrito
  papel: 'principal' | 'apoyo'
  /** Cuánto suma cada serie anotada a esta zona: el mismo reparto de `seriesPorRegion`. */
  cuentaPorSerie: number
  anotadas: number
  pautadas: number
}

function cuentaDe(id: IdDeRegion, e: Pick<EjercicioPrescrito, 'categoria' | 'nombre'>): number {
  let total = 0
  for (const { grupo, factor } of aportesDeCategoria(e.categoria, e.nombre)) {
    for (const { region, peso } of GRUPO_A_REGIONES[grupo]) if (region === id) total += factor * peso
  }
  return total
}

/** Los ejercicios de la sesión que tocan la zona: primero los principales. */
export function trabajoDeRegion(id: IdDeRegion, sesion: Pick<Sesion, 'ejercicios'> | undefined): TrabajoDeRegion[] {
  const salida: TrabajoDeRegion[] = []
  ;(sesion?.ejercicios ?? []).forEach((ejercicio, indice) => {
    const cuentaPorSerie = cuentaDe(id, ejercicio)
    if (cuentaPorSerie <= 0) return
    salida.push({
      indice,
      ejercicio,
      papel: cuentaPorSerie >= 1 ? 'principal' : 'apoyo',
      cuentaPorSerie,
      anotadas: ejercicio.series.length,
      pautadas: ejercicio.sets,
    })
  })
  return salida.sort((a, b) => b.cuentaPorSerie - a.cuentaPorSerie || a.indice - b.indice)
}

/** Las 15 zonas al deslizar: primero las que trabaja la sesión, y dentro de ellas las que más. */
export function ordenDeZonas(sesion: Pick<Sesion, 'ejercicios'> | undefined): IdDeRegion[] {
  const peso = (id: IdDeRegion) => trabajoDeRegion(id, sesion).reduce((s, t) => s + t.cuentaPorSerie * t.pautadas, 0)
  return REGIONES.map((r, orden) => ({ id: r.id, orden, p: peso(r.id) }))
    .sort((a, b) => b.p - a.p || a.orden - b.orden)
    .map((x) => x.id)
}

/** La única línea del centro: qué falta, qué se hizo, o cómo empezar. */
export function lineaDePraxis(porTrabajar: readonly IdDeRegion[], series: SeriesPorRegion): string {
  if (porTrabajar.length > 0) {
    const [a, b] = porTrabajar.map((id) => NOMBRE_DE_REGION[id])
    if (porTrabajar.length === 1) return `Hoy te falta: ${a}`
    if (porTrabajar.length === 2) return `Hoy te falta: ${a} y ${b}`
    return `Hoy te falta: ${a}, ${b} y ${porTrabajar.length - 2} más`
  }
  const hecho = lecturaCorta(series)
  return hecho ? `Hoy trabajaste: ${hecho}` : 'Toca un músculo para saber qué hace'
}

/** Con una zona abierta el cuerpo siempre se ve en músculo: en Piel o en Hueso no se distinguiría. */
export function capaDeLaVista(zona: IdDeRegion | null, capa: CapaDelCuerpo): CapaDelCuerpo {
  return zona ? 'musculo' : capa
}

/** Solo la zona elegida queda encendida; el dolor no se apaga nunca. Devuelve una copia. */
export function tinteEnfocado(tinte: TinteDelCuerpo, zona: IdDeRegion): TinteDelCuerpo {
  return Object.fromEntries(
    REGIONES.map(({ id }) => [id, { k: id === zona ? 1 : 0, dolor: tinte[id].dolor }]),
  ) as TinteDelCuerpo
}

/** El tinte que llega al visor: el enfocado si hay una zona abierta, y el de siempre si no. */
export function tinteDeLaVista(zona: IdDeRegion | null, tinte: TinteDelCuerpo): TinteDelCuerpo {
  return zona ? tinteEnfocado(tinte, zona) : tinte
}
