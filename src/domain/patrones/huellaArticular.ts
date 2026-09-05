import type { HuellaDeRepeticion } from './huella'

/**
 * DE UNA PISTA DE POSE A UNA HUELLA ARTICULAR.
 *
 * ## Qué entra
 *
 * El JSON que escribe `articulaciones.py` (Cerebro Alpha, `herramientas/encoder-camara`):
 * por fotograma, dónde están hombro, codo, muñeca, cadera, rodilla y tobillo de cada
 * lado, en píxeles de imagen y con su visibilidad. Entra TAL CUAL. Es la misma frontera
 * que `importarMedida.ts`: **se pasan datos, no código**. La detección de pose necesita
 * ONNX y un minuto de CPU por vídeo; lo que la app sabe hacer es leer lo que salió.
 *
 * ## Qué sale
 *
 * Una `HuellaDeRepeticion` con `articular`: la ÚLTIMA repetición de la pista, en 24
 * muestras a intervalos iguales, con los ángulos de rodilla, cadera, tronco, hombro y
 * codo en cada muestra, en los canales que `poseAEuler()` entiende. Con eso el fantasma
 * del salón puede posar el esqueleto con lo que la persona hizo.
 *
 * ## Cómo se leen los ángulos, y qué se asume
 *
 * La pista es una proyección sagital: una cámara de perfil. Todo ángulo aquí es en ese
 * plano, sin signo lateral, y por eso los canales salen sin sufijo de lado.
 *
 * - **Rodilla**: 180° menos el ángulo cadera–rodilla–tobillo. Extendida = 0.
 * - **Tronco**: la inclinación del segmento cadera→hombro respecto a la vertical de la
 *   imagen. Va repartida entre `lumbarFlex` (40 %) y `toraxFlex` (60 %), que es el reparto
 *   que el rig usa para flexionar la columna; la pista no distingue dónde se dobla.
 * - **Cadera**: en el rig la flexión de cadera se mide entre la pelvis (vertical) y el
 *   muslo, y el ángulo hombro–cadera–rodilla que se ve en la imagen es 180° menos la suma
 *   de esa flexión y la inclinación del tronco. De ahí: `cadera = 180 − ángulo − tronco`.
 * - **Hombro**: el ángulo cadera–hombro–codo. Brazo colgando = 0, al frente = 90.
 * - **Codo**: 180° menos el ángulo hombro–codo–muñeca.
 *
 * El tobillo NO se lee: `apoyarPies()` lo resuelve para que la planta quede en el suelo,
 * y una lectura de tobillo desde la imagen —el pie casi siempre está tapado— lo
 * despegaría.
 *
 * ## Cómo se encuentra la última repetición
 *
 * Con la vertical de la carga: las muñecas si se ven en la mayoría de los fotogramas
 * (la carga está en las manos), si no la cadera. Se buscan los pasos por arriba y por
 * abajo con dos umbrales al 30 % y al 70 % del recorrido —una histéresis, para que el
 * ruido del detector no fabrique repeticiones— y la repetición es de pico a pico: bajar y
 * subir, como la del encoder. Con una sola repetición o sin picos claros se toma la
 * pista entera, que es lo que hay.
 *
 * ## Lo que no promete
 *
 * Ni la profundidad fuera del plano ni la escala. Un fémur que apunta a la cámara sale
 * más corto y el ángulo que se lee es distinto del real: `coherencia.mjs` mide cuánto,
 * aquí no se corrige. Es una huella —un rastro de lo que se hizo—, no una medida.
 */

export type PuntoDePista = [x: number, y: number, visibilidad: number]

export interface FotogramaDePista {
  t: number
  /** `null` cuando el detector no vio a nadie en ese fotograma. */
  puntos: Record<string, PuntoDePista> | null
}

export interface PistaDePose {
  video?: string
  ancho: number
  alto: number
  fps?: number
  fotogramas: FotogramaDePista[]
}

/** Por debajo de esto el punto no se usa: es el corte que usa `coherencia.mjs`. */
const VISIBILIDAD_MINIMA = 0.5
/** Con menos fotogramas útiles no hay repetición que enseñar. */
const FOTOGRAMAS_MINIMOS = 6
/** Una «repetición» más corta que esto es ruido del detector. */
const DURACION_MINIMA_SEG = 0.4
const MUESTRAS = 24

/** ¿Tiene la forma de la salida de `articulaciones.py`? Mira lo que hace falta, no todo. */
export function esPistaDePose(v: unknown): v is PistaDePose {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
  const o = v as Record<string, unknown>
  if (!Array.isArray(o.fotogramas) || typeof o.ancho !== 'number' || typeof o.alto !== 'number') return false
  return o.fotogramas.every(
    (f) =>
      typeof f === 'object' &&
      f !== null &&
      typeof (f as FotogramaDePista).t === 'number' &&
      ((f as FotogramaDePista).puntos === null || typeof (f as FotogramaDePista).puntos === 'object'),
  )
}

