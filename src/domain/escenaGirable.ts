/**
 * LA ESCENA QUE SE GIRA: proyección 3D escrita a mano, para dibujar en SVG (9-oct-2026).
 *
 * POR QUÉ NO CSS 3D. Con 24-32 microciclos × 2 barras, una caja CSS por barra son más de
 * cien capas compuestas, y un iPhone las paga con tirones. Aquí cada barra son tres
 * polígonos de un solo SVG: se calcula la proyección y el navegador solo pinta.
 *
 * LA PROYECCIÓN es ortogonal (sin perspectiva): un giro alrededor del eje vertical y una
 * inclinación fija de la cámara hacia abajo. Se eligió ortogonal a propósito: la
 * perspectiva hace que dos barras del mismo valor midan distinto según lo cerca que estén,
 * y esta pantalla existe para comparar magnitudes. El giro está limitado (`GIRO_MAXIMO`)
 * para que nunca se vea el costado de una barra tapando a otra, y existe una «vista plana»
 * (giro 0, inclinación 0) que la deja de frente y en 2D, porque la profundidad baja la
 * precisión al leer.
 *
 * COORDENADAS DEL MUNDO: `x` a lo largo de los microciclos, `y` hacia arriba (la altura de
 * la barra), `z` hacia el fondo (lo más cerca del espectador es el `z` más pequeño).
 * Pantalla: `x` hacia la derecha, `y` hacia ABAJO (como SVG).
 */

export interface VistaEscena {
  /** Giro alrededor del eje vertical, en grados. Positivo = se ve más el costado derecho. */
  giro: number
  /** Cuánto se mira desde arriba, en grados. 0 = de frente, sin ver las tapas. */
  inclinacion: number
}

export const VISTA_3D: VistaEscena = { giro: 24, inclinacion: 24 }
export const VISTA_PLANA: VistaEscena = { giro: 0, inclinacion: 0 }
/** Más allá, las barras de delante tapan a las de atrás y la lectura se pierde. */
export const GIRO_MAXIMO = 50

/** Lo mínimo que mide una semana en la escena para que sus dos números se lean sin pisarse (px). */
export const ANCHO_MINIMO_CASILLA = 40

export function limitarGiro(grados: number): number {
  if (!Number.isFinite(grados)) return 0
  return Math.max(-GIRO_MAXIMO, Math.min(GIRO_MAXIMO, grados))
}

export function esVistaPlana(v: VistaEscena): boolean {
  return v.giro === 0 && v.inclinacion === 0
}

const aRadianes = (g: number) => (g * Math.PI) / 180

export interface Punto3 {
  x: number
  y: number
  z: number
}

export interface Punto2 {
  x: number
  y: number
}

export interface Proyectado extends Punto2 {
  /** Distancia al espectador: mayor = más lejos. Sirve para pintar de atrás hacia delante. */
  profundidad: number
}

export function proyectar(p: Punto3, v: VistaEscena): Proyectado {
  const g = aRadianes(v.giro)
  const i = aRadianes(v.inclinacion)
  const xg = p.x * Math.cos(g) + p.z * Math.sin(g)
  const zg = -p.x * Math.sin(g) + p.z * Math.cos(g)
  return {
    x: xg,
    y: -(p.y * Math.cos(i) + zg * Math.sin(i)),
    profundidad: -p.y * Math.sin(i) + zg * Math.cos(i),
  }
}

export type NombreCara = 'frente' | 'derecha' | 'izquierda' | 'arriba'

/**
 * Qué caras de una caja se ven con esta vista. Una cara se ve si su normal apunta hacia
 * el espectador; de canto (producto 0) no se pinta, así la vista plana no dibuja tapas ni
 * costados que serían líneas sin grosor.
 */
export function carasVisibles(v: VistaEscena): Record<NombreCara, boolean> {
  const g = aRadianes(v.giro)
  const i = aRadianes(v.inclinacion)
  const EPS = 1e-9
  return {
    frente: Math.cos(i) * Math.cos(g) > EPS,
    derecha: Math.sin(g) * Math.cos(i) > EPS,
    izquierda: -Math.sin(g) * Math.cos(i) > EPS,
    arriba: Math.sin(i) > EPS,
  }
}

export interface Caja {
  x0: number
  x1: number
  z0: number
  z1: number
  /** Altura de la caja, desde el suelo (y = 0). */
  alto: number
}

export interface CajaProyectada {
  /** Las caras visibles, ya en pantalla, de las más oscuras a la tapa. */
  caras: { nombre: NombreCara; puntos: Punto2[] }[]
  /** El centro de la tapa: donde se ancla el número exacto de la barra. */
  cima: Punto2
  profundidad: number
}

export function cajaProyectada(c: Caja, v: VistaEscena): CajaProyectada {
  const P = (x: number, y: number, z: number) => proyectar({ x, y, z }, v)
  const visibles = carasVisibles(v)
  const caras: CajaProyectada['caras'] = []
  // El frente es el plano `z0` (el más cercano al espectador).
  if (visibles.frente) caras.push({ nombre: 'frente', puntos: [P(c.x0, 0, c.z0), P(c.x1, 0, c.z0), P(c.x1, c.alto, c.z0), P(c.x0, c.alto, c.z0)] })
  if (visibles.derecha) caras.push({ nombre: 'derecha', puntos: [P(c.x1, 0, c.z0), P(c.x1, 0, c.z1), P(c.x1, c.alto, c.z1), P(c.x1, c.alto, c.z0)] })
  if (visibles.izquierda) caras.push({ nombre: 'izquierda', puntos: [P(c.x0, 0, c.z1), P(c.x0, 0, c.z0), P(c.x0, c.alto, c.z0), P(c.x0, c.alto, c.z1)] })
  if (visibles.arriba) caras.push({ nombre: 'arriba', puntos: [P(c.x0, c.alto, c.z0), P(c.x1, c.alto, c.z0), P(c.x1, c.alto, c.z1), P(c.x0, c.alto, c.z1)] })
  const centro = P((c.x0 + c.x1) / 2, c.alto, (c.z0 + c.z1) / 2)
  return { caras, cima: { x: centro.x, y: centro.y }, profundidad: P((c.x0 + c.x1) / 2, c.alto / 2, (c.z0 + c.z1) / 2).profundidad }
}

/**
 * Un eje que EMPIEZA SIEMPRE EN CERO. El tope es el primer «número redondo» que cubre el
 * máximo de los datos, con cuatro tramos como mucho: se leen 0, 25, 50, 75, 100, no
 * 0, 23,7, 47,4… Nunca se recorta el eje para que una diferencia parezca mayor.
 */
export function ejeDesdeCero(maximo: number): { tope: number; marcas: number[] } {
  if (!Number.isFinite(maximo) || maximo <= 0) return { tope: 1, marcas: [0, 1] }
  const crudo = maximo / 4
  const magnitud = Math.pow(10, Math.floor(Math.log10(crudo)))
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * magnitud).find((p) => p >= crudo) ?? 10 * magnitud
  const tramos = Math.ceil(maximo / paso - 1e-9)
  const marcas: number[] = []
  for (let k = 0; k <= tramos; k++) marcas.push(Math.round(k * paso * 1e6) / 1e6)
  return { tope: marcas[marcas.length - 1], marcas }
}
