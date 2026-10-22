import { noAfirmable, type Cifra } from './contrato'
import { GRAVEDAD, VERSION_DEL_MODELO } from './convenciones'
import { BANDA_SIN_DISPERSION, fuentesDeLeva, geometriaSagital, type MasaPuntual, type PoseSagital } from './dinamica'
import { DE_LEVA, DE_LEVA_CERV } from './deleva'
import { momentoDeInercia, rangoDeRadio, type SegmentoConInercia } from './inercia'
import { construirSujeto, type EntradaDelSujeto, type Sujeto } from './sujeto'

/**
 * EL TÉRMINO INERCIAL DE LA SENTADILLA (R-1): dinámica inversa sagital con aceleraciones.
 *
 * Mismo plano, mismos segmentos y mismos signos que `dinamica.ts` (momento positivo = el que hacen los músculos
 * extensores de cadera y rodilla y el flexor plantar), pero con los ángulos de la pose en el TIEMPO. Tomando
 * momentos de todo lo que está por encima de la articulación J respecto de J, con la reacción en J fuera de la
 * ecuación (brazo cero) y aceleraciones ABSOLUTAS de cada centro de masas (ccw = giro de +z hacia +y):
 *
 *     M_J = Σ m·[(z − z_J)·(g + a_y) − (y − y_J)·a_z] + Σ I·α          (cadera y tobillo)
 *     rodilla = −M_J                                                    (convención de `dinamica.ts`)
 *
 * donde `g·Σ m·(z − z_J)` es el término estático que ya calcula `dinamica.ts`, y el resto es el INERCIAL:
 *   · traslacional  Σ m·[(z − z_J)·a_y − (y − y_J)·a_z]   — con las masas y centros de masa transcritos de de Leva;
 *   · rotacional    Σ I·α, con α = −θ'' (el ángulo θ se mide desde la vertical hacia +z, que gira al revés) y
 *     I = m·(radio·largo)² respecto del centro de masas del segmento (`inercia.ts`: radios de fuente secundaria).
 *
 * Aceleraciones: derivada segunda por diferencias finitas de 3 puntos sobre los instantes dados (rejilla no
 * uniforme, exacta para parábolas). Los cuadros primero y último no tienen vecino a ambos lados: `no_afirmable`
 * (no se extrapola). Los instantes los pone quien llama (por ejemplo, del vídeo): la cámara fija su base de tiempos.
 *
 * SUPUESTOS declarados (cada uno en `supuestos` de la cifra):
 *  1. El tobillo está fijo en el suelo (pie plano, es el origen); lo que no es verdad al despegar el talón.
 *  2. Los ángulos de entrada se toman sin ruido. La segunda derivada AMPLIFICA el ruido: con la serie de la IK
 *     la banda del ruido hay que propagarla aparte (Monte Carlo); esta banda solo recoge la incertidumbre de los
 *     radios de giro.
 *  3. Los brazos y la barra son masas puntuales sin inercia propia, ligadas al tronco en `barraT`.
 *  4. La escala métrica sale de la TALLA (largos de de Leva escalados), no del vídeo; del vídeo solo entran ángulos
 *     (que no dependen de la escala) y tiempos.
 *  5. Piernas y brazos se mueven juntos (simetría), las masas de los pares ya van contadas dobles.
 *
 * `estimado` solo con la FUENTE DE LOS ÁNGULOS declarada (cadena no vacía): sin ella, `no_afirmable`.
 */

export interface InstanteDePose {
  /** Segundos. Estrictamente creciente en la serie. */
  t: number
  pose: PoseSagital
}

export interface EntradaDeSerie extends EntradaDelSujeto {
  cargaKg: number | null | undefined
  instantes: readonly InstanteDePose[] | null | undefined
  /** De dónde salen los ángulos y los tiempos (p. ej. «video:ik@dos-celulares»). Vacía → no_afirmable. */
  fuenteDeAngulos: string | null | undefined
}