type Lado = 'd' | 'i'
const LADOS: Lado[] = ['d', 'i']

interface AngulosDeFotograma {
  t: number
  rodillaFlex?: number
  caderaFlex?: number
  troncoIncl?: number
  hombroFlex?: number
  codoFlex?: number
  carga?: number
}

/** Un punto del fotograma, o `undefined` si no se ve lo bastante. */
function punto(f: FotogramaDePista, nombre: string): [number, number] | undefined {
  const p = f.puntos?.[nombre]
  if (!p || p.length < 3 || !(p[2] >= VISIBILIDAD_MINIMA)) return undefined
  if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) return undefined
  return [p[0], p[1]]
}

/** El ángulo en `b` entre `a` y `c`, en grados, de 0 a 180. */
function anguloEn(a: [number, number], b: [number, number], c: [number, number]): number {
  const ux = a[0] - b[0]
  const uy = a[1] - b[1]
  const vx = c[0] - b[0]
  const vy = c[1] - b[1]
  const nu = Math.hypot(ux, uy)
  const nv = Math.hypot(vx, vy)
  if (nu < 1e-6 || nv < 1e-6) return NaN
  const cos = Math.min(1, Math.max(-1, (ux * vx + uy * vy) / (nu * nv)))
  return (Math.acos(cos) * 180) / Math.PI
}

/** Inclinación del segmento `desde→hacia` respecto a la vertical de la imagen (arriba es −y). */
function inclinacion(desde: [number, number], hacia: [number, number]): number {
  const dx = hacia[0] - desde[0]
  const dy = hacia[1] - desde[1]
  const n = Math.hypot(dx, dy)
  if (n < 1e-6) return NaN
  const cos = Math.min(1, Math.max(-1, -dy / n))
  return (Math.acos(cos) * 180) / Math.PI
}

const media = (valores: number[]): number | undefined => {
  const buenos = valores.filter((v) => Number.isFinite(v))
  if (!buenos.length) return undefined
  return buenos.reduce((s, v) => s + v, 0) / buenos.length
}

/** Los ángulos de un fotograma, promediando los lados que se ven. */
function angulosDe(f: FotogramaDePista, cargaEnManos: boolean): AngulosDeFotograma {
  const rodilla: number[] = []
  const cadera: number[] = []
  const tronco: number[] = []
  const hombro: number[] = []
  const codo: number[] = []
  const carga: number[] = []
  for (const l of LADOS) {
    const h = punto(f, `hombro_${l}`)
    const c = punto(f, `codo_${l}`)
    const m = punto(f, `muneca_${l}`)
    const ca = punto(f, `cadera_${l}`)
    const r = punto(f, `rodilla_${l}`)
    const to = punto(f, `tobillo_${l}`)
    if (ca && r && to) rodilla.push(180 - anguloEn(ca, r, to))
    if (h && ca) {
      const incl = inclinacion(ca, h)
      tronco.push(incl)
      if (r) cadera.push(Math.max(0, 180 - anguloEn(h, ca, r) - incl))
    }
    if (h && c && ca) hombro.push(anguloEn(ca, h, c))
    if (h && c && m) codo.push(180 - anguloEn(h, c, m))
    const puntoDeCarga = cargaEnManos ? m : ca
    if (puntoDeCarga) carga.push(-puntoDeCarga[1])
  }
  return {
    t: f.t,
    rodillaFlex: media(rodilla),
    caderaFlex: media(cadera),
    troncoIncl: media(tronco),
    hombroFlex: media(hombro),
    codoFlex: media(codo),
    carga: media(carga),
  }
}

/** ¿Se ven las muñecas en la mayoría de los fotogramas con persona? Si no, la carga es la cadera. */
function cargaEnLasManos(fotogramas: FotogramaDePista[]): boolean {
  let conPersona = 0
  let conMuneca = 0
  for (const f of fotogramas) {
    if (!f.puntos) continue
    conPersona++
    if (punto(f, 'muneca_d') || punto(f, 'muneca_i')) conMuneca++
  }
  return conPersona > 0 && conMuneca / conPersona >= 0.6
}

/**
 * La última repetición de una serie vertical, de pico a pico.
 *
 * Histéresis con dos umbrales: se está «arriba» al pasar del 70 % del recorrido y
 * «abajo» al bajar del 30 %. Cada tramo arriba aporta su pico (el máximo del tramo); una
 * repetición son dos picos consecutivos con un «abajo» entre medias. Devuelve la ventana
 * de tiempo de la última, o la pista entera si no hay dos picos.
 */
