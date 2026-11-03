import { noAfirmable, type Cifra } from './contrato'
import { VERSION_DEL_MODELO } from './convenciones'
import { DE_LEVA, DE_LEVA_CERV } from './deleva'
import {
  BANDA_SIN_DISPERSION,
  fuentesDeLeva,
  geometriaSagital,
  momentosEstaticos,
  type Geometria,
  type MasaPuntual,
} from './dinamica'
import { momentosEnElTiempo, type EntradaDeSerie, type PoseBase, type ResultadoDeSerie, type VarianteDeEjercicio } from './inercial'
import { construirSujeto, type EntradaDelSujeto, type Sujeto } from './sujeto'

/**
 * PESO MUERTO CON BARRA: dinámica estática e inercial en el plano sagital, con la misma cadena que la sentadilla (tobillo → rodilla → cadera →
 * cervical → vértex, segmentos de de Leva, ángulos desde la vertical positivos hacia +z) y los mismos signos (positivo = lo que hacen los músculos:
 * extensor de cadera y de rodilla, flexor plantar).
 *
 * LO QUE CAMBIA RESPECTO DE LA SENTADILLA es dónde va la carga: la barra NO está sobre los hombros sino en las MANOS, colgando de los brazos
 * estirados. Cada brazo es una recta desde el hombro hasta la mano, a `pose.brazo` radianes de la vertical (+ hacia +z; 0 = vertical, que es la
 * del peso muerto con la barra pegada al cuerpo). Los segmentos del brazo (brazo, antebrazo, mano) van colocados sobre esa recta con sus
 * propios centros de masa de de Leva, y la barra va en el centro de masas de la mano (el agarre).
 *
 * SUPUESTOS, cada uno con su efecto:
 *  1. El centro del hombro se toma en el punto CERVICAL de la cadena (el extremo craneal del tronco de de Leva, CERV-MIDH). El hombro real está unos
 *     centímetros más abajo y adelante: cada centímetro que la barra se corre en horizontal mueve el momento de cadera `carga · g · 0,01 m`
 *     (≈ 10 N·m con 100 kg). NO está medido: es `convencion_propuesta`.
 *  2. Brazos estirados y rígidos (sin codo flexionado ni hombro libre): la recta del brazo es una sola; en la serie en el tiempo los brazos y la barra
 *     son masas puntuales sin inercia propia, ligadas al hombro.
 *  3. Los dos brazos se cuentan como un solo punto con la suma de las masas, en su centro de masas común (plano sagital, simetría).
 *  4. Plano sagital, momento TOTAL de las dos piernas; piernas y pies como en la sentadilla (pie plano, tobillo fijo en el suelo).
 */

export interface PoseDePesoMuerto extends PoseBase {
  /** Ángulo de la recta hombro-mano desde la vertical hacia abajo, en radianes, + hacia +z (la mano adelante del hombro). 0 = brazos verticales. */
  brazo: number
  /** Distancia del centro de masas del pie al tobillo, en metros, positiva hacia adelante (solo afecta al cálculo de abajo arriba). */
  pieZ: number
}

export interface EntradaDePesoMuerto extends EntradaDelSujeto {
  cargaKg: number | null | undefined
  pose: PoseDePesoMuerto | null | undefined
}

const finito = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/** Punto del hombro y del agarre de la barra, y la masa y el centro de masas de los dos brazos juntos. */
export interface PuntosDelBrazo {
  hombro: { z: number; y: number }
  agarre: { z: number; y: number }
  brazos: MasaPuntual
}

function largosDelTronco(s: Sujeto) {
  const escala = s.talla / DE_LEVA[s.sexo].estaturaDeReferencia
  return { tronco: DE_LEVA_CERV[s.sexo].tronco.largo * escala }
}