export interface CuerpoEnMovimiento {
  kg: number
  z: number
  y: number
  /** Aceleración absoluta del centro de masas, m/s². */
  az: number
  ay: number
  /** Momento de inercia respecto del centro de masas (kg·m²) y aceleración angular ccw (rad/s²). Opcionales. */
  inercia?: number
  alfa?: number
}

/**
 * Momento ccw de todo `cuerpos` respecto de `j`. Con `g = 0` es solo el inercial; con `g = GRAVEDAD`, el total.
 * Caída libre (a_y = −g, α = 0): da 0 para cualquier posición.
 */
export function momentoNetoSobre(cuerpos: readonly CuerpoEnMovimiento[], j: { z: number; y: number }, g: number = GRAVEDAD): number {
  let m = 0
  for (const c of cuerpos) {
    m += c.kg * ((c.z - j.z) * (g + c.ay) - (c.y - j.y) * c.az)
    if (c.inercia !== undefined && c.alfa !== undefined) m += c.inercia * c.alfa
  }
  return m
}

/** Derivada segunda en el punto medio de tres muestras con rejilla no uniforme (exacta para parábolas). */
export function derivadaSegunda(t0: number, f0: number, t1: number, f1: number, t2: number, f2: number): number {
  const h1 = t1 - t0
  const h2 = t2 - t1
  return (2 * (h1 * f2 - (h1 + h2) * f1 + h2 * f0)) / (h1 * h2 * (h1 + h2))
}

export type Articulacion = 'tobillo' | 'rodilla' | 'cadera'

export interface MomentoDinamico {
  traslacional: Cifra
  rotacional: Cifra
  /** traslacional + rotacional. */
  inercial: Cifra
  /** estático + inercial. */
  total: Cifra
}

export interface MarcoDinamico {
  indice: number
  t: number
  tobillo: MomentoDinamico
  rodilla: MomentoDinamico
  cadera: MomentoDinamico
}

export interface ResultadoDeSerie {
  /** Motivo por el que NADA se pudo calcular (entrada inválida); null si se intentó. */
  motivo: string | null
  marcos: MarcoDinamico[]
}

const finito = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const ANGULOS = ['tibia', 'muslo', 'tronco', 'cabeza', 'barraT', 'pieZ'] as const

const SUPUESTOS = [
  'tobillo fijo en el suelo (pie plano)',
  'ángulos de entrada sin ruido: la segunda derivada amplifica el ruido, se propaga aparte',
  'brazos y barra: masas puntuales sin inercia propia, ligadas al tronco',
  'escala métrica por la talla (largos de de Leva), del vídeo solo ángulos y tiempos',
  'derivada segunda por diferencias finitas de 3 puntos; sin vecino a ambos lados no se calcula',
  'radios de giro de fuente secundaria sin cotejar con el artículo, como rango (inercia.ts)',
]

type Nombre = 'tibia' | 'muslo' | 'tronco' | 'cabeza' | 'brazos' | 'barra'
const SOBRE: Record<Articulacion, readonly Nombre[]> = {
  tobillo: ['tibia', 'muslo', 'tronco', 'cabeza', 'brazos', 'barra'],
  rodilla: ['muslo', 'tronco', 'cabeza', 'brazos', 'barra'],
  cadera: ['tronco', 'cabeza', 'brazos', 'barra'],
}
const ID = (parte: string, a: Articulacion) => `sentadilla.momento.inercial.${parte}.${a}`

function momentoNoAfirmable(a: Articulacion, motivo: string): MomentoDinamico {
  const v = VERSION_DEL_MODELO
  return {
    traslacional: noAfirmable(ID('traslacional', a), 'N·m', motivo, v),
    rotacional: noAfirmable(ID('rotacional', a), 'N·m', motivo, v),
    inercial: noAfirmable(ID('total', a), 'N·m', motivo, v),
    total: noAfirmable(`sentadilla.momento.dinamico.${a}`, 'N·m', motivo, v),
  }
}

