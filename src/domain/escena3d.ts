import { ejeDesdeCero } from './escenaGirable'
import { motivoSinBarras, type MagnitudPautado, type PautadoVsHechoMicrociclo } from './pautadoVsHecho'

/**
 * LA ESCENA WEBGL DE LA PRESENTACIÓN: toda la cuenta, sin tocar three (9-oct-2026).
 *
 * three no pinta en las pruebas (jsdom no tiene WebGL), así que todo lo que se puede decidir
 * con números vive aquí, en funciones puras que sí se prueban: dónde va cada barra y cada
 * nodo del camino, a qué altura llega cada una desde el cero, por dónde pasa la cinta de
 * tendencia, qué límites tiene la cámara, hacia dónde mira cuando se toca una semana y cuándo
 * se usa el respaldo en SVG. El componente que pinta solo traduce estos números a mallas.
 *
 * UNIDADES DEL MUNDO: una semana = 1 unidad a lo largo de `x`; la altura del tope del eje =
 * `ALTO_TOPE`. `y` hacia arriba, `z` hacia la cámara. El eje EMPIEZA SIEMPRE EN CERO (se
 * reutiliza `ejeDesdeCero`, el mismo de la escena SVG): una barra de valor 0 mide 0, y una
 * semana sin datos no dibuja barra, dice por qué.
 */

/** Altura, en unidades del mundo, a la que llega el tope del eje. */
export const ALTO_TOPE = 3.2
/** Separación entre semanas a lo largo de `x`. */
export const SEPARACION = 1

// ── Las barras ─────────────────────────────────────────────────────────────────────────

export interface BarraEscena {
  id: string
  numero: number
  /** Centro de la pareja a lo largo de `x`. */
  x: number
  /** Por qué no tiene barras («sin registros», «sin pauta»…), o `undefined` si las tiene. */
  motivo: string | undefined
  pautado: number
  hecho: number
  altoPauta: number
  altoHecho: number
  /** hecho ÷ pautado en %, sin tope. */
  pct: number | undefined
  /** Es el microciclo en curso: lleva el anillo que pulsa. */
  actual: boolean
}

export interface DisposicionBarras {
  barras: BarraEscena[]
  tope: number
  /** Cada marca del eje con su altura en el mundo. */
  marcas: { valor: number; y: number }[]
}

export function disposicionDeBarras(filas: readonly PautadoVsHechoMicrociclo[], magnitud: MagnitudPautado): DisposicionBarras {
  const conBarras = filas.filter((f) => motivoSinBarras(f, magnitud) === undefined)
  const maximo = Math.max(0, ...conBarras.flatMap((f) => [f[magnitud].pautado, f[magnitud].hecho]))
  const eje = ejeDesdeCero(maximo)
  const alto = (v: number) => (v / eje.tope) * ALTO_TOPE
  const centro = (filas.length - 1) / 2
  const barras = filas.map((f, i): BarraEscena => {
    const motivo = motivoSinBarras(f, magnitud)
    return {
      id: f.id,
      numero: f.numero,
      x: (i - centro) * SEPARACION,
      motivo,
      pautado: f[magnitud].pautado,
      hecho: f[magnitud].hecho,
      altoPauta: motivo ? 0 : alto(f[magnitud].pautado),
      altoHecho: motivo ? 0 : alto(f[magnitud].hecho),
      pct: motivo ? undefined : f[magnitud].cumplimientoPct,
      actual: f.estado === 'activo',
    }
  })
  return { barras, tope: eje.tope, marcas: eje.marcas.map((valor) => ({ valor, y: alto(valor) })) }
}

export interface Punto3D {
  x: number
  y: number
  z: number
}

/**
 * Por donde pasa la CINTA DE TENDENCIA: las tapas de «lo hecho», semana a semana, solo de las
 * semanas con barras. Una semana sin registros no es un cero: la cinta la salta, no se hunde.
 */
