/**
 * Motor WebGL del visor de patrones.
 *
 * Sin librerías 3D: dos programas, uno sólido con skinning por hueso —un solo
 * índice por vértice, no hace falta más— y las guías del arco de movimiento van
 * como geometría dentro de la misma malla.
 *
 * Vive en `features/` y no en `domain/` a propósito: toca la GPU, así que no es
 * lógica pura.
 */

import { grados, limitar, M4, type Mat4, type Vec3 } from '../../../domain/patrones/algebra'
import type { Malla } from '../../../domain/patrones/malla'

/** Cuántas matrices de hueso caben en el shader. El esqueleto usa 22. */
const MAX_HUESOS = 24

/**
 * Fondo del estudio. Se exporta porque el mismo color tiene que estar en el
 * `clearColor` del render y en el CSS del lienzo: si se separan, se ve un salto
 * de tono en el borde mientras la escena carga.
 */
export const FONDO_ESTUDIO = '#3e454f'
const FONDO_RGB: [number, number, number] = [0.243, 0.271, 0.31]

const VS = `
attribute vec3 a_pos;
attribute vec3 a_nrm;
attribute vec3 a_col;
attribute float a_hueso;
uniform mat4 u_huesos[${MAX_HUESOS}];
uniform mat4 u_vista;
uniform mat4 u_proyeccion;
varying vec3 v_nrm;
varying vec3 v_col;
varying vec3 v_mundo;
void main() {
  // El índice llega como float porque WebGL1 no tiene atributos enteros, y el
  // array de uniforms no admite indexación dinámica: de ahí el bucle.
  int bi = int(a_hueso + 0.5);
  mat4 B = u_huesos[0];
  for (int i = 1; i < ${MAX_HUESOS}; i++) { if (i == bi) B = u_huesos[i]; }
  vec4 p = B * vec4(a_pos, 1.0);
  v_mundo = p.xyz;
  v_nrm = normalize(mat3(B) * a_nrm);
  v_col = a_col;
  gl_Position = u_proyeccion * u_vista * p;
}`

const FS = `
precision mediump float;
varying vec3 v_nrm;
varying vec3 v_col;
varying vec3 v_mundo;
uniform vec3 u_ojo;
void main() {
  vec3 N = normalize(v_nrm);
  vec3 V = normalize(u_ojo - v_mundo);
  // Los tubos abiertos no tienen dentro ni fuera: se gira la normal hacia quien mira.
  if (dot(N, V) < 0.0) N = -N;

  // Luz principal alta y a la derecha, relleno frío por la izquierda y un
  // contraluz que separa la figura del fondo al orbitar.
  vec3 L1 = normalize(vec3(0.55, 0.78, 0.62));
  vec3 L2 = normalize(vec3(-0.70, 0.10, 0.28));
  float d1 = max(dot(N, L1), 0.0);
  float d2 = max(dot(N, L2), 0.0) * 0.42;
  float envuelve = pow(max(dot(N, L1) * 0.5 + 0.5, 0.0), 1.6) * 0.36;
  float borde = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  float brillo = pow(max(dot(N, normalize(L1 + V)), 0.0), 26.0) * 0.30;

  vec3 c = v_col * (vec3(0.245, 0.268, 0.300) + d1 * 0.85 + envuelve)
         + v_col * d2 * vec3(0.72, 0.82, 1.0);
  c += vec3(1.0, 0.97, 0.92) * brillo;
  c += vec3(0.62, 0.72, 0.86) * borde * 0.30;

  // Bruma con la distancia: da profundidad sin ocultar nada.
  float niebla = clamp((length(u_ojo - v_mundo) - 1.6) / 4.2, 0.0, 1.0);
  gl_FragColor = vec4(mix(c, vec3(0.300, 0.334, 0.376), niebla * 0.40), 1.0);
}`