function marcoNoAfirmable(indice: number, t: number, motivo: string): MarcoDinamico {
  return {
    indice,
    t,
    tobillo: momentoNoAfirmable('tobillo', motivo),
    rodilla: momentoNoAfirmable('rodilla', motivo),
    cadera: momentoNoAfirmable('cadera', motivo),
  }
}

interface Datos {
  sujeto: Sujeto
  masas: Map<Nombre, MasaPuntual>[]
  articulaciones: Record<Articulacion, { z: number; y: number }>[]
}

function largoDe(s: Sujeto, seg: SegmentoConInercia): number {
  if (seg === 'tibia') return s.segmentos.tibia.largoM
  if (seg === 'muslo') return s.segmentos.muslo.largoM
  const escala = s.talla / DE_LEVA[s.sexo].estaturaDeReferencia
  return DE_LEVA_CERV[s.sexo][seg].largo * escala
}

/** Marco `k` (con vecinos k−1 y k+1) para una articulación: cuerpos con sus aceleraciones. */
function cuerpos(
  d: Datos,
  instantes: readonly InstanteDePose[],
  k: number,
  a: Articulacion,
  radio: 'min' | 'max' | 'ninguno',
): CuerpoEnMovimiento[] {
  const [i0, i1, i2] = [k - 1, k, k + 1]
  const t = (i: number) => instantes[i].t
  return SOBRE[a].map((nombre) => {
    const m = (i: number) => d.masas[i].get(nombre)!
    const az = derivadaSegunda(t(i0), m(i0).z, t(i1), m(i1).z, t(i2), m(i2).z)
    const ay = derivadaSegunda(t(i0), m(i0).y, t(i1), m(i1).y, t(i2), m(i2).y)
    const c: CuerpoEnMovimiento = { kg: m(i1).kg, z: m(i1).z, y: m(i1).y, az, ay }
    if (radio !== 'ninguno' && (nombre === 'tibia' || nombre === 'muslo' || nombre === 'tronco' || nombre === 'cabeza')) {
      const r = rangoDeRadio(d.sujeto.sexo, nombre)
      const th = (i: number) => instantes[i].pose[nombre]
      c.inercia = momentoDeInercia(radio === 'min' ? r.min : r.max, c.kg, largoDe(d.sujeto, nombre))
      c.alfa = -derivadaSegunda(t(i0), th(i0), t(i1), th(i1), t(i2), th(i2))
    }
    return c
  })
}

/** El redondeo de la suma no puede sacar el valor de su banda: se ensancha a lo justo. */
function cifra(id: string, valor: number, inf: number, sup: number, fuente: string[], nivel: string, v: string): Cifra {
  return { id, valor, unidad: 'N·m', estado: 'estimado', fuente, supuestos: SUPUESTOS, banda: { inf: Math.min(inf, valor), sup: Math.max(sup, valor), nivel }, version: v }
}