export function puntosDeLaCinta(barras: readonly BarraEscena[]): Punto3D[] {
  return barras.filter((b) => b.motivo === undefined).map((b) => ({ x: b.x, y: b.altoHecho, z: 0 }))
}

/** La semana de al lado, sin dar la vuelta (en el extremo se queda donde está). */
export function semanaVecina(ids: readonly string[], actual: string | undefined, paso: -1 | 1): string | undefined {
  if (ids.length === 0) return undefined
  const i = actual === undefined ? -1 : ids.indexOf(actual)
  if (i < 0) return paso === 1 ? ids[0] : ids[ids.length - 1]
  return ids[Math.max(0, Math.min(ids.length - 1, i + paso))]
}

// ── El camino del plan ─────────────────────────────────────────────────────────────────

export interface NodoCamino extends Punto3D {
  /** Posición en el plan, desde 0. */
  indice: number
}

/** Hasta 24 semanas, 6 por fila (cuatro filas, más grandes en pantalla estrecha); con más, 8. */
const NODOS_POR_FILA_CORTO = 6
const NODOS_POR_FILA_LARGO = 8
export const SEPARACION_CAMINO = 1.15
const SEPARACION_FILAS = 1.55

/**
 * Los nodos del camino del plan: una pista que serpentea, fila a fila y cambiando de sentido
 * (24 semanas son cuatro filas de 6; 32 son cuatro de 8). La primera fila queda al frente y
 * a la izquierda; la pista se aleja. Centrado en el origen.
 */
export function caminoDelPlan(cantidad: number): { nodos: NodoCamino[]; ancho: number; fondo: number } {
  const n = Math.max(0, Math.floor(cantidad))
  if (n === 0) return { nodos: [], ancho: 0, fondo: 0 }
  const columnas = Math.min(n <= 24 ? NODOS_POR_FILA_CORTO : NODOS_POR_FILA_LARGO, n)
  const filas = Math.ceil(n / columnas)
  const nodos = Array.from({ length: n }, (_, indice): NodoCamino => {
    const fila = Math.floor(indice / columnas)
    const col = indice % columnas
    const c = fila % 2 === 0 ? col : columnas - 1 - col
    return {
      indice,
      x: (c - (columnas - 1) / 2) * SEPARACION_CAMINO,
      y: 0,
      // La fila 0 es la más cercana a la cámara (z positivo); la pista se aleja hacia −z.
      z: ((filas - 1) / 2 - fila) * SEPARACION_FILAS,
    }
  })
  return { nodos, ancho: (columnas - 1) * SEPARACION_CAMINO, fondo: (filas - 1) * SEPARACION_FILAS }
}

// ── La cámara ──────────────────────────────────────────────────────────────────────────

export interface PoseCamara {
  /** Giro alrededor del eje vertical, en grados. 0 = de frente. */
  azimut: number
  /** Ángulo desde la vertical, en grados: 0 = desde arriba, 90 = a ras del suelo. */
  polar: number
  distancia: number
  objetivo: Punto3D
  /** Campo de visión vertical, en grados. */
  fov: number
}

/** Lo que la persona ha movido por su cuenta, encima de la pose que toca. */
export interface AjusteDeUsuario {
  azimut: number
  polar: number
  zoom: number
}

export const SIN_AJUSTE: AjusteDeUsuario = { azimut: 0, polar: 0, zoom: 1 }

export const LIMITES_CAMARA = {
  /** Giro horizontal: ±70°. */
  azimutMax: 70,
  /** Más cerca de 0 se ve todo desde arriba y se pierde la profundidad. */
  polarMin: 32,
  /** Por debajo de 90 la cámara nunca baja del plano del suelo. */
  polarMax: 80,
  /** El pellizco acerca o aleja hasta estos factores de la distancia base. */
  zoomMin: 0.55,
  zoomMax: 1.5,
}

