import { noAfirmable, type Cifra } from './contrato'
import { GRAVEDAD, VERSION_DEL_MODELO } from './convenciones'
import { DE_LEVA, DE_LEVA_CERV, type ParametrosDeSegmento } from './deleva'
import { construirSujeto, type EntradaDelSujeto, type Sujeto } from './sujeto'

/**
 * DINÁMICA ESTÁTICA DE LA SENTADILLA CON BARRA (M4, fase 2).
 *
 * Plano: SAGITAL (z hacia donde mira el sujeto, y hacia arriba), un solo lado: la sentadilla es
 * simétrica y el momento es el del cuerpo entero, así que las masas de los pares se cuentan
 * enteras y el resultado es el momento TOTAL de las dos piernas (no el de una).
 *
 * Cadena: tobillo (origen) → rodilla → cadera → cervical → vértex, con los segmentos de de Leva
 * (extremos alternativos de la Tabla 4: tibia KJC-AJC, tronco CERV-MIDH, cabeza VERT-CERV). Cada
 * segmento se da por su ángulo respecto a la VERTICAL, medido sobre la dirección del extremo
 * distal al proximal y positivo hacia +z: la tibia en una sentadilla va inclinada hacia
 * adelante (> 0), el muslo en paralelo apunta de la rodilla hacia atrás y arriba (< 0), el tronco
 * se inclina hacia adelante (> 0). Los ángulos salen del vídeo y no dependen de su escala.
 *
 * Signo (derivado a mano en `dinamica.test.ts`): positivo es el momento que hacen los MÚSCULOS
 * para sostener la carga —extensor de cadera, extensor de rodilla, flexor plantar de tobillo—.
 *   tobillo = Σ W·(z − z_tobillo)   sobre todo lo que está por encima
 *   cadera  = Σ W·(z − z_cadera)    sobre todo lo que está por encima
 *   rodilla = Σ W·(z_rodilla − z)   sobre todo lo que está por encima
 *
 * SUPUESTOS declarados, cada uno con su efecto:
 *  1. Estático: sin aceleración. El término inercial NO se calcula (R-1: la aceleración no tiene
 *     fuente sin escala del vídeo): se devuelve `no_afirmable`, no 0.
 *  2. La barra va sobre el tronco, a `barraT` (fracción del largo del tronco medida desde el
 *     cervical hacia la cadera). El dato lo da el llamador; aquí no se inventa.
 *  3. Los brazos (brazo + antebrazo + mano, los dos lados) se colocan en el punto de la barra:
 *     en una sentadilla la barra va sobre los hombros y las manos la agarran cerca de ellos.
 *     Es una aproximación de unos 10 % de la masa; no hay ángulos de codo ni de hombro en el
 *     vídeo que la sustituyan.
 *  4. El pie pesa en `pieZ` metros delante del tobillo (positivo adelante); solo afecta al
 *     centro de presión del cálculo de abajo arriba, no a los momentos de arriba abajo.
 *  5. La carga son `cargaKg` kilos de masa en el punto de la barra (peso = masa·g).
 */

export interface PoseSagital {
  /** Ángulos desde la vertical, en radianes, positivos hacia +z (ver arriba). */
  tibia: number
  muslo: number
  tronco: number
  cabeza: number
  /** Fracción del largo del tronco, desde el cervical, a la que va la barra. */
  barraT: number
  /** Distancia del centro de masas del pie al tobillo, en metros, positiva hacia adelante. */
  pieZ: number
}

export interface EntradaDeSentadilla extends EntradaDelSujeto {
  cargaKg: number | null | undefined
  pose: PoseSagital | null | undefined
}

/** Una masa puntual: nombre, masa en kg y posición en el plano (m). */
export interface MasaPuntual {
  nombre: string
  kg: number
  z: number
  y: number
}

export interface Geometria {
  tobillo: { z: number; y: number }
  rodilla: { z: number; y: number }
  cadera: { z: number; y: number }
  /** Todo lo que pesa por encima de cada articulación, y el pie aparte. */
  porEncimaDeLaRodilla: MasaPuntual[]
  porEncimaDeLaCadera: MasaPuntual[]
  porEncimaDelTobillo: MasaPuntual[]
  pie: MasaPuntual
}