/** Dónde queda el hombro, el agarre y el centro de masas de los dos brazos para una pose. */
export function puntosDelBrazo(s: Sujeto, g: Geometria, pose: PoseDePesoMuerto): PuntosDelBrazo {
  const { tronco: Lk } = largosDelTronco(s)
  const hombro = { z: g.cadera.z + Lk * Math.sin(pose.tronco), y: g.cadera.y + Lk * Math.cos(pose.tronco) }
  const d = { z: Math.sin(pose.brazo), y: -Math.cos(pose.brazo) }
  const { brazo, antebrazo, mano } = s.segmentos
  const aLo = (dist: number) => ({ z: hombro.z + dist * d.z, y: hombro.y + dist * d.y })
  const cmBrazo = aLo(brazo.cm * brazo.largoM)
  const cmAnte = aLo(brazo.largoM + antebrazo.cm * antebrazo.largoM)
  const cmMano = aLo(brazo.largoM + antebrazo.largoM + mano.cm * mano.largoM)
  const masas = [2 * brazo.masaKg, 2 * antebrazo.masaKg, 2 * mano.masaKg]
  const puntos = [cmBrazo, cmAnte, cmMano]
  const total = masas[0]! + masas[1]! + masas[2]!
  const cm = {
    z: puntos.reduce((t, p, i) => t + p.z * masas[i]!, 0) / total,
    y: puntos.reduce((t, p, i) => t + p.y * masas[i]!, 0) / total,
  }
  return { hombro, agarre: cmMano, brazos: { nombre: 'brazos', kg: total, ...cm } }
}

/** La geometría de la cadena con los brazos colgando del hombro y la barra en la mano. Misma forma que la de la sentadilla (`Geometria`). */
export function geometriaDePesoMuerto(s: Sujeto, cargaKg: number, pose: PoseDePesoMuerto): Geometria {
  // la cadena (tibia, muslo, tronco, cabeza, pie) sale de la de la sentadilla; lo único propio son los brazos y la barra
  const base = geometriaSagital(s, 0, { ...pose, barraT: 0 })
  const { agarre, brazos } = puntosDelBrazo(s, base, pose)
  const barra: MasaPuntual = { nombre: 'barra', kg: cargaKg, z: agarre.z, y: agarre.y }
  const sinCarga = (lista: MasaPuntual[]) => lista.filter((m) => m.nombre !== 'brazos' && m.nombre !== 'barra')
  const sobreLaCadera = [...sinCarga(base.porEncimaDeLaCadera), brazos, barra]
  const muslo = base.porEncimaDeLaRodilla.find((m) => m.nombre === 'muslo')!
  const tibia = base.porEncimaDelTobillo.find((m) => m.nombre === 'tibia')!
  return {
    ...base,
    porEncimaDeLaCadera: sobreLaCadera,
    porEncimaDeLaRodilla: [muslo, ...sobreLaCadera],
    porEncimaDelTobillo: [tibia, muslo, ...sobreLaCadera],
  }
}

/**
 * Ángulo de la recta del brazo para que la barra quede en la vertical de `zObjetivo` (p. ej. el medio del pie), o `null` si no se puede: el
 * agarre solo llega a `±alcance` del hombro. Es la forma de poner la barra «sobre el medio del pie» sin inventar el ángulo.
 */
export function brazoParaBarraSobre(s: Sujeto, pose: Omit<PoseDePesoMuerto, 'brazo'>, zObjetivo: number): number | null {
  const base = geometriaSagital(s, 0, { ...pose, barraT: 0 })
  const sinBrazo = puntosDelBrazo(s, base, { ...pose, brazo: 0 })
  const alcance = Math.hypot(sinBrazo.agarre.z - sinBrazo.hombro.z, sinBrazo.agarre.y - sinBrazo.hombro.y)
  const seno = (zObjetivo - sinBrazo.hombro.z) / alcance
  return Math.abs(seno) <= 1 ? Math.asin(seno) : null
}

/**
 * POSE DE PARTIDA ILUSTRATIVA de un peso muerto convencional: tibia inclinada ~20° hacia adelante, muslo ~50° bajo la horizontal hacia atrás
 * (la cadera por encima de la rodilla y detrás de ella), tronco ~55° de la vertical, cabeza neutra, brazos verticales. Es una ILUSTRACIÓN para
 * mirar órdenes de magnitud: no es la técnica de nadie ni una norma; la pose real sale del vídeo. `convencion_propuesta`, sin fuente.
 */
