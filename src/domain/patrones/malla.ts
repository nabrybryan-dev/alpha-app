/**
 * Construcción de malla para el visor de patrones.
 *
 * Todo lo que se dibuja va a un único buffer entrelazado, con un índice de
 * hueso por vértice para que el skinning lo haga la tarjeta gráfica. El slot 0
 * del array de huesos es siempre la identidad: lo usa la geometría que ya viene
 * en espacio mundo, que son los músculos —se regeneran en cada cambio de pose.
 */

import { limitar, M4, V, type Mat4, type Vec3 } from './algebra'

export type Color = [number, number, number]

export interface ArraysDeMalla {
  posicion: Float32Array
  normal: Float32Array
  color: Float32Array
  hueso: Float32Array
  indice: Uint16Array
}

export class Malla {
  posicion: number[] = []
  normal: number[] = []
  color: number[] = []
  hueso: number[] = []
  indice: number[] = []

  get vertices(): number {
    return this.posicion.length / 3
  }

  vertice(p: Vec3, n: Vec3, c: Color, h: number): void {
    this.posicion.push(p[0], p[1], p[2])
    this.normal.push(n[0], n[1], n[2])
    this.color.push(c[0], c[1], c[2])
    this.hueso.push(h)
  }

  triangulo(a: number, b: number, c: number): void {
    this.indice.push(a, b, c)
  }

  cuadro(a: number, b: number, c: number, d: number): void {
    this.indice.push(a, b, c, a, c, d)
  }

  arrays(): ArraysDeMalla {
    return {
      posicion: new Float32Array(this.posicion),
      normal: new Float32Array(this.normal),
      color: new Float32Array(this.color),
      hueso: new Float32Array(this.hueso),
      indice: new Uint16Array(this.indice),
    }
  }
}

/**
 * Catmull-Rom sobre una polilínea de control, con `n` muestras.
 *
 * Es lo que convierte tres o cuatro puntos de anclaje anatómico en un vientre
 * muscular curvo en lugar de en una línea quebrada.
 */
