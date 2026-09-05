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
  /**
   * Distancia medida ATRAVESANDO las fibras, en metros.
   *
   * Es lo que permite estriar el músculo en la dirección real de sus fibras. Va
   * en transversal y no a lo largo por una razón geométrica: el sombreado dibuja
   * las líneas donde este número es constante, y esas líneas salen
   * perpendiculares a la dirección en la que crece. Midiendo a lo largo de la
   * fibra se obtenía el patrón contrario —anillos cruzando el músculo— que es
   * exactamente lo que no se quería.
   *
   * Es un solo número por vértice, no una dirección: lo que hace falta es la
   * fase de la estría, y calcularla al construir sale gratis porque ahí ya se
   * conoce el ángulo de penación.
   */
  fibra: Float32Array
  indice: Uint32Array
}

/**
 * Acumulador de geometría con memoria reutilizable.
 *
 * Los buffers son arrays tipados con capacidad propia y un cursor, en vez de
 * `number[]` con `push`. El motivo es medido, no estético: la musculatura son
 * unos catorce mil vértices por cuadro y hacer crecer cuatro arrays a base de
 * `push` costaba 19 de los 22 ms del cuadro —el 90 % del tiempo—, casi todo en
 * reservar memoria una y otra vez para tirarla acto seguido.
 *
 * `reiniciar()` deja los cursores a cero y conserva la memoria, así que a
 * partir del segundo cuadro no se reserva nada.
 */
export class Malla {
  private bufPos: Float32Array
  private bufNrm: Float32Array
  private bufCol: Float32Array
  private bufHueso: Float32Array
  private bufFibra: Float32Array
  private bufIdx: Uint32Array
  private nv = 0
  private ni = 0

  /**
   * CUÁNTO SE VE A TRAVÉS DE ESTA MALLA: 1 es opaca, 0 invisible.
   *
   * Es de la malla entera y no de cada vértice, a propósito. Lo único translúcido que
   * hay en el salón es el FANTASMA —el cuerpo que enseña lo que se hizo, superpuesto al
   * que enseña lo que había que hacer— y un fantasma es translúcido entero o no es un
   * fantasma. Un alfa por vértice costaría un sexto array en cada malla y sesenta copias
   * más por segundo para una cosa que nadie necesita vértice a vértice.
   *
   * El motor lo lee al subir: rellena el atributo con este valor para todos los vértices
   * de la malla, ordena las opacas delante y dibuja las translúcidas después sin escribir
   * profundidad. Ninguna malla de las que ya existían cambia: nace en 1.
   */
  alfa = 1

  /**
   * SI SE DIBUJA ENCIMA DE TODO, sin prueba de profundidad.
   *
   * Es para lo que se enseña SOBRE el cuerpo y tiene que leerse aunque el cuerpo lo tape:
   * el brazo de momento y el arco del par, que viven dentro de la carne de la cadera. Con
   * profundidad se veían a trozos —lo que asomaba entre dos músculos— y un brazo a trozos
   * no mide nada. El motor las dibuja en una tercera tanda, después de lo translúcido, con
   * la prueba de profundidad apagada. Nace en `false`: nada de lo que existía cambia.
   */
  encima = false

  constructor(capacidadVertices = 2048) {
    this.bufPos = new Float32Array(capacidadVertices * 3)
    this.bufNrm = new Float32Array(capacidadVertices * 3)
    this.bufCol = new Float32Array(capacidadVertices * 3)
    this.bufHueso = new Float32Array(capacidadVertices)
    this.bufFibra = new Float32Array(capacidadVertices)
    this.bufIdx = new Uint32Array(capacidadVertices * 6)
  }

  /** Vacía el contenido sin soltar la memoria ya reservada. */
  reiniciar(): void {
    this.nv = 0
    this.ni = 0
  }

  get vertices(): number {
    return this.nv
  }