export const POSE_DE_PARTIDA_ILUSTRATIVA: PoseDePesoMuerto = {
  tibia: 0.35,
  muslo: -1.4,
  tronco: 0.95,
  cabeza: 0.5,
  brazo: 0,
  pieZ: 0.05,
}

export interface ResultadoDePesoMuerto {
  tobillo: Cifra
  rodilla: Cifra
  cadera: Cifra
  inercial: Cifra
}

const SUPUESTOS = [
  'estático: sin aceleración (el término inercial sale de la serie en el tiempo)',
  'plano sagital, momento total de las dos piernas',
  'la barra cuelga de las manos con los brazos estirados; el centro del hombro se toma en el punto cervical',
  'proporciones poblacionales de de Leva 1996 escaladas a la talla y la masa',
]

/** Los tres momentos estáticos del peso muerto con su contrato; sin algo, cuatro `no_afirmable`. El término inercial va aparte (`momentosDePesoMuertoEnElTiempo`). */
export function momentosDePesoMuerto(e: EntradaDePesoMuerto): ResultadoDePesoMuerto {
  const v = VERSION_DEL_MODELO
  const inercial = noAfirmable('pesoMuerto.momento.inercial', 'N·m', 'estático: la aceleración sale de la serie en el tiempo, no de una pose', v)
  const faltan = (motivo: string): ResultadoDePesoMuerto => ({
    tobillo: noAfirmable('pesoMuerto.momento.tobillo', 'N·m', motivo, v),
    rodilla: noAfirmable('pesoMuerto.momento.rodilla', 'N·m', motivo, v),
    cadera: noAfirmable('pesoMuerto.momento.cadera', 'N·m', motivo, v),
    inercial,
  })
  const sujeto = construirSujeto(e)
  if (!sujeto) return faltan('talla, masa o sexo ausentes o fuera de rango')
  if (!finito(e.cargaKg) || e.cargaKg < 0) return faltan('carga ausente o negativa')
  const p = e.pose
  if (!p || ![p.tibia, p.muslo, p.tronco, p.cabeza, p.brazo, p.pieZ].every(finito)) return faltan('algún ángulo de la pose o del brazo falta')
  const mom = momentosEstaticos(geometriaDePesoMuerto(sujeto, e.cargaKg, p))
  const fuente = fuentesDeLeva(sujeto.sexo)
  const cifra = (id: string, valor: number): Cifra => ({
    id,
    valor,
    unidad: 'N·m',
    estado: 'estimado',
    fuente,
    supuestos: SUPUESTOS,
    banda: { inf: valor, sup: valor, nivel: BANDA_SIN_DISPERSION },
    version: v,
  })
  return {
    tobillo: cifra('pesoMuerto.momento.tobillo', mom.tobillo),
    rodilla: cifra('pesoMuerto.momento.rodilla', mom.rodilla),
    cadera: cifra('pesoMuerto.momento.cadera', mom.cadera),
    inercial,
  }
}

export const VARIANTE_PESO_MUERTO: VarianteDeEjercicio<PoseDePesoMuerto> = {
  prefijo: 'pesoMuerto',
  construir: geometriaDePesoMuerto,
  claves: ['tibia', 'muslo', 'tronco', 'cabeza', 'brazo', 'pieZ'],
  motivoDePose: 'algún ángulo de la pose o del brazo falta',
}

/** Serie de momentos del peso muerto con el término inercial (traslacional y rotacional), por articulación y cuadro. Misma mecánica y mismas reglas que la sentadilla. */
export function momentosDePesoMuertoEnElTiempo(e: EntradaDeSerie<PoseDePesoMuerto>): ResultadoDeSerie {
  return momentosEnElTiempo(e, VARIANTE_PESO_MUERTO)
}
