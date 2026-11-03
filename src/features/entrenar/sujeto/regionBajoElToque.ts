import { grados, M4, V, type Vec3 } from '../../../domain/patrones/algebra'
import type { Malla } from '../../../domain/patrones/malla'
import { atlasPorCapa, nombreDeParte } from '../visor/cargaDelAtlas'
import { REGIONES, regionDeMusculo, type IdDeRegion } from './regiones'

/**
 * QUÉ REGIÓN HAY BAJO EL DEDO (Bryan, 30-oct: tocar el músculo sobre el cuerpo 3D).
 *
 * El visor es un rasterizador WebGL propio y no tiene selección. En vez de dibujar los
 * músculos con un identificador y leer el píxel (otra pasada de dibujo, otro búfer, y un
 * `readPixels` que detiene la tarjeta), se resuelve AL TOCAR: con la misma cámara con la que
 * se dibuja se lanza un rayo desde el píxel y se busca el triángulo de músculo más cercano
 * al ojo. Cuesta una vez por toque y nada por cuadro.
 *
 * ## Lo que garantiza
 *
 * - **Las mismas regiones que `seriesPorRegion`.** El músculo se traduce con
 *   `regionDeMusculo`, la tabla de la que sale la cuenta. Un músculo sin región, o que la
 *   tabla no conoce, no elige nada: no se inventa una región para que el toque «haga algo».
 * - **De frente y de espalda, en piel, músculo y hueso.** Los músculos se dibujan en las tres
 *   capas (en la piel bajo una piel translúcida, en el hueso al 30 %), y el rayo usa la
 *   cámara que el salón ya conoce, que incluye «Dar la vuelta».
 *
 * ## Lo que NO hace, y queda escrito
 *
 * - **Con la capa de hueso, el esqueleto no tapa.** El rayo solo mira músculos: un hueso
 *   delante de un músculo no impide elegirlo (con los músculos al 30 % de opacidad, es lo que
 *   se ve: el músculo sigue ahí). No se elige un hueso: no tiene región.
 * - **No distingue «la porción» de un músculo**, solo su región, que es lo que cuenta la app.
 *
 * ## Por qué un solo triángulo cercano basta
 *
 * Los músculos del atlas son mallas cerradas: el primer triángulo que corta el rayo es la
 * cara visible. No hace falta mirar la orientación del triángulo.
 */

/** Cuánto puede moverse el dedo, en píxeles, para que siga siendo un toque. */
export const UMBRAL_DE_TOQUE_PX = 10
/** Cuánto puede durar, en milisegundos. Más es una pulsación larga (que es de «hundir»). */
export const DURACION_MAXIMA_DE_TOQUE_MS = 450

/**
 * ¿TOQUE O ARRASTRE? Un arrastre sigue girando el sujeto; un toque elige. El recorrido es el
 * euclídeo (en diagonal también cuenta) y el umbral es inclusivo.
 */
export function esUnToque(dx: number, dy: number, ms: number): boolean {
  return Math.hypot(dx, dy) <= UMBRAL_DE_TOQUE_PX && ms <= DURACION_MAXIMA_DE_TOQUE_MS
}

/** La cámara con la que el salón dibuja (la misma que avisa `alMirar`). Ángulos en grados, campo en radianes. */
export interface CamaraParaElToque {
  azimut: number
  elevacion: number
  distancia: number
  centro: readonly [number, number, number]
  campo: number
}

export interface RectDelLienzo {
  left: number
  top: number
  width: number
  height: number
}

/** El ojo, con la misma fórmula que `Orbita.ojo()`. */
export function ojoDeLaCamara(c: CamaraParaElToque): Vec3 {
  const a = grados(c.azimut)
  const e = grados(c.elevacion)
  return [
    c.centro[0] + Math.sin(a) * Math.cos(e) * c.distancia,
    c.centro[1] + Math.sin(e) * c.distancia,
    c.centro[2] + Math.cos(a) * Math.cos(e) * c.distancia,
  ]
}

export interface Rayo {
  origen: Vec3
  dir: Vec3
}

/**
 * EL RAYO QUE SALE DEL OJO POR UN PÍXEL, con la base de `M4.mirarDesde` y la proyección de
 * `M4.perspectiva` (las del motor): `rayoDeLaPantalla` es su inversa. `x` e `y` van en
 * coordenadas de cliente, como un `PointerEvent`.
 */
export function rayoDeLaPantalla(c: CamaraParaElToque, rect: RectDelLienzo, x: number, y: number): Rayo {
  const ojo = ojoDeLaCamara(c)
  const centro: Vec3 = [c.centro[0], c.centro[1], c.centro[2]]
  const z = V.normalizar(V.restar(ojo, centro))
  const derecha = V.normalizar(V.cruz([0, 1, 0], z))
  const arriba = V.cruz(z, derecha)
  const proy = M4.perspectiva(c.campo, rect.width / rect.height, 0.05, 40)
  const nx = ((x - rect.left) / rect.width) * 2 - 1
  const ny = 1 - ((y - rect.top) / rect.height) * 2
  const sx = nx / proy[0]
  const sy = ny / proy[5]
  const dir = V.normalizar([
    -z[0] + derecha[0] * sx + arriba[0] * sy,
    -z[1] + derecha[1] * sx + arriba[1] * sy,
    -z[2] + derecha[2] * sx + arriba[2] * sy,
  ])
  return { origen: ojo, dir }
}

/** Un músculo del atlas con la región a la que cuenta (o `undefined` si la tabla no lo conoce). */
export interface ParteDelCuerpo {
  malla: Malla
  region: IdDeRegion | 'sin-region' | undefined
}