export const FOV_3D = 34
/** El campo de visión casi plano al que llega la cámara antes de cambiarse por la ortográfica. */
export const FOV_PLANO = 4

const aRad = (g: number) => (g * Math.PI) / 180
const entre = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** Recorta lo que la persona movió para que, sumado a la pose base, nunca pase de los límites (así no se «acumula» un giro que no se ve). */
export function acotarAjuste(ajuste: AjusteDeUsuario, base: Pick<PoseCamara, 'azimut' | 'polar'>): AjusteDeUsuario {
  const L = LIMITES_CAMARA
  return {
    azimut: entre(ajuste.azimut, -L.azimutMax - base.azimut, L.azimutMax - base.azimut),
    polar: entre(ajuste.polar, L.polarMin - base.polar, L.polarMax - base.polar),
    zoom: entre(ajuste.zoom, L.zoomMin, L.zoomMax),
  }
}

/** La pose que se ve: la que toca más lo que la persona movió, siempre dentro de los límites. */
export function poseConAjuste(base: PoseCamara, ajuste: AjusteDeUsuario): PoseCamara {
  const L = LIMITES_CAMARA
  return {
    ...base,
    azimut: entre(base.azimut + ajuste.azimut, -L.azimutMax, L.azimutMax),
    polar: entre(base.polar + ajuste.polar, L.polarMin, L.polarMax),
    distancia: base.distancia * entre(ajuste.zoom, L.zoomMin, L.zoomMax),
  }
}

export function posicionDeCamara(p: Pick<PoseCamara, 'azimut' | 'polar' | 'distancia' | 'objetivo'>): Punto3D {
  const a = aRad(p.azimut)
  const e = aRad(p.polar)
  return {
    x: p.objetivo.x + p.distancia * Math.sin(e) * Math.sin(a),
    y: p.objetivo.y + p.distancia * Math.cos(e),
    z: p.objetivo.z + p.distancia * Math.sin(e) * Math.cos(a),
  }
}

/** Acerca `actual` a `meta` con un amortiguador exponencial, independiente de los fotogramas por segundo. */
export function amortiguar(actual: number, meta: number, lambda: number, dt: number): number {
  return meta + (actual - meta) * Math.exp(-lambda * Math.max(0, dt))
}

/** Un muelle con rebote suave: lo que hace que las barras crezcan y se pasen un poquito antes de asentarse. */
export function pasoDeMuelle(
  estado: { x: number; v: number },
  meta: number,
  dt: number,
  rigidez = 140,
  amortiguacion = 13,
): { x: number; v: number } {
  let { x, v } = estado
  // Subpasos fijos: con un tirón de fotograma largo el muelle no se dispara.
  const total = Math.min(Math.max(0, dt), 0.05)
  const pasos = Math.max(1, Math.ceil(total / 0.004))
  const h = total / pasos
  for (let i = 0; i < pasos; i++) {
    v += (-rigidez * (x - meta) - amortiguacion * v) * h
    x += v * h
  }
  return { x, v }
}

/** Cuántas semanas caben a la vez, legibles, según lo ancho que sea el lienzo (ancho ÷ alto). */
export function semanasVisibles(aspecto: number, total: number): number {
  const caben = Math.round(entre(aspecto * 7, 6, 14))
  return Math.max(1, Math.min(total, caben))
}

/** El centro de la ventana de semanas que se mira: sigue a la elegida sin salirse de los datos. */
export function centroDeVentana(xs: readonly number[], xElegida: number, visibles: number): number {
  if (xs.length === 0) return 0
  const min = xs[0]
  const max = xs[xs.length - 1]
  if (xs.length <= visibles) return (min + max) / 2
  const medio = ((visibles - 1) / 2) * SEPARACION
  return entre(xElegida, min + medio, max - medio)
}

