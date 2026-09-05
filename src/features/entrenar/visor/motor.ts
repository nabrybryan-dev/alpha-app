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
import { GLSL_ACABADO } from '../../../domain/patrones/color'
import type { Malla } from '../../../domain/patrones/malla'

/** Cuántas matrices de hueso caben en el shader. El esqueleto usa 22. */
const MAX_HUESOS = 24

/**
 * Fondo del estudio. Se exporta porque el mismo color tiene que estar en el
 * `clearColor` del render y en el CSS del lienzo: si se separan, se ve un salto
 * de tono en el borde mientras la escena carga.
 */
// El fondo gris azulado de la versión anterior lavaba la sala: las paredes carbón
// quedaban prácticamente del mismo valor y en el móvil solo se leía el sujeto.
// Un fondo profundo separa el volumen de la habitación y conserva el lenguaje Alpha.
export const FONDO_ESTUDIO = '#0b0e12'
const FONDO_RGB: [number, number, number] = [0.043, 0.055, 0.071]

const VS = `
attribute vec3 a_pos;
attribute vec3 a_nrm;
attribute vec3 a_col;
attribute float a_hueso;
attribute float a_fibra;
attribute float a_alfa;
uniform mat4 u_huesos[${MAX_HUESOS}];
uniform mat4 u_vista;
uniform mat4 u_proyeccion;
varying vec3 v_nrm;
varying vec3 v_col;
varying vec3 v_mundo;
varying float v_fibra;
varying float v_alfa;
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
  v_fibra = a_fibra;
  v_alfa = a_alfa;
  gl_Position = u_proyeccion * u_vista * p;
}`