/** La caja de una malla, calculada una vez: descarta de un golpe casi todos los músculos. */
const cajas = new WeakMap<Malla, { min: Vec3; max: Vec3; vertices: number }>()

function cajaDe(m: Malla): { min: Vec3; max: Vec3 } {
  const previa = cajas.get(m)
  if (previa && previa.vertices === m.vertices) return previa
  const p = m.posicion
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < p.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (p[i + k] < min[k]) min[k] = p[i + k]
      if (p[i + k] > max[k]) max[k] = p[i + k]
    }
  }
  const nueva = { min, max, vertices: m.vertices }
  cajas.set(m, nueva)
  return nueva
}

/** ¿Corta el rayo la caja? (método de las losas). */
function cortaLaCaja(r: Rayo, c: { min: Vec3; max: Vec3 }): boolean {
  let t0 = 0
  let t1 = Infinity
  for (let k = 0; k < 3; k++) {
    if (Math.abs(r.dir[k]) < 1e-12) {
      if (r.origen[k] < c.min[k] || r.origen[k] > c.max[k]) return false
      continue
    }
    let a = (c.min[k] - r.origen[k]) / r.dir[k]
    let b = (c.max[k] - r.origen[k]) / r.dir[k]
    if (a > b) [a, b] = [b, a]
    t0 = Math.max(t0, a)
    t1 = Math.min(t1, b)
    if (t0 > t1) return false
  }
  return true
}

/** La distancia a la que el rayo corta el triángulo más cercano de la malla, o `Infinity`. */
function distanciaAlTrianguloMasCercano(r: Rayo, m: Malla): number {
  const p = m.posicion
  const ix = m.indice
  let mejor = Infinity
  const [ox, oy, oz] = r.origen
  const [dx, dy, dz] = r.dir
  for (let i = 0; i + 2 < ix.length; i += 3) {
    const a = ix[i] * 3
    const b = ix[i + 1] * 3
    const c = ix[i + 2] * 3
    const e1x = p[b] - p[a]
    const e1y = p[b + 1] - p[a + 1]
    const e1z = p[b + 2] - p[a + 2]
    const e2x = p[c] - p[a]
    const e2y = p[c + 1] - p[a + 1]
    const e2z = p[c + 2] - p[a + 2]
    // Möller–Trumbore, a dos caras: la cara que se ve es la primera que corta el rayo.
    const hx = dy * e2z - dz * e2y
    const hy = dz * e2x - dx * e2z
    const hz = dx * e2y - dy * e2x
    const det = e1x * hx + e1y * hy + e1z * hz
    if (Math.abs(det) < 1e-12) continue
    const inv = 1 / det
    const sx = ox - p[a]
    const sy = oy - p[a + 1]
    const sz = oz - p[a + 2]
    const u = (sx * hx + sy * hy + sz * hz) * inv
    if (u < 0 || u > 1) continue
    const qx = sy * e1z - sz * e1y
    const qy = sz * e1x - sx * e1z
    const qz = sx * e1y - sy * e1x
    const v = (dx * qx + dy * qy + dz * qz) * inv
    if (v < 0 || u + v > 1) continue
    const t = (e2x * qx + e2y * qy + e2z * qz) * inv
    if (t > 1e-6 && t < mejor) mejor = t
  }
  return mejor
}

/**
 * LA REGIÓN DEL MÚSCULO MÁS CERCANO AL OJO QUE CORTA EL RAYO. `null` si no corta ninguno, o
 * si el más cercano no pertenece a ninguna región de las que cuenta la app.
 */
export function regionBajoElRayo(r: Rayo, partes: readonly ParteDelCuerpo[]): IdDeRegion | null {
  let mejor = Infinity
  let region: ParteDelCuerpo['region'] = undefined
  for (const parte of partes) {
    if (!cortaLaCaja(r, cajaDe(parte.malla))) continue
    const t = distanciaAlTrianguloMasCercano(r, parte.malla)
    if (t < mejor) {
      mejor = t
      region = parte.region
    }
  }
  if (mejor === Infinity || region === undefined || region === 'sin-region') return null
  return region
}

/** Lo que hay bajo un píxel de cliente con esta cámara. */
export function regionBajoElDedo(
  camara: CamaraParaElToque,
  rect: RectDelLienzo,
  x: number,
  y: number,
  partes: readonly ParteDelCuerpo[] = partesDelAtlas(),
): IdDeRegion | null {
  if (rect.width < 1 || rect.height < 1) return null
  return regionBajoElRayo(rayoDeLaPantalla(camara, rect, x, y), partes)
}

const IDS_CONOCIDOS: ReadonlySet<string> = new Set(REGIONES.map((r) => r.id))

/**
 * LOS MÚSCULOS DEL ATLAS CON SU REGIÓN. Sin atlas aún (se descarga a trozos) la lista sale
 * vacía y el toque no elige nada. Se recalcula al pedirla —una vez por toque—, no se guarda:
 * el atlas puede llegar después.
 */
export function partesDelAtlas(): ParteDelCuerpo[] {
  const musculos = atlasPorCapa.get('musculos') ?? []
  const partes: ParteDelCuerpo[] = []
  for (const malla of musculos) {
    const nombre = nombreDeParte(malla)
    if (!nombre) continue
    const region = regionDeMusculo(nombre)
    partes.push({ malla, region: region && region !== 'sin-region' && !IDS_CONOCIDOS.has(region) ? undefined : region })
  }
  return partes
}