function compilar(gl: WebGLRenderingContext, tipo: number, fuente: string): WebGLShader {
  const s = gl.createShader(tipo)
  if (!s) throw new Error('no se pudo crear el shader')
  gl.shaderSource(s, fuente)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error('shader: ' + (gl.getShaderInfoLog(s) ?? ''))
  }
  return s
}

export class Motor {
  private gl: WebGLRenderingContext
  private programa: WebGLProgram
  private buffers: Record<string, WebGLBuffer>
  private indices = 0
  private tipoIndice: number

  constructor(private lienzo: HTMLCanvasElement) {
    const gl = lienzo.getContext('webgl', { antialias: true, alpha: false })
    if (!gl) throw new Error('WebGL no disponible')
    this.gl = gl

    const p = gl.createProgram()
    if (!p) throw new Error('no se pudo crear el programa')
    gl.attachShader(p, compilar(gl, gl.VERTEX_SHADER, VS))
    gl.attachShader(p, compilar(gl, gl.FRAGMENT_SHADER, FS))
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('enlace: ' + (gl.getProgramInfoLog(p) ?? ''))
    }
    this.programa = p

    this.buffers = {}
    for (const n of ['pos', 'nrm', 'col', 'hueso', 'idx']) {
      const b = gl.createBuffer()
      if (!b) throw new Error('no se pudo crear el buffer')
      this.buffers[n] = b
    }
    this.tipoIndice = gl.UNSIGNED_SHORT
    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.CULL_FACE)
    gl.cullFace(gl.BACK)
  }

  ajustarTamano(): number {
    const c = this.lienzo
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const ancho = Math.round(c.clientWidth * dpr)
    const alto = Math.round(c.clientHeight * dpr)
    if (c.width !== ancho || c.height !== alto) {
      c.width = ancho
      c.height = alto
    }
    this.gl.viewport(0, 0, c.width, c.height)
    return c.clientWidth / Math.max(c.clientHeight, 1)
  }

  /** Sube varias mallas concatenadas en un único buffer, para dibujarlas de una pasada. */
  subir(mallas: Malla[]): void {
    const gl = this.gl
    const pos: number[] = []
    const nrm: number[] = []
    const col: number[] = []
    const hueso: number[] = []
    const idx: number[] = []
    let base = 0
    for (const m of mallas) {
      pos.push(...m.posicion)
      nrm.push(...m.normal)
      col.push(...m.color)
      hueso.push(...m.hueso)
      for (const i of m.indice) idx.push(i + base)
      base += m.vertices
    }
    const poner = (b: WebGLBuffer, datos: number[]) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, b)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(datos), gl.DYNAMIC_DRAW)
    }
    poner(this.buffers.pos, pos)
    poner(this.buffers.nrm, nrm)
    poner(this.buffers.col, col)
    poner(this.buffers.hueso, hueso)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.idx)
    // Por encima de 65 535 vértices hacen falta índices de 32 bits. La malla
    // ronda los 20 000, pero la extensión se pide igualmente por si crece.
    const grande = base > 65535 && gl.getExtension('OES_element_index_uint') !== null
    this.tipoIndice = grande ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      grande ? new Uint32Array(idx) : new Uint16Array(idx),
      gl.DYNAMIC_DRAW,
    )
    this.indices = idx.length
  }

  private atributo(nombre: string, buffer: WebGLBuffer, tam: number): void {
    const gl = this.gl
    const loc = gl.getAttribLocation(this.programa, nombre)
    if (loc < 0) return
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, tam, gl.FLOAT, false, 0, 0)
  }

  dibujar(matrices: Mat4[], vista: Mat4, proyeccion: Mat4, ojo: Vec3): void {
    const gl = this.gl
    gl.clearColor(FONDO_RGB[0], FONDO_RGB[1], FONDO_RGB[2], 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.useProgram(this.programa)

    this.atributo('a_pos', this.buffers.pos, 3)
    this.atributo('a_nrm', this.buffers.nrm, 3)
    this.atributo('a_col', this.buffers.col, 3)
    this.atributo('a_hueso', this.buffers.hueso, 1)

    const plano = new Float32Array(MAX_HUESOS * 16)
    for (let i = 0; i < Math.min(matrices.length, MAX_HUESOS); i++) {
      plano.set(matrices[i], i * 16)
    }
    const u = (n: string) => gl.getUniformLocation(this.programa, n)
    gl.uniformMatrix4fv(u('u_huesos'), false, plano)
    gl.uniformMatrix4fv(u('u_vista'), false, new Float32Array(vista))
    gl.uniformMatrix4fv(u('u_proyeccion'), false, new Float32Array(proyeccion))
    gl.uniform3fv(u('u_ojo'), new Float32Array(ojo))

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.idx)
    gl.drawElements(gl.TRIANGLES, this.indices, this.tipoIndice, 0)
  }
}