const finito = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/** Resuelve la cadena. Pura y sin dependencia de la dinámica: la reutilizan las pruebas y el cruce. */
export function geometriaSagital(
  s: Sujeto,
  cargaKg: number,
  p: PoseSagital,
  cerv: Readonly<Record<'cabeza' | 'tronco', ParametrosDeSegmento>> = DE_LEVA_CERV[s.sexo],
): Geometria {
  const tabla = DE_LEVA[s.sexo]
  const escala = s.talla / tabla.estaturaDeReferencia
  const dir = (a: number) => ({ z: Math.sin(a), y: Math.cos(a) })

  const largoTibia = s.segmentos.tibia.largoM
  const largoMuslo = s.segmentos.muslo.largoM
  const largoTronco = cerv.tronco.largo * escala
  const largoCabeza = cerv.cabeza.largo * escala

  const tobillo = { z: 0, y: 0 }
  const uT = dir(p.tibia)
  const rodilla = { z: tobillo.z + largoTibia * uT.z, y: tobillo.y + largoTibia * uT.y }
  const uM = dir(p.muslo)
  const cadera = { z: rodilla.z + largoMuslo * uM.z, y: rodilla.y + largoMuslo * uM.y }
  const uK = dir(p.tronco)
  const cervical = { z: cadera.z + largoTronco * uK.z, y: cadera.y + largoTronco * uK.y }
  const uC = dir(p.cabeza)

  // El CM está a `cm` del largo medido DESDE el extremo proximal, hacia el distal.
  const desdeElProximal = (prox: { z: number; y: number }, u: { z: number; y: number }, cm: number, largo: number) => ({
    z: prox.z - cm * largo * u.z,
    y: prox.y - cm * largo * u.y,
  })
  const kg = (fraccion: number) => fraccion * s.masa

  const tibia: MasaPuntual = {
    nombre: 'tibia',
    kg: 2 * s.segmentos.tibia.masaKg,
    ...desdeElProximal(rodilla, uT, s.segmentos.tibia.cm, largoTibia),
  }
  const muslo: MasaPuntual = {
    nombre: 'muslo',
    kg: 2 * s.segmentos.muslo.masaKg,
    ...desdeElProximal(cadera, uM, s.segmentos.muslo.cm, largoMuslo),
  }
  const tronco: MasaPuntual = {
    nombre: 'tronco',
    kg: kg(cerv.tronco.masa),
    ...desdeElProximal(cervical, uK, cerv.tronco.cm, largoTronco),
  }
  // La cabeza mide desde el vértex hacia el cervical: su proximal es el vértex.
  const vertex = { z: cervical.z + largoCabeza * uC.z, y: cervical.y + largoCabeza * uC.y }
  const cabeza: MasaPuntual = {
    nombre: 'cabeza',
    kg: kg(cerv.cabeza.masa),
    ...desdeElProximal(vertex, uC, cerv.cabeza.cm, largoCabeza),
  }
  const puntoBarra = desdeElProximal(cervical, uK, p.barraT, largoTronco)
  const m = s.segmentos
  const brazos: MasaPuntual = {
    nombre: 'brazos',
    kg: 2 * (m.brazo.masaKg + m.antebrazo.masaKg + m.mano.masaKg),
    ...puntoBarra,
  }
  const barra: MasaPuntual = { nombre: 'barra', kg: cargaKg, ...puntoBarra }
  const pie: MasaPuntual = { nombre: 'pie', kg: 2 * m.pie.masaKg, z: tobillo.z + p.pieZ, y: tobillo.y }

  const sobreLaCadera = [tronco, cabeza, brazos, barra]
  const sobreLaRodilla = [muslo, ...sobreLaCadera]
  return {
    tobillo,
    rodilla,
    cadera,
    porEncimaDeLaCadera: sobreLaCadera,
    porEncimaDeLaRodilla: sobreLaRodilla,
    porEncimaDelTobillo: [tibia, ...sobreLaRodilla],
    pie,
  }
}

export interface MomentosEstaticos {
  tobillo: number
  rodilla: number
  cadera: number
}

