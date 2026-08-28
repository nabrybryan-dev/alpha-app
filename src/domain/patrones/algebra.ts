/**
 * Álgebra mínima para el visor de patrones: vectores de tres y matrices de
 * cuatro por cuatro, en el mismo orden por columnas que espera WebGL.
 *
 * No se usa una librería a propósito. La app la abre un asesorado en el
 * gimnasio con la conexión que haya, y meter un motor 3D entero por esto
 * costaría cientos de kilobytes para usar cuatro funciones.
 */

export type Vec3 = [number, number, number]
/** 16 números en orden por columnas: `m[columna * 4 + fila]`. */
export type Mat4 = number[]

export const V = {
  sumar: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  restar: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  escalar: (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s],
  punto: (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cruz: (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  largo: (a: Vec3): number => Math.hypot(a[0], a[1], a[2]),
  normalizar: (a: Vec3): Vec3 => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1
    return [a[0] / l, a[1] / l, a[2] / l]
  },
  entre: (a: Vec3, b: Vec3, t: number): Vec3 => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ],
}

export const M4 = {
  identidad: (): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],

  multiplicar(a: Mat4, b: Mat4): Mat4 {
    const o = new Array<number>(16)
    for (let c = 0; c < 4; c++) {
      for (let f = 0; f < 4; f++) {
        o[c * 4 + f] =
          a[f] * b[c * 4] +
          a[4 + f] * b[c * 4 + 1] +
          a[8 + f] * b[c * 4 + 2] +
          a[12 + f] * b[c * 4 + 3]
      }
    }
    return o
  },

  trasladar: (x: number, y: number, z: number): Mat4 => [
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1,
  ],

  girarX(a: number): Mat4 {
    const c = Math.cos(a)
    const s = Math.sin(a)
    return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]
  },

  girarY(a: number): Mat4 {
    const c = Math.cos(a)
    const s = Math.sin(a)
    return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]
  },

  girarZ(a: number): Mat4 {
    const c = Math.cos(a)
    const s = Math.sin(a)
    return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  },

  /**
   * Orden de aplicación sobre el vector: primero Z, luego X y por último Y.
   *
   * Se eligió así para que la flexión (X) y la abducción (Z) no se contaminen
   * entre sí cuando el segmento lleva además rotación axial (Y).
   */
  euler(rx: number, ry: number, rz: number): Mat4 {
    return M4.multiplicar(M4.multiplicar(M4.girarY(ry), M4.girarX(rx)), M4.girarZ(rz))
  },

  transformarPunto(m: Mat4, p: Vec3): Vec3 {
    return [
      m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
    ]
  },

  transformarDireccion(m: Mat4, p: Vec3): Vec3 {
    return [
      m[0] * p[0] + m[4] * p[1] + m[8] * p[2],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2],
    ]
  },

  perspectiva(fovY: number, aspecto: number, cerca: number, lejos: number): Mat4 {
    const f = 1 / Math.tan(fovY / 2)
    const nf = 1 / (cerca - lejos)
    return [
      f / aspecto, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (lejos + cerca) * nf, -1,
      0, 0, 2 * lejos * cerca * nf, 0,
    ]
  },

  mirarDesde(ojo: Vec3, centro: Vec3, arriba: Vec3): Mat4 {
    const z = V.normalizar(V.restar(ojo, centro))
    const x = V.normalizar(V.cruz(arriba, z))
    const y = V.cruz(z, x)
    return [
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -V.punto(x, ojo), -V.punto(y, ojo), -V.punto(z, ojo), 1,
    ]
  },
}

export const grados = (d: number): number => (d * Math.PI) / 180

export const limitar = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v

export const entre = (a: number, b: number, t: number): number => a + (b - a) * t

/** Arranca y termina despacio, como una repetición controlada. */
export const suavizar = (t: number): number => t * t * (3 - 2 * t)