export function curva(control: Vec3[], n: number): Vec3[] {
  if (control.length === 2) {
    const salida: Vec3[] = []
    for (let i = 0; i < n; i++) salida.push(V.entre(control[0], control[1], i / (n - 1)))
    return salida
  }
  const p = [control[0], ...control, control[control.length - 1]]
  const tramos = p.length - 3
  const salida: Vec3[] = []
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * tramos
    const s = Math.min(Math.floor(u), tramos - 1)
    const t = u - s
    const [p0, p1, p2, p3] = [p[s], p[s + 1], p[s + 2], p[s + 3]]
    const t2 = t * t
    const t3 = t2 * t
    const q: Vec3 = [0, 0, 0]
    for (let k = 0; k < 3; k++) {
      q[k] =
        0.5 *
        (2 * p1[k] +
          (-p0[k] + p2[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
          (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)
    }
    salida.push(q)
  }
  return salida
}

interface Marco {
  t: Vec3
  n: Vec3
  b: Vec3
}

/**
 * Marcos por transporte paralelo.
 *
 * Evita que el tubo se retuerza sobre sí mismo en las curvas cerradas, que es
 * el fallo clásico de orientar cada sección con un «arriba» fijo.
 */
function marcos(puntos: Vec3[]): Marco[] {
  const n = puntos.length
  const tangentes: Vec3[] = []
  for (let i = 0; i < n; i++) {
    const a = puntos[Math.max(0, i - 1)]
    const b = puntos[Math.min(n - 1, i + 1)]
    let t = V.restar(b, a)
    if (V.largo(t) < 1e-9) t = [0, 1, 0]
    tangentes.push(V.normalizar(t))
  }
  const semilla: Vec3 = Math.abs(tangentes[0][1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]
  let normal = V.normalizar(V.cruz(semilla, tangentes[0]))
  const salida: Marco[] = []
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      // Rotación mínima de la tangente anterior a la actual, aplicada a la
      // normal previa: así la sección no gira más de lo que gira la curva.
      const eje = V.cruz(tangentes[i - 1], tangentes[i])
      const s = V.largo(eje)
      if (s > 1e-7) {
        const e = V.escalar(eje, 1 / s)
        const ang = Math.atan2(s, V.punto(tangentes[i - 1], tangentes[i]))
        const c = Math.cos(ang)
        const sn = Math.sin(ang)
        normal = V.sumar(
          V.sumar(V.escalar(normal, c), V.escalar(V.cruz(e, normal), sn)),
          V.escalar(e, V.punto(e, normal) * (1 - c)),
        )
      }
      normal = V.normalizar(V.restar(normal, V.escalar(tangentes[i], V.punto(normal, tangentes[i]))))
    }
    salida.push({ t: tangentes[i], n: normal, b: V.cruz(tangentes[i], normal) })
  }
  return salida
}

export interface OpcionesTubo {
  radial?: number
  color?: Color
  hueso?: number
  /** Achata la sección: músculos planos (dorsal, pectoral) y placas óseas. */
  aplanar?: number
  tapar?: boolean
}

/** Tubo de radio variable a lo largo de una polilínea. */
export function tubo(
  malla: Malla,
  puntos: Vec3[],
  radio: number[] | ((t: number) => number),
  opciones: OpcionesTubo = {},
): void {
  const seg = opciones.radial ?? 9
  const color = opciones.color ?? [0.8, 0.8, 0.8]
  const hueso = opciones.hueso ?? 0
  const aplanar = opciones.aplanar ?? 1
  const tapar = opciones.tapar !== false
  const fr = marcos(puntos)
  const base = malla.vertices
  const n = puntos.length

  for (let i = 0; i < n; i++) {
    const r = typeof radio === 'function' ? radio(i / (n - 1)) : radio[i]
    const f = fr[i]
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2
      const ca = Math.cos(a) * r
      const sa = Math.sin(a) * r * aplanar
      const p = V.sumar(puntos[i], V.sumar(V.escalar(f.n, ca), V.escalar(f.b, sa)))
      // La normal es el desplazamiento corregido por el achatamiento.
      const nr = V.normalizar(
        V.sumar(V.escalar(f.n, Math.cos(a)), V.escalar(f.b, Math.sin(a) / aplanar)),
      )
      malla.vertice(p, nr, color, hueso)
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const j2 = (j + 1) % seg
      malla.cuadro(
        base + i * seg + j,
        base + i * seg + j2,
        base + (i + 1) * seg + j2,
        base + (i + 1) * seg + j,
      )
    }
  }
  if (tapar) {
    for (const [idx, dir] of [
      [0, -1],
      [n - 1, 1],
    ]) {
      const c = malla.vertices
      malla.vertice(puntos[idx], V.escalar(fr[idx].t, dir), color, hueso)
      for (let j = 0; j < seg; j++) {
        const j2 = (j + 1) % seg
        if (dir < 0) malla.triangulo(c, base + idx * seg + j2, base + idx * seg + j)
        else malla.triangulo(c, base + idx * seg + j, base + idx * seg + j2)
      }
    }
  }
}

export interface OpcionesElipsoide {
  su?: number
  sv?: number
  color?: Color
  hueso?: number
  giro?: Mat4 | null
}

/** Elipsoide: base del cráneo, la pelvis, las epífisis y los vientres compactos. */
export function elipsoide(
  malla: Malla,
  centro: Vec3,
  radios: Vec3,
  opciones: OpcionesElipsoide = {},
): void {
  const su = opciones.su ?? 14
  const sv = opciones.sv ?? 10
  const color = opciones.color ?? [0.85, 0.84, 0.8]
  const hueso = opciones.hueso ?? 0
  const giro = opciones.giro ?? null
  const base = malla.vertices
  for (let v = 0; v <= sv; v++) {
    const phi = (v / sv) * Math.PI
    for (let u = 0; u < su; u++) {
      const th = (u / su) * Math.PI * 2
      const d: Vec3 = [Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)]
      let p: Vec3 = [d[0] * radios[0], d[1] * radios[1], d[2] * radios[2]]
      let nr = V.normalizar([d[0] / radios[0], d[1] / radios[1], d[2] / radios[2]])
      if (giro) {
        p = M4.transformarDireccion(giro, p)
        nr = V.normalizar(M4.transformarDireccion(giro, nr))
      }
      malla.vertice(V.sumar(centro, p), nr, color, hueso)
    }
  }
  for (let v = 0; v < sv; v++) {
    for (let u = 0; u < su; u++) {
      const u2 = (u + 1) % su
      malla.cuadro(base + v * su + u, base + v * su + u2, base + (v + 1) * su + u2, base + (v + 1) * su + u)
    }
  }
}