/** Los tres momentos, en N·m, de arriba abajo. Es el cálculo que se cruza con los otros dos. */
export function momentosEstaticos(g: Geometria): MomentosEstaticos {
  const suma = (masas: MasaPuntual[], f: (z: number) => number) =>
    masas.reduce((t, x) => t + GRAVEDAD * x.kg * f(x.z), 0)
  return {
    tobillo: suma(g.porEncimaDelTobillo, (z) => z - g.tobillo.z),
    rodilla: suma(g.porEncimaDeLaRodilla, (z) => g.rodilla.z - z),
    cadera: suma(g.porEncimaDeLaCadera, (z) => z - g.cadera.z),
  }
}

export interface ResultadoDeSentadilla {
  tobillo: Cifra
  rodilla: Cifra
  cadera: Cifra
  inercial: Cifra
}

/** Los ids de `registro.ts` de las constantes de de Leva que usa la cadena sagital (la fuente de cada cifra). */
export function fuentesDeLeva(sexo: 'h' | 'm'): string[] {
  const s = sexo
  return [
    'convenciones.gravedad',
    `deleva96.${s}.estatura_ref`,
    ...(['muslo', 'tibia', 'pie', 'brazo', 'antebrazo', 'mano'] as const).flatMap((n) => [
      `deleva96.${s}.${n}.masa`,
      `deleva96.${s}.${n}.cm`,
      `deleva96.${s}.${n}.largo`,
    ]),
    ...(['cabeza', 'tronco'] as const).flatMap((n) => [
      `deleva96.cerv.${s}.${n}.masa`,
      `deleva96.cerv.${s}.${n}.cm`,
      `deleva96.cerv.${s}.${n}.largo`,
    ]),
  ]
}

/** El texto de la banda de ancho cero: no es un intervalo de confianza, es la ausencia de dispersión. */
export const BANDA_SIN_DISPERSION = 'ancho cero: tabla poblacional tomada como exacta, sin dispersión (ver bandas.ts)'

const SUPUESTOS = [
  'estático: sin aceleración (el término inercial no se calcula)',
  'plano sagital, momento total de las dos piernas',
  'brazos concentrados en el punto de la barra',
  'proporciones poblacionales de de Leva 1996 escaladas a la talla y la masa',
]

/**
 * Con todo lo necesario, tres cifras `estimado` con su fuente; sin algo, cuatro `no_afirmable`.
 *
 * Son `estimado` y no `calculado` (convenciones.ts) porque las masas y los centros de masa salen de
 * una TABLA POBLACIONAL (de Leva 1996) escalada a la talla: el número es exacto sobre esa tabla, pero
 * para una persona concreta es una estimación. Como este módulo no conoce la dispersión, la banda va
 * con ancho cero y lo dice en `nivel`; la dispersión real la pone `bandas.ts` con el Monte Carlo.
 */
export function momentosDeSentadilla(e: EntradaDeSentadilla): ResultadoDeSentadilla {
  const v = VERSION_DEL_MODELO
  const inercial = noAfirmable(
    'sentadilla.momento.inercial',
    'N·m',
    'la aceleración no tiene fuente sin la escala del vídeo (R-1): no se calcula, no se pone 0',
    v,
  )
  const faltan = (motivo: string): ResultadoDeSentadilla => ({
    tobillo: noAfirmable('sentadilla.momento.tobillo', 'N·m', motivo, v),
    rodilla: noAfirmable('sentadilla.momento.rodilla', 'N·m', motivo, v),
    cadera: noAfirmable('sentadilla.momento.cadera', 'N·m', motivo, v),
    inercial,
  })
  const sujeto = construirSujeto(e)
  if (!sujeto) return faltan('talla, masa o sexo ausentes o fuera de rango')
  if (!finito(e.cargaKg) || e.cargaKg < 0) return faltan('carga ausente o negativa')
  const p = e.pose
  if (!p || ![p.tibia, p.muslo, p.tronco, p.cabeza, p.barraT, p.pieZ].every(finito)) {
    return faltan('algún ángulo de la pose o la posición de la barra falta')
  }
  const mom = momentosEstaticos(geometriaSagital(sujeto, e.cargaKg, p))
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
    tobillo: cifra('sentadilla.momento.tobillo', mom.tobillo),
    rodilla: cifra('sentadilla.momento.rodilla', mom.rodilla),
    cadera: cifra('sentadilla.momento.cadera', mom.cadera),
    inercial,
  }
}