export function ventanaDeUltimaRepeticion(t: number[], s: number[]): [number, number] | undefined {
  if (t.length < 2) return undefined
  let lo = Infinity
  let hi = -Infinity
  for (const v of s) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  if (!(hi > lo)) return undefined
  const arriba = lo + (hi - lo) * 0.7
  const abajo = lo + (hi - lo) * 0.3

  const picos: number[] = []
  let estado: 'arriba' | 'abajo' | 'medio' = 'medio'
  let picoT = -1
  let picoS = -Infinity
  for (let i = 0; i < t.length; i++) {
    const v = s[i]
    if (v >= arriba) {
      if (estado !== 'arriba') {
        estado = 'arriba'
        picoT = t[i]
        picoS = v
      } else if (v > picoS) {
        picoS = v
        picoT = t[i]
      }
    } else if (v <= abajo) {
      if (estado === 'arriba') picos.push(picoT)
      estado = 'abajo'
    }
  }
  if (estado === 'arriba') picos.push(picoT)

  if (picos.length >= 2) return [picos[picos.length - 2], picos[picos.length - 1]]
  return [t[0], t[t.length - 1]]
}

/** Interpola `s` en `tk`, acotando en los extremos. `t` creciente. */
function enTiempo(t: number[], s: number[], tk: number): number {
  if (tk <= t[0]) return s[0]
  const ultimo = t.length - 1
  if (tk >= t[ultimo]) return s[ultimo]
  let i = 0
  while (i < ultimo && t[i + 1] < tk) i++
  const a = t[i]
  const b = t[i + 1]
  const k = b > a ? (tk - a) / (b - a) : 0
  return s[i] + (s[i + 1] - s[i]) * k
}

/** Remuestrea un canal (con huecos) a `n` puntos entre `t0` y `t1`. */
function remuestrear(muestras: AngulosDeFotograma[], leer: (a: AngulosDeFotograma) => number | undefined, t0: number, t1: number, n: number): number[] | undefined {
  const t: number[] = []
  const v: number[] = []
  for (const m of muestras) {
    const x = leer(m)
    if (x === undefined || !Number.isFinite(x)) continue
    t.push(m.t)
    v.push(x)
  }
  if (t.length < 2) return undefined
  const salida: number[] = []
  for (let k = 0; k < n; k++) salida.push(enTiempo(t, v, t0 + ((t1 - t0) * k) / (n - 1)))
  return salida
}

/**
 * La huella articular de la última repetición de una pista, o `undefined` si la pista no
 * da para una: sin rodilla ni cadera visibles no hay pose que enseñar.
 */
export function huellaDePista(pista: PistaDePose, muestras = MUESTRAS): HuellaDeRepeticion | undefined {
  const fotogramas = [...pista.fotogramas].filter((f) => Number.isFinite(f.t)).sort((a, b) => a.t - b.t)
  const enManos = cargaEnLasManos(fotogramas)
  const angulos = fotogramas.map((f) => angulosDe(f, enManos))

  const conCarga = angulos.filter((a) => a.carga !== undefined)
  const ventana = ventanaDeUltimaRepeticion(
    conCarga.map((a) => a.t),
    conCarga.map((a) => a.carga as number),
  )
  if (!ventana) return undefined
  const [t0, t1] = ventana
  const duracionSeg = t1 - t0
  if (!(duracionSeg >= DURACION_MINIMA_SEG)) return undefined

  const dentro = angulos.filter((a) => a.t >= t0 && a.t <= t1)
  const utiles = dentro.filter((a) => a.rodillaFlex !== undefined && a.caderaFlex !== undefined)
  if (utiles.length < FOTOGRAMAS_MINIMOS) return undefined

  const n = Math.max(2, Math.round(muestras))
  const carga = remuestrear(dentro, (a) => a.carga, t0, t1, n)
  const rodilla = remuestrear(dentro, (a) => a.rodillaFlex, t0, t1, n)
  const cadera = remuestrear(dentro, (a) => a.caderaFlex, t0, t1, n)
  const tronco = remuestrear(dentro, (a) => a.troncoIncl, t0, t1, n)
  if (!carga || !rodilla || !cadera || !tronco) return undefined

  let lo = Infinity
  let hi = -Infinity
  for (const v of carga) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  const fase = hi > lo ? carga.map((v) => (v - lo) / (hi - lo)) : carga.map(() => 1)

  const articular: Record<string, number[]> = {
    rodillaFlex: rodilla,
    caderaFlex: cadera,
    lumbarFlex: tronco.map((v) => v * 0.4),
    toraxFlex: tronco.map((v) => v * 0.6),
  }
  const hombro = remuestrear(dentro, (a) => a.hombroFlex, t0, t1, n)
  const codo = remuestrear(dentro, (a) => a.codoFlex, t0, t1, n)
  if (hombro) articular.hombroFlex = hombro
  if (codo) articular.codoFlex = codo

  return { duracionSeg, fase, articular }
}