export interface OpcionesHuesoLargo {
  color?: Color
  hueso?: number
  /** Cuánto se ensancha cada extremo respecto a la diáfisis. */
  epifisisA?: number
  epifisisB?: number
  arqueo?: number
  aplanar?: number
}

/**
 * Hueso largo: diáfisis fina con las epífisis ensanchadas en los dos extremos.
 * Es ese perfil, y no el grosor, lo que hace que se lea como hueso y no como un
 * cilindro cualquiera.
 */
export function huesoLargo(
  malla: Malla,
  a: Vec3,
  b: Vec3,
  r: number,
  opciones: OpcionesHuesoLargo = {},
): void {
  const color = opciones.color ?? [0.855, 0.835, 0.783]
  const hueso = opciones.hueso ?? 0
  const eA = opciones.epifisisA ?? 1.75
  const eB = opciones.epifisisB ?? 1.75
  const arqueo = opciones.arqueo ?? 0
  const puntos: Vec3[] = []
  const N = 11
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1)
    const p = V.entre(a, b, t)
    if (arqueo) {
      const d = V.normalizar(V.restar(b, a))
      const perp = V.normalizar(V.cruz(d, Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]))
      const s = Math.sin(t * Math.PI) * arqueo
      p[0] += perp[0] * s
      p[1] += perp[1] * s
      p[2] += perp[2] * s
    }
    puntos.push(p)
  }
  tubo(
    malla,
    puntos,
    (t) => {
      const ensanche = Math.pow(Math.abs(t * 2 - 1), 3)
      const e = t < 0.5 ? eA : eB
      return r * (1 + ensanche * (e - 1))
    },
    { radial: 9, color, hueso, aplanar: opciones.aplanar ?? 1 },
  )
}

/**
 * Trazo discontinuo con geometría real.
 *
 * `gl.lineWidth` se ignora en casi todos los navegadores —siempre da 1 píxel—,
 * así que el arco de movimiento se construye con tubos. Es la única forma de
 * que se vea con grosor en el móvil.
 */
export function tuboDiscontinuo(
  malla: Malla,
  puntos: Vec3[],
  r: number,
  colorHecho: Color,
  colorPendiente: Color,
  hasta: number,
  trazo: number,
  hueco: number,
): void {
  if (puntos.length < 2) return
  const acumulado = [0]
  for (let i = 1; i < puntos.length; i++) {
    acumulado.push(acumulado[i - 1] + V.largo(V.restar(puntos[i], puntos[i - 1])))
  }
  const total = acumulado[acumulado.length - 1]
  if (total < 1e-5) return

  // Muestreo uniforme por longitud de arco: sin esto los trazos se estiran en
  // los tramos donde los puntos de control están más separados.
  const en = (s: number): Vec3 => {
    const t = limitar(s, 0, total)
    let i = 1
    while (i < acumulado.length - 1 && acumulado[i] < t) i++
    const k = (t - acumulado[i - 1]) / Math.max(acumulado[i] - acumulado[i - 1], 1e-9)
    return V.entre(puntos[i - 1], puntos[i], k)
  }

  const paso = trazo + hueco
  for (let s = 0; s < total; s += paso) {
    const s1 = Math.min(s + trazo, total)
    if (s1 - s < 1e-4) continue
    const tramo: Vec3[] = []
    const n = 4
    for (let j = 0; j <= n; j++) tramo.push(en(s + ((s1 - s) * j) / n))
    const hecho = (s + trazo * 0.5) / total <= hasta
    tubo(malla, tramo, () => r, {
      radial: 6,
      color: hecho ? colorHecho : colorPendiente,
      hueso: 0,
    })
  }
}

/** Punta de flecha cónica al final del recorrido. */
export function flecha(malla: Malla, desde: Vec3, hasta: Vec3, r: number, color: Color): void {
  const d = V.restar(hasta, desde)
  if (V.largo(d) < 1e-6) return
  const dir = V.normalizar(d)
  const base = V.restar(hasta, V.escalar(dir, r * 3.4))
  tubo(malla, [base, V.restar(hasta, V.escalar(dir, r * 0.2)), hasta], (t) => r * 2.3 * (1 - t), {
    radial: 8,
    color,
    hueso: 0,
  })
}