  // Vistas de la parte escrita. `subarray` no copia.
  get posicion(): Float32Array {
    return this.bufPos.subarray(0, this.nv * 3)
  }
  get normal(): Float32Array {
    return this.bufNrm.subarray(0, this.nv * 3)
  }
  get color(): Float32Array {
    return this.bufCol.subarray(0, this.nv * 3)
  }
  get hueso(): Float32Array {
    return this.bufHueso.subarray(0, this.nv)
  }
  get fibra(): Float32Array {
    return this.bufFibra.subarray(0, this.nv)
  }
  get indice(): Uint32Array {
    return this.bufIdx.subarray(0, this.ni)
  }

  private crecerVertices(): void {
    const nueva = this.bufHueso.length * 2
    const copiar = (v: Float32Array, tam: number) => {
      const n = new Float32Array(nueva * tam)
      n.set(v)
      return n
    }
    this.bufPos = copiar(this.bufPos, 3)
    this.bufNrm = copiar(this.bufNrm, 3)
    this.bufCol = copiar(this.bufCol, 3)
    this.bufHueso = copiar(this.bufHueso, 1)
    this.bufFibra = copiar(this.bufFibra, 1)
  }

  private crecerIndices(): void {
    const n = new Uint32Array(this.bufIdx.length * 2)
    n.set(this.bufIdx)
    this.bufIdx = n
  }

  vertice(p: Vec3, n: Vec3, c: Color, h: number): void {
    this.verticeSuelto(p[0], p[1], p[2], n[0], n[1], n[2], c, h)
  }

  /**
   * Igual que `vertice`, pero con números sueltos.
   *
   * Existe por rendimiento: el bucle interno del tubo corre unas catorce mil
   * veces por cuadro, y pasar por vectores obligaba a crear seis arrays en cada
   * vuelta.
   */
  verticeSuelto(
    px: number, py: number, pz: number,
    nx: number, ny: number, nz: number,
    c: Color, h: number,
    /**
     * Distancia recorrida a lo largo de la fibra, en metros. Va al final y con
     * valor por defecto para no tocar a los muchos llamadores que dibujan hueso
     * o guías, donde no hay fibra que estriar.
     */
    fibra = 0,
  ): void {
    if (this.nv >= this.bufHueso.length) this.crecerVertices()
    const i = this.nv * 3
    this.bufPos[i] = px
    this.bufPos[i + 1] = py
    this.bufPos[i + 2] = pz
    this.bufNrm[i] = nx
    this.bufNrm[i + 1] = ny
    this.bufNrm[i + 2] = nz
    this.bufCol[i] = c[0]
    this.bufCol[i + 1] = c[1]
    this.bufCol[i + 2] = c[2]
    this.bufHueso[this.nv] = h
    this.bufFibra[this.nv] = fibra
    this.nv++
  }

  triangulo(a: number, b: number, c: number): void {
    if (this.ni + 3 > this.bufIdx.length) this.crecerIndices()
    this.bufIdx[this.ni] = a
    this.bufIdx[this.ni + 1] = b
    this.bufIdx[this.ni + 2] = c
    this.ni += 3
  }

  cuadro(a: number, b: number, c: number, d: number): void {
    if (this.ni + 6 > this.bufIdx.length) this.crecerIndices()
    const i = this.ni
    this.bufIdx[i] = a
    this.bufIdx[i + 1] = b
    this.bufIdx[i + 2] = c
    this.bufIdx[i + 3] = a
    this.bufIdx[i + 4] = c
    this.bufIdx[i + 5] = d
    this.ni += 6
  }