function momentoDe(d: Datos, instantes: readonly InstanteDePose[], k: number, a: Articulacion, fuente: string[]): MomentoDinamico {
  const v = VERSION_DEL_MODELO
  const signo = a === 'rodilla' ? -1 : 1
  const j = d.articulaciones[k][a]
  const traslacional = signo * momentoNetoSobre(cuerpos(d, instantes, k, a, 'ninguno'), j, 0)
  const conMin = momentoNetoSobre(cuerpos(d, instantes, k, a, 'min'), j, 0)
  const conMax = momentoNetoSobre(cuerpos(d, instantes, k, a, 'max'), j, 0)
  const rotMin = signo * (conMin - momentoNetoSobre(cuerpos(d, instantes, k, a, 'ninguno'), j, 0))
  const rotMax = signo * (conMax - momentoNetoSobre(cuerpos(d, instantes, k, a, 'ninguno'), j, 0))
  const [rLo, rHi] = rotMin <= rotMax ? [rotMin, rotMax] : [rotMax, rotMin]
  const rot = (rLo + rHi) / 2
  const estatico = signo * momentoNetoSobre(cuerpos(d, instantes, k, a, 'ninguno').map((c) => ({ ...c, az: 0, ay: 0 })), j, GRAVEDAD)
  const radios = SOBRE[a]
    .filter((n): n is SegmentoConInercia => n === 'tibia' || n === 'muslo' || n === 'tronco' || n === 'cabeza')
    .map((n) => `inercia.radio.${d.sujeto.sexo}.${n}.${rangoDeRadio(d.sujeto.sexo, n).origen}`)
  const fuenteRot = [...fuente, ...radios]
  const nivelRot = 'rango entre los radios «sagital» y «transverso» (o cota geométrica); no es un intervalo de confianza'
  const inercial = traslacional + rot
  return {
    traslacional: cifra(ID('traslacional', a), traslacional, traslacional, traslacional, fuente, BANDA_SIN_DISPERSION, v),
    rotacional: cifra(ID('rotacional', a), rot, rLo, rHi, fuenteRot, nivelRot, v),
    inercial: cifra(ID('total', a), inercial, traslacional + rLo, traslacional + rHi, fuenteRot, nivelRot, v),
    total: cifra(`sentadilla.momento.dinamico.${a}`, estatico + inercial, estatico + traslacional + rLo, estatico + traslacional + rHi, fuenteRot, nivelRot, v),
  }
}

/**
 * La serie de momentos con su término inercial. Un marco por cada instante de entrada; los extremos y todo marco
 * cuya entrada no sirve salen `no_afirmable` con el motivo.
 */
export function momentosDeSentadillaEnElTiempo(e: EntradaDeSerie): ResultadoDeSerie {
  const todos = (motivo: string): ResultadoDeSerie => ({
    motivo,
    marcos: (e.instantes ?? []).map((x, i) => marcoNoAfirmable(i, finito(x?.t) ? x.t : Number.NaN, motivo)),
  })
  const sujeto = construirSujeto(e)
  if (!sujeto) return todos('talla, masa o sexo ausentes o fuera de rango')
  if (!finito(e.cargaKg) || e.cargaKg < 0) return todos('carga ausente o negativa')
  if (typeof e.fuenteDeAngulos !== 'string' || e.fuenteDeAngulos.trim() === '') {
    return todos('la fuente de los ángulos no está declarada: sin ella el término inercial no se afirma')
  }
  const ins = e.instantes
  if (!ins || ins.length < 3) return todos('hacen falta al menos 3 instantes para una aceleración')
  for (let i = 0; i < ins.length; i++) {
    if (!finito(ins[i]?.t) || (i > 0 && !(ins[i].t > ins[i - 1].t))) return todos('los instantes deben ser finitos y estrictamente crecientes')
    const p = ins[i].pose
    if (!p || !ANGULOS.every((k) => finito(p[k]))) return todos('algún ángulo de la pose o la posición de la barra falta')
  }
  const geom = ins.map((x) => geometriaSagital(sujeto, e.cargaKg as number, x.pose))
  const d: Datos = {
    sujeto,
    masas: geom.map((g) => new Map<Nombre, MasaPuntual>(g.porEncimaDelTobillo.map((m) => [m.nombre as Nombre, m]))),
    articulaciones: geom.map((g) => ({ tobillo: g.tobillo, rodilla: g.rodilla, cadera: g.cadera })),
  }
  const fuente = [...fuentesDeLeva(sujeto.sexo), `angulos:${e.fuenteDeAngulos.trim()}`]
  const marcos = ins.map((x, k): MarcoDinamico => {
    if (k === 0 || k === ins.length - 1) {
      return marcoNoAfirmable(k, x.t, 'sin vecino a ambos lados: la aceleración no se extrapola')
    }
    return {
      indice: k,
      t: x.t,
      tobillo: momentoDe(d, ins, k, 'tobillo', fuente),
      rodilla: momentoDe(d, ins, k, 'rodilla', fuente),
      cadera: momentoDe(d, ins, k, 'cadera', fuente),
    }
  })
  return { motivo: null, marcos }
}