const FS = `
precision mediump float;
${GLSL_ACABADO}
varying vec3 v_nrm;
varying vec3 v_col;
varying vec3 v_mundo;
varying float v_fibra;
varying float v_alfa;
uniform vec3 u_ojo;
uniform float u_suelo;
void main() {
  vec3 N = normalize(v_nrm);
  vec3 V = normalize(u_ojo - v_mundo);

  // El relieve de las fibras. v_fibra es la distancia recorrida A LO LARGO de
  // la fibra, así que un seno sobre ella dibuja los fascículos en su dirección
  // real: a lo largo en un fusiforme y oblicuos en un penado. Se perturba la
  // normal y no el color, porque una fibra se ve por cómo coge la luz y no
  // porque esté pintada; pintada se vería como una tela estampada.
  if (v_fibra != 0.0) {
    float onda = sin(v_fibra * 220.0);
    // Se inclina la normal sobre un eje transversal fijo. Podría sacarse la
    // dirección exacta con derivadas de pantalla, pero eso pide una extensión
    // de WebGL 1 que no está en todas partes, y el relieve se lee igual: la
    // ONDA ya va en la dirección de la fibra, que es lo que se quiere ver.
    vec3 eje = abs(N.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 lateral = normalize(cross(N, eje));
    N = normalize(N + lateral * onda * 0.16);
  }
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

  // Ambiente por hemisferios en vez de un gris plano: lo que mira hacia arriba
  // recibe cielo y lo que mira hacia abajo recibe rebote del suelo, más oscuro.
  // Es lo que da volumen a las cavidades sin necesidad de calcular oclusión: un
  // ambiente constante aplana la figura y la deja como un recorte.
  float cielo = N.y * 0.5 + 0.5;
  vec3 ambiente = aLineal(mix(vec3(0.126, 0.140, 0.162), vec3(0.300, 0.330, 0.372), cielo));

  // Oscurecimiento de contacto. Lo que está a ras de suelo recibe menos luz del
  // entorno porque el propio suelo se la tapa, y es lo que posa la figura en vez
  // de dejarla flotando. Se hace sobre el cuerpo y no proyectando una sombra en
  // el plano: la cámara mira casi a la altura del sujeto, así que una mancha en
  // el suelo se ve de canto y no aparece por muy grande y negra que sea.
  float contacto = clamp(v_mundo.y / 0.26, 0.0, 1.0);
  ambiente *= mix(1.0, 0.34 + 0.66 * contacto, u_suelo);

  vec3 base = aLineal(v_col);
  vec3 c = base * (ambiente + d1 * 0.85 + envuelve)
         + base * d2 * vec3(0.72, 0.82, 1.0);
  c += vec3(1.0, 0.97, 0.92) * brillo;
  c += vec3(0.62, 0.72, 0.86) * borde * 0.30;

  // Bruma con la distancia: da profundidad sin ocultar nada.
  float niebla = clamp((length(u_ojo - v_mundo) - 1.6) / 4.2, 0.0, 1.0);
  c = mix(c, aLineal(vec3(0.300, 0.334, 0.376)), niebla * 0.40);

  gl_FragColor = vec4(acabado(c), v_alfa);
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
    for (const n of ['pos', 'nrm', 'col', 'hueso', 'fibra', 'alfa', 'idx']) {
      const b = gl.createBuffer()
      if (!b) throw new Error('no se pudo crear el buffer')
      this.buffers[n] = b
    }
    this.tipoIndice = gl.UNSIGNED_SHORT
    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.CULL_FACE)
    gl.cullFace(gl.BACK)
    // LA MEZCLA, encendida siempre y sin coste para lo opaco: con alfa 1 la fórmula
    // devuelve el color tal cual. Lo que la hace segura es el ORDEN de dibujo, que
    // decide `subir()`: opacas primero con profundidad, translúcidas después sin
    // escribirla. Al revés, un fantasma dibujado antes taparía al sujeto con su alfa.
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
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

  /**
   * Sube varias mallas concatenadas en un único buffer, para dibujarlas de una pasada.
   *
   * MEDIDO 2026-09-02: esto era el 90 % del coste de `subir()`, y `subir()` era
   * el 83 % del fotograma. No lo pagaba la GPU: lo pagaba `Array.prototype.push`.
   *
   * Lo que había antes juntaba las mallas en tres pasos y solo el tercero tocaba
   * la tarjeta:
   *
   *     const pos = []
   *     for (const m of mallas) pos.push(...m.posicion)
   *     gl.bufferData(..., new Float32Array(pos), ...)
   *
   * El paso 1 hace `spread` de un `Float32Array` hacia un `number[]` —o sea,
   * desempaqueta 60.000 floats a valores del motor, uno a uno, construyendo
   * además una lista de argumentos por malla— y el paso 2 los vuelve a empaquetar
   * recorriéndolos otra vez. Sesenta veces por segundo, por CINCO atributos.
   *
   * Contando primero y escribiendo con `.set()` los dos pasos desaparecen: entre
   * dos arrays tipados del mismo tipo, `.set()` es una copia de memoria.
   *
   *     como estaba          1,093 ms
   *     reservando antes     0,139 ms   -> 7,9x
   *
   * por el atributo de posición; por los cinco, unos 4,77 ms de fotograma. El
   * p90 estaba en 17,6 ms contra un presupuesto de 16,7: esto es lo que lo
   * devuelve por debajo. Reproducir con `node scripts/medir-concatenacion.mjs`,
   * que además comprueba que las dos rutas dan bytes idénticos — si no, la
   * medida no valdría nada.
   *
   * Los búferes se guardan entre llamadas y solo crecen. Reservar 20.000
   * vértices en cada fotograma es basura que hay que recoger sesenta veces por
   * segundo, y el recolector no avisa: se nota como tirones, no como lentitud.
   */
  subir(entrantes: Malla[]): void {
    const gl = this.gl

    // LAS OPACAS DELANTE Y LAS TRANSLÚCIDAS DETRÁS, en un orden que `dibujar()` pueda
    // partir en dos: es lo que hace que la mezcla alfa sea correcta sin ordenar
    // triángulos. La función es pura y se prueba sin WebGL.
    const { ordenadas: mallas, indicesOpacos, indicesEncima } = ordenarPorOpacidad(entrantes)
    this.indicesOpacos = indicesOpacos
    this.indicesEncima = indicesEncima

    // PRIMERA PASADA: cuánto hay. El conteo sale de la misma propiedad que
    // luego se escribe, que es la única forma de que no se quede corto.
    let verts = 0
    let indices = 0
    for (const m of mallas) {
      verts += m.vertices
      indices += m.indice.length
    }

    // Por encima de 65.535 vértices hacen falta índices de 32 bits. Se decide
    // ANTES de reservar: convertir después sería justo la copia que se quita.
    const grande = verts > 65535 && gl.getExtension('OES_element_index_uint') !== null
    this.tipoIndice = grande ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT

    const c = this.reservar(verts, indices, grande)

    // SEGUNDA PASADA: escribir en su sitio.
    let v = 0 // vértices ya escritos: la base que hay que sumar a los índices
    let i = 0 // posición en el búfer de índices
    for (const m of mallas) {
      c.pos.set(m.posicion, v * 3)
      c.nrm.set(m.normal, v * 3)
      c.col.set(m.color, v * 3)
      c.hueso.set(m.hueso, v)
      c.fibra.set(m.fibra, v)
      // El alfa es de la malla entera: se rellena, no se copia.
      c.alfa.fill(m.alfa, v, v + m.vertices)
      // Los índices NO se copian, se desplazan: cada malla los trae relativos a
      // sí misma. Aquí no sirve `.set()`, pero el bucle escribe sobre un array
      // tipado ya reservado, que era la mitad cara del asunto.
      const idx = m.indice
      for (let k = 0; k < idx.length; k++) c.idx[i + k] = idx[k] + v
      v += m.vertices
      i += idx.length
    }

    // Se sube solo la parte escrita: el búfer guardado puede ser más grande que
    // esta escena, y lo que sobra son ceros que la tarjeta dibujaría como
    // triángulos degenerados en el origen.
    const poner = (b: WebGLBuffer, datos: Float32Array, n: number) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, b)
      gl.bufferData(gl.ARRAY_BUFFER, datos.subarray(0, n), gl.DYNAMIC_DRAW)
    }
    poner(this.buffers.pos, c.pos, verts * 3)
    poner(this.buffers.alfa, c.alfa, verts)
    poner(this.buffers.nrm, c.nrm, verts * 3)
    poner(this.buffers.col, c.col, verts * 3)
    poner(this.buffers.hueso, c.hueso, verts)
    poner(this.buffers.fibra, c.fibra, verts)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.idx)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, c.idx.subarray(0, indices), gl.DYNAMIC_DRAW)
    this.indices = indices
  }

  /**
   * La memoria de trabajo de `subir()`, que sobrevive entre fotogramas.
   *
   * Solo crece, y crece con holgura —un 25 %— para que una escena que gana unos
   * pocos vértices no obligue a reservar de nuevo en el fotograma siguiente. El
   * tipo de los índices puede cambiar si la escena cruza los 65.535 vértices, y
   * entonces hay que reservar de otro tipo aunque quepa.
   */
  private cache: {
    pos: Float32Array
    nrm: Float32Array
    col: Float32Array
    hueso: Float32Array
    fibra: Float32Array
    alfa: Float32Array
    idx: Uint16Array | Uint32Array
  } | null = null

  private reservar(verts: number, indices: number, grande: boolean) {
    const c = this.cache
    const cabe =
      c !== null &&
      c.hueso.length >= verts &&
      c.idx.length >= indices &&
      (grande ? c.idx instanceof Uint32Array : c.idx instanceof Uint16Array)
    if (cabe) return c

    const v = Math.ceil(verts * 1.25)
    const n = Math.ceil(indices * 1.25)
    const nuevo = {
      pos: new Float32Array(v * 3),
      nrm: new Float32Array(v * 3),
      col: new Float32Array(v * 3),
      hueso: new Float32Array(v),
      fibra: new Float32Array(v),
      alfa: new Float32Array(v),
      idx: grande ? new Uint32Array(n) : new Uint16Array(n),
    }
    this.cache = nuevo
    return nuevo
  }


  /** Cuántos índices son de mallas opacas. Lo pone `subir()`; lo parte `dibujar()`. */
  private indicesOpacos = 0
  /** Cuántos índices, al final del búfer, se dibujan ENCIMA sin profundidad. */
  private indicesEncima = 0

  private atributo(nombre: string, buffer: WebGLBuffer, tam: number): void {
    const gl = this.gl
    const loc = gl.getAttribLocation(this.programa, nombre)
    if (loc < 0) return
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, tam, gl.FLOAT, false, 0, 0)
  }

  /**
   * @param haySuelo si el sujeto se apoya en algo. Sin suelo debajo no puede
   *   haber oclusión de contacto, y aplicarla dejaría las piernas oscurecidas
   *   sin motivo en las demostraciones, donde el sujeto flota a propósito.
   */
  dibujar(
    matrices: Mat4[],
    vista: Mat4,
    proyeccion: Mat4,
    ojo: Vec3,
    haySuelo: boolean,
  ): void {
    const gl = this.gl
    gl.clearColor(FONDO_RGB[0], FONDO_RGB[1], FONDO_RGB[2], 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.useProgram(this.programa)

    this.atributo('a_pos', this.buffers.pos, 3)
    this.atributo('a_fibra', this.buffers.fibra, 1)
    this.atributo('a_nrm', this.buffers.nrm, 3)
    this.atributo('a_col', this.buffers.col, 3)
    this.atributo('a_hueso', this.buffers.hueso, 1)
    this.atributo('a_alfa', this.buffers.alfa, 1)

    const plano = new Float32Array(MAX_HUESOS * 16)
    for (let i = 0; i < Math.min(matrices.length, MAX_HUESOS); i++) {
      plano.set(matrices[i], i * 16)
    }
    const u = (n: string) => gl.getUniformLocation(this.programa, n)
    gl.uniformMatrix4fv(u('u_huesos'), false, plano)
    gl.uniformMatrix4fv(u('u_vista'), false, new Float32Array(vista))
    gl.uniformMatrix4fv(u('u_proyeccion'), false, new Float32Array(proyeccion))
    gl.uniform1f(u('u_suelo'), haySuelo ? 1 : 0)
    gl.uniform3fv(u('u_ojo'), new Float32Array(ojo))

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.idx)
    // DOS TANDAS. Lo opaco con profundidad, como siempre. Lo translúcido después y SIN
    // escribir profundidad: si el fantasma escribiera la suya, la parte del sujeto que
    // queda detrás de él desaparecería en vez de verse a través. El desplazamiento del
    // segundo `drawElements` va en BYTES, y el tamaño del índice lo decide `subir()`.
    const bytes = this.tipoIndice === gl.UNSIGNED_INT ? 4 : 2
    const opacos = Math.min(this.indicesOpacos, this.indices)
    gl.drawElements(gl.TRIANGLES, opacos, this.tipoIndice, 0)
    const encima = Math.min(this.indicesEncima, this.indices - opacos)
    const translucidos = this.indices - opacos - encima
    if (translucidos > 0) {
      gl.depthMask(false)
      gl.drawElements(gl.TRIANGLES, translucidos, this.tipoIndice, opacos * bytes)
      gl.depthMask(true)
    }
    // TERCERA TANDA: lo que va ENCIMA del cuerpo —el brazo de momento, el arco del par—
    // sin prueba de profundidad, para que se lea entero aunque la carne lo tape. Va la
    // última para no dejar su profundidad escrita, y con la prueba otra vez encendida al
    // salir: el fotograma siguiente empieza como siempre.
    if (encima > 0) {
      gl.disable(gl.DEPTH_TEST)
      gl.depthMask(false)
      gl.drawElements(gl.TRIANGLES, encima, this.tipoIndice, (opacos + translucidos) * bytes)
      gl.depthMask(true)
      gl.enable(gl.DEPTH_TEST)
    }
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
  private centroDeDosDedos: { x: number; y: number; az: number; el: number } | null = null
  /**
   * SI UN SOLO DEDO ORBITA.
   *
   * En el estudio del patrón sí: allí no hay nada más que hacer con el dedo. En el SALÓN
   * no, y se apaga desde fuera: allí el dedo suelto es de navegar —deslizar de lado pasa de
   * ejercicio, como en cualquier carrusel— y la cámara se maneja con dos dedos, que es la
   * convención de las apps que meten un modelo 3D dentro de algo por lo que se navega. El
   * pellizco ya era de dos dedos, así que la cámara entera cae en la misma mano.
   */
  arrastreConUnDedo = true
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
      // El giro automático se para al tocar, orbite o no: el dedo encima manda.
      this.giroAutomatico = false
      if (!this.arrastreConUnDedo) return
      el.setPointerCapture(e.pointerId)
      this.arrastre = { x: e.clientX, y: e.clientY, az: this.azimut, el: this.elevacion }
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
        // Y ORBITAR CON DOS DEDOS: lo que mueve la cámara es el punto medio entre ellos,
        // así que acercar y girar salen del mismo contacto sin estorbarse —el pellizco
        // cambia la distancia entre los dedos y la órbita cambia dónde está su centro—.
        // Es lo que deja el dedo suelto libre para navegar por los ejercicios.
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
        if (!this.centroDeDosDedos) {
          this.centroDeDosDedos = { x: cx, y: cy, az: this.azimut, el: this.elevacion }
        } else {
          const c = this.centroDeDosDedos
          this.azimut = c.az - (cx - c.x) * 0.42
          this.elevacion = limitar(c.el + (cy - c.y) * 0.32, -78, 78)
          this.alCambiar()
        }
      },
      { passive: false },
    )
    escuchar('touchend', () => {
      this.pellizco = null
      this.centroDeDosDedos = null
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

/**
 * LAS OPACAS PRIMERO, y dónde acaban.
 *
 * Es la única regla que hace que la mezcla alfa salga bien sin ordenar triángulos: todo
 * lo opaco se dibuja con profundidad y después, encima, lo translúcido sin escribirla.
 * Devuelve las mallas en ese orden —estable: entre iguales se conserva el de llegada— y
 * cuántos ÍNDICES suman las opacas, que es el punto exacto donde `dibujar()` parte las dos
 * tandas.
 *
 * Es una función suelta y pura a propósito: el motor necesita WebGL para existir, y en
 * jsdom no hay WebGL. Esto se prueba con cuatro mallas de mentira.
 */
export function ordenarPorOpacidad(mallas: Malla[]): {
  ordenadas: Malla[]
  indicesOpacos: number
  /** Cuántos índices, al FINAL, son de mallas `encima`: se dibujan sin profundidad. */
  indicesEncima: number
} {
  const opacas = mallas.filter((m) => !m.encima && m.alfa >= 1)
  const translucidas = mallas.filter((m) => !m.encima && m.alfa < 1)
  const encima = mallas.filter((m) => m.encima)
  const cuenta = (xs: Malla[]) => xs.reduce((n, m) => n + m.indice.length, 0)
  return {
    ordenadas: [...opacas, ...translucidas, ...encima],
    indicesOpacos: cuenta(opacas),
    indicesEncima: cuenta(encima),
  }
}