  arrays(): ArraysDeMalla {
    return {
      posicion: this.posicion,
      normal: this.normal,
      color: this.color,
      hueso: this.hueso,
      fibra: this.fibra,
      indice: this.indice,
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
    let tx = b[0] - a[0]
    let ty = b[1] - a[1]
    let tz = b[2] - a[2]
    const l = Math.hypot(tx, ty, tz)
    if (l < 1e-9) {
      tx = 0
      ty = 1
      tz = 0
    } else {
      tx /= l
      ty /= l
      tz /= l
    }
    tangentes.push([tx, ty, tz])
  }

  // Aritmética con números sueltos, no con vectores: esto corre una vez por
  // punto de cada tubo y cada operación vectorial creaba un array nuevo.
  const s0: Vec3 = Math.abs(tangentes[0][1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]
  const t0 = tangentes[0]
  let nx = s0[1] * t0[2] - s0[2] * t0[1]
  let ny = s0[2] * t0[0] - s0[0] * t0[2]
  let nz = s0[0] * t0[1] - s0[1] * t0[0]
  let inv = 1 / (Math.hypot(nx, ny, nz) || 1)
  nx *= inv
  ny *= inv
  nz *= inv

  const salida: Marco[] = []
  for (let i = 0; i < n; i++) {
    const [tx, ty, tz] = tangentes[i]
    if (i > 0) {
      // Rotación mínima de la tangente anterior a la actual, aplicada a la
      // normal previa: así la sección no gira más de lo que gira la curva.
      const [ax, ay, az] = tangentes[i - 1]
      let ex = ay * tz - az * ty
      let ey = az * tx - ax * tz
      let ez = ax * ty - ay * tx
      const s = Math.hypot(ex, ey, ez)
      if (s > 1e-7) {
        ex /= s
        ey /= s
        ez /= s
        const ang = Math.atan2(s, ax * tx + ay * ty + az * tz)
        const c = Math.cos(ang)
        const sn = Math.sin(ang)
        // Rodrigues: n·cos + (e × n)·sen + e·(e·n)(1 − cos)
        const cx = ey * nz - ez * ny
        const cy = ez * nx - ex * nz
        const cz = ex * ny - ey * nx
        const d = (ex * nx + ey * ny + ez * nz) * (1 - c)
        nx = nx * c + cx * sn + ex * d
        ny = ny * c + cy * sn + ey * d
        nz = nz * c + cz * sn + ez * d
      }
      // Se vuelve a hacer perpendicular a la tangente y se renormaliza, o el
      // error se acumula a lo largo del tubo.
      const dot = nx * tx + ny * ty + nz * tz
      nx -= tx * dot
      ny -= ty * dot
      nz -= tz * dot
      inv = 1 / (Math.hypot(nx, ny, nz) || 1)
      nx *= inv
      ny *= inv
      nz *= inv
    }
    salida.push({
      t: tangentes[i],
      n: [nx, ny, nz],
      b: [ty * nz - tz * ny, tz * nx - tx * nz, tx * ny - ty * nx],
    })
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
  /**
   * Cómo van las fibras dentro del tubo, para poder estriarlo en su dirección.
   *
   * `penacion` es el ángulo en radianes que forma la fibra con el eje: cero es
   * una fibra que corre a lo largo, y los penados del cuerpo humano rondan los
   * 10° a 30°. `bilateral` invierte el ángulo en la mitad opuesta, que es lo que
   * distingue un bipenado —fibras en espiga hacia un tendón central— de un
   * unipenado, donde todas van al mismo lado.
   */
  fibra?: { penacion: number; bilateral?: boolean }
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

  // Los senos y cosenos del anillo son los mismos en toda la longitud del tubo:
  // se calculan una vez y no `seg` veces por cada uno de los `n` anillos.
  const cosA = new Float64Array(seg)
  const senA = new Float64Array(seg)
  for (let j = 0; j < seg; j++) {
    const a = (j / seg) * Math.PI * 2
    cosA[j] = Math.cos(a)
    senA[j] = Math.sin(a)
  }

  // Coordenada transversal a la fibra. Se acumula la longitud real recorrida
  // para que la estría tenga el mismo paso en un músculo largo y en uno corto.
  const pen = opciones.fibra?.penacion ?? 0
  const cosPen = Math.cos(pen)
  const senPen = Math.sin(pen)
  const bilateral = opciones.fibra?.bilateral ?? false
  let recorrido = 0

  for (let i = 0; i < n; i++) {
    const r = typeof radio === 'function' ? radio(i / (n - 1)) : radio[i]
    const f = fr[i]
    if (i > 0) {
      const [ax, ay, az] = puntos[i - 1]
      const [bx2, by2, bz2] = puntos[i]
      recorrido += Math.hypot(bx2 - ax, by2 - ay, bz2 - az)
    }
    const [nx, ny, nz] = f.n
    const [bx, by, bz] = f.b
    const [px, py, pz] = puntos[i]
    for (let j = 0; j < seg; j++) {
      const ca = cosA[j] * r
      const sa = senA[j] * r * aplanar
      // La normal es el desplazamiento corregido por el achatamiento.
      const vx = nx * cosA[j] + (bx * senA[j]) / aplanar
      const vy = ny * cosA[j] + (by * senA[j]) / aplanar
      const vz = nz * cosA[j] + (bz * senA[j]) / aplanar
      const inv = 1 / (Math.hypot(vx, vy, vz) || 1)
      malla.verticeSuelto(
        px + nx * ca + bx * sa,
        py + ny * ca + by * sa,
        pz + nz * ca + bz * sa,
        vx * inv, vy * inv, vz * inv,
        color, hueso,
        // Perpendicular a la fibra: al girar la fibra un ángulo, esta gira con
        // ella, así que las estrías salen inclinadas lo mismo. En un fusiforme
        // queda pura vuelta al tubo, que dibuja las fibras a lo largo. En un
        // bipenado el giro cambia de sentido en la mitad opuesta y forman
        // espiga, que es la seña de la arquitectura.
        (j / seg) * 2 * Math.PI * r * cosPen -
          (bilateral && cosA[j] < 0 ? -1 : 1) * recorrido * senPen,
      )
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

/**
 * HORNEAR UNA MALLA: aplicarle sus matrices de hueso en la CPU y dejarla sin hueso.
 *
 * ## Para qué
 *
 * El motor tiene UNA paleta de matrices de hueso por dibujo —la del sujeto— y cada
 * vértice dice a qué hueso pertenece. Eso vale para un cuerpo. Un segundo cuerpo en otra
 * fase —el fantasma— necesita sus propias matrices, y no hay segunda paleta: o se hace un
 * segundo dibujo con otro juego de uniformes, o se transforma el segundo cuerpo ANTES de
 * subirlo y se le pone hueso 0, que es la identidad. Esto es lo segundo. Cuesta recorrer
 * sus vértices una vez por fotograma, que es lo mismo que ya cuesta construirlos.
 *
 * ## Qué conserva
 *
 * Color, fibra, índices y alfa salen iguales. Solo cambian posición y normal, y la normal
 * se lleva como DIRECCIÓN —sin la traslación—: llevarla como punto la descuadraría y el
 * sombreado del fantasma saldría iluminado desde un sitio distinto al del sujeto.
 *
 * `destino` se reutiliza para no reservar memoria en cada fotograma, por lo mismo que
 * `construirMusculos` acepta una malla para reutilizar.
 */
export function hornear(origen: Malla, matrices: Mat4[], destino?: Malla): Malla {
  const d = destino ?? new Malla(Math.max(2048, origen.vertices))
  d.reiniciar()
  d.alfa = origen.alfa
  const pos = origen.posicion
  const nrm = origen.normal
  const col = origen.color
  const hueso = origen.hueso
  const fibra = origen.fibra
  const n = origen.vertices
  for (let v = 0; v < n; v++) {
    const m = matrices[hueso[v]] ?? matrices[0]
    const i = v * 3
    const p = M4.transformarPunto(m, [pos[i], pos[i + 1], pos[i + 2]])
    const q = M4.transformarDireccion(m, [nrm[i], nrm[i + 1], nrm[i + 2]])
    d.verticeSuelto(p[0], p[1], p[2], q[0], q[1], q[2], [col[i], col[i + 1], col[i + 2]], 0, fibra[v])
  }
  const idx = origen.indice
  for (let k = 0; k + 2 < idx.length; k += 3) d.triangulo(idx[k], idx[k + 1], idx[k + 2])
  return d
}