/** Distancia a la que la cámara ve una altura dada, con un campo de visión dado. */
export function distanciaParaAltura(altura: number, fovGrados: number): number {
  return altura / (2 * Math.tan(aRad(fovGrados) / 2))
}

/** La escena entera: todas las semanas que caben, un poco de lado y desde arriba. */
export function poseGeneral(args: { xs: readonly number[]; xElegida: number; aspecto: number }): PoseCamara {
  const visibles = semanasVisibles(args.aspecto, args.xs.length)
  const ancho = visibles * SEPARACION + 1.8
  const alto = ALTO_TOPE + 1.9
  const necesaria = Math.max(alto, ancho / Math.max(0.4, args.aspecto))
  return {
    azimut: 16,
    polar: 64,
    distancia: distanciaParaAltura(necesaria, FOV_3D) * 1.12,
    objetivo: { x: centroDeVentana(args.xs, args.xElegida, visibles), y: ALTO_TOPE * 0.4, z: 0 },
    fov: FOV_3D,
  }
}

/** Acercada a una semana: la barra más alta cabe entera con su cifra. */
export function poseEnfocada(args: { x: number; altoMax: number }): PoseCamara {
  const alto = args.altoMax + 3.4
  return {
    azimut: 22,
    polar: 66,
    distancia: Math.max(4.4, distanciaParaAltura(alto, FOV_3D)),
    objetivo: { x: args.x, y: Math.max(0.7, args.altoMax / 2 + 0.25), z: 0 },
    fov: FOV_3D,
  }
}

/** Alto del mundo que cubre la vista plana: toda la altura del eje y las semanas que caben a lo ancho. */
export function alturaDeVistaPlana(visibles: number, aspecto: number): number {
  return Math.max(ALTO_TOPE + 2.2, (visibles * SEPARACION + 1.8) / Math.max(0.4, aspecto))
}

/** De frente y con el campo de visión casi cero: antes de cambiar a la cámara ortográfica, que se ve igual. */
export function poseVistaPlana(args: { xs: readonly number[]; xElegida: number; aspecto: number }): PoseCamara {
  const visibles = semanasVisibles(args.aspecto, args.xs.length)
  return {
    azimut: 0,
    polar: 90,
    distancia: distanciaParaAltura(alturaDeVistaPlana(visibles, args.aspecto), FOV_PLANO),
    objetivo: { x: centroDeVentana(args.xs, args.xElegida, visibles), y: (ALTO_TOPE + 0.4) / 2, z: 0 },
    fov: FOV_PLANO,
  }
}

/** El camino entero: todos los nodos a la vista, la pista alejándose. */
export function poseDelCamino(args: { ancho: number; fondo: number; aspecto: number }): PoseCamara {
  const alto = args.fondo + 3.0
  const necesaria = Math.max(alto, (args.ancho + 2.6) / Math.max(0.4, args.aspecto))
  return {
    azimut: 0,
    polar: 42,
    distancia: distanciaParaAltura(necesaria, FOV_3D) * 1.04,
    objetivo: { x: 0, y: 0, z: 0 },
    fov: FOV_3D,
  }
}

/** Acercada a un nodo del camino. */
export function poseEnNodo(nodo: Punto3D): PoseCamara {
  return { azimut: 10, polar: 56, distancia: 5.6, objetivo: { x: nodo.x, y: 0.2, z: nodo.z }, fov: FOV_3D }
}

// ── Qué se enseña ──────────────────────────────────────────────────────────────────────

export type ModoDeEscena = '3d' | 'svg'

/**
 * ¿WebGL o el respaldo en SVG? El SVG gana si no hay WebGL, si la persona pidió menos
 * movimiento (la escena 3D vive de moverse) o si WebGL ya falló en esta sesión.
 */
export function elegirRespaldo(args: { webgl: boolean; movimientoReducido: boolean; fallo: boolean }): ModoDeEscena {
  return args.webgl && !args.movimientoReducido && !args.fallo ? '3d' : 'svg'
}