/**
 * Cámara orbital: es la pieza que el asesorado toca. Azimut y elevación con el
 * dedo, distancia con la rueda o el pellizco.
 */
export class Orbita {
  azimut = 28
  elevacion = 6
  distancia = 3.1
  centro: Vec3 = [0, 0.9, 0]
  giroAutomatico = false
  private arrastre: { x: number; y: number; az: number; el: number } | null = null
  private pellizco: number | null = null
  private limpiezas: (() => void)[] = []

  constructor(
    el: HTMLElement,
    private alCambiar: () => void,
  ) {
    const escuchar = <K extends keyof HTMLElementEventMap>(
      tipo: K,
      fn: (e: HTMLElementEventMap[K]) => void,
      opciones?: AddEventListenerOptions,
    ) => {
      el.addEventListener(tipo, fn as EventListener, opciones)
      this.limpiezas.push(() => el.removeEventListener(tipo, fn as EventListener, opciones))
    }

    escuchar('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId)
      this.arrastre = { x: e.clientX, y: e.clientY, az: this.azimut, el: this.elevacion }
      this.giroAutomatico = false
    })
    escuchar('pointermove', (e) => {
      if (!this.arrastre) return
      this.azimut = this.arrastre.az - (e.clientX - this.arrastre.x) * 0.42
      this.elevacion = limitar(this.arrastre.el + (e.clientY - this.arrastre.y) * 0.32, -78, 78)
      this.alCambiar()
    })
    const soltar = () => {
      this.arrastre = null
    }
    escuchar('pointerup', soltar)
    escuchar('pointercancel', soltar)
    escuchar(
      'wheel',
      (e) => {
        e.preventDefault()
        this.distancia = limitar(this.distancia * (1 + Math.sign(e.deltaY) * 0.1), 1.1, 6.5)
        this.alCambiar()
      },
      { passive: false },
    )
    // Pellizco táctil. Sin esto el visor es inservible en móvil, que es donde
    // el asesorado lo va a abrir de verdad.
    escuchar(
      'touchmove',
      (e) => {
        if (e.touches.length !== 2) return
        e.preventDefault()
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        )
        if (this.pellizco) {
          this.distancia = limitar(this.distancia * (this.pellizco / d), 1.1, 6.5)
          this.alCambiar()
        }
        this.pellizco = d
      },
      { passive: false },
    )
    escuchar('touchend', () => {
      this.pellizco = null
    })
  }

  destruir(): void {
    for (const f of this.limpiezas) f()
    this.limpiezas = []
  }

  ojo(): Vec3 {
    const a = grados(this.azimut)
    const e = grados(this.elevacion)
    return [
      this.centro[0] + Math.sin(a) * Math.cos(e) * this.distancia,
      this.centro[1] + Math.sin(e) * this.distancia,
      this.centro[2] + Math.cos(a) * Math.cos(e) * this.distancia,
    ]
  }

  vista(): Mat4 {
    return M4.mirarDesde(this.ojo(), this.centro, [0, 1, 0])
  }
}
