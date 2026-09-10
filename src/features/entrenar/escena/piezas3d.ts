import { Malla } from '../../../domain/patrones/malla'

/**
 * LAS PIEZAS HECHAS FUERA: el formato `.pieza` y cómo se leen.
 *
 * ## Por qué un formato propio y no glTF
 *
 * glTF es un estándar de cientos de páginas —jerarquías de nodos, accesores dispersos,
 * animaciones, materiales PBR— y el motor de esta app come exactamente seis cosas:
 * posición, normal, color, coordenadas de textura, índices y el nombre de una imagen. Un
 * lector de glTF a mano sería la pieza más grande del visor para usar el 5 % de lo que
 * lee. Como los dos extremos son nuestros —Blender exporta con un script, la app lee
 * aquí— el formato es la lista de arrays y punto. Sin librerías: el motor sigue siendo
 * WebGL a mano y esto es un `DataView`.
 *
 * ## El formato, byte a byte
 *
 * Little-endian, TODO alineado a 4 bytes para poder mirar los arrays sin copiarlos:
 *
 *     'PIEZ' | u16 versión = 1 | u16 nPartes
 *     por parte:
 *       u16 largo | utf8 nombre de textura | relleno hasta múltiplo de 4 (contando el u16)
 *       u32 nVértices | u32 nÍndices
 *       f32 pos[3n] | f32 nrm[3n] | f32 col[3n] | f32 uv[2n] | u32 idx[m]
 *
 * Una pieza son varias PARTES, una por textura: el motor dibuja de una pasada lo que
 * comparte imagen, y una malla lleva una sola.
 *
 * ## Ejes
 *
 * Blender es Z arriba; la app, Y arriba. El exportador ya hace el cambio, con una
 * rotación propia que conserva el enrollado — si no, el descarte de caras traseras se
 * tragaría la pieza entera en silencio. Aquí llega en metros, centrada en XZ y apoyada en
 * y = 0, y `colocar()` la lleva a su sitio en la sala.
 */

const MAGIA = 'PIEZ'
/**
 * Versiones del formato. Se leen todas; se escribe la última.
 *
 * - **1**: seis arrays de `float32` y nada más.
 * - **2**: añade un `u32` de banderas por parte. Bit 0: la luz viene grabada en el color.
 * - **3**: **los números se guardan en el tamaño que necesitan**, no en 32 bits. Medido
 *   sobre la sala del gimnasio: 4,34 MB, de los cuales 0,92 en posiciones, 0,92 en
 *   normales, 0,92 en color, 0,61 en coordenadas y 0,98 en índices. Nada de eso pide
 *   `float32`:
 *
 *       posición   u16 con mínimo y escala por parte → 0,25 mm en una sala de 16 m
 *       normal     i8 → menos de medio grado, y lo horneado ni las usa
 *       color      u8 → es un color de PANTALLA: 255 pasos es toda su precisión
 *       uv         u16 con mínimo y escala → 1/65535 de la imagen
 *       índice     u16 mientras la parte no pase de 65.535 vértices
 *
 *   Y una parte sin textura no guarda coordenadas: eran ceros. En la app se descomprime a
 *   los mismos `Float32Array` de siempre — esto encoge la DESCARGA, que es lo que le hacía
 *   esperar a Bryan con LTE, no la memoria de la tarjeta.
 */
const VERSION = 3
const BANDERA_HORNEADA = 1
const BANDERA_SIN_UV = 2
const BANDERA_INDICES_32 = 4

export interface PartePieza {
  textura: string | null
  /** Si el color ya trae la luz de Blender y el motor no debe iluminar. */
  horneada?: boolean
  posicion: Float32Array
  normal: Float32Array
  color: Float32Array
  uv: Float32Array
  indice: Uint32Array
}

function relleno(n: number): number {
  return (4 - (n % 4)) % 4
}

/**
 * Lee una pieza. Devuelve una `Malla` por parte, con su textura puesta.
 *
 * Es pura y no toca la red: `cargarPiezas` (en el visor) trae los bytes. Lanza si la
 * cabecera no es la esperada — una pieza que no se entiende no se dibuja a medias.
 */
export function leerPieza(bytes: ArrayBuffer): Malla[] {
  const vista = new DataView(bytes)
  const magia = String.fromCharCode(vista.getUint8(0), vista.getUint8(1), vista.getUint8(2), vista.getUint8(3))
  if (magia !== MAGIA) throw new Error(`no es una pieza: cabecera «${magia}»`)
  const version = vista.getUint16(4, true)
  if (version < 1 || version > VERSION) {
    throw new Error(`versión de pieza ${version}; se esperaba ${VERSION} o anterior`)
  }
  const nPartes = vista.getUint16(6, true)
  let pos = 8
  const mallas: Malla[] = []
  const decodificador = new TextDecoder()
  for (let p = 0; p < nPartes; p++) {
    const largo = vista.getUint16(pos, true)
    const nombre = largo > 0 ? decodificador.decode(new Uint8Array(bytes, pos + 2, largo)) : null
    pos += 2 + largo + relleno(2 + largo)
    let banderas = 0
    if (version >= 2) {
      banderas = vista.getUint32(pos, true)
      pos += 4
    }
    const nV = vista.getUint32(pos, true)
    const nI = vista.getUint32(pos + 4, true)
    pos += 8
    const f32 = (n: number) => {
      const a = new Float32Array(bytes, pos, n)
      pos += n * 4
      return a
    }

    let posicion: Float32Array
    let normal: Float32Array
    let color: Float32Array
    let uv: Float32Array
    let indice: Uint32Array | Uint16Array
    if (version >= 3) {
      const sinUv = (banderas & BANDERA_SIN_UV) !== 0
      const base = f32(3)
      const escala = f32(3)
      const uvBase = sinUv ? new Float32Array(2) : f32(2)
      const uvEscala = sinUv ? new Float32Array(2) : f32(2)

      // Cada bloque empieza alineado a 4 y termina rellenando hasta el siguiente múltiplo:
      // sin eso, un `Uint16Array` sobre un desplazamiento impar lanza.
      const avanzar = (bytesDelBloque: number) => {
        pos += bytesDelBloque
        pos += relleno(pos)
      }

      const crudoPos = new Uint16Array(bytes, pos, nV * 3)
      avanzar(nV * 6)
      posicion = new Float32Array(nV * 3)
      for (let i = 0; i < nV * 3; i++) posicion[i] = base[i % 3] + (crudoPos[i] / 65535) * escala[i % 3]

      const crudoNrm = new Int8Array(bytes, pos, nV * 3)
      avanzar(nV * 3)
      normal = new Float32Array(nV * 3)
      for (let i = 0; i < nV * 3; i++) normal[i] = crudoNrm[i] / 127

      const crudoCol = new Uint8Array(bytes, pos, nV * 3)
      avanzar(nV * 3)
      color = new Float32Array(nV * 3)
      for (let i = 0; i < nV * 3; i++) color[i] = crudoCol[i] / 255

      uv = new Float32Array(nV * 2)
      if (!sinUv) {
        const crudoUv = new Uint16Array(bytes, pos, nV * 2)
        avanzar(nV * 4)
        for (let i = 0; i < nV * 2; i++) uv[i] = uvBase[i % 2] + (crudoUv[i] / 65535) * uvEscala[i % 2]
      }

      if ((banderas & BANDERA_INDICES_32) !== 0) {
        indice = new Uint32Array(bytes, pos, nI)
        avanzar(nI * 4)
      } else {
        indice = new Uint16Array(bytes, pos, nI)
        avanzar(nI * 2)
      }
    } else {
      posicion = f32(nV * 3)
      normal = f32(nV * 3)
      color = f32(nV * 3)
      uv = f32(nV * 2)
      indice = new Uint32Array(bytes, pos, nI)
      pos += nI * 4
    }

    const m = new Malla(Math.max(8, nV))
    for (let v = 0; v < nV; v++) {
      const i = v * 3
      m.verticeSuelto(
        posicion[i], posicion[i + 1], posicion[i + 2],
        normal[i], normal[i + 1], normal[i + 2],
        [color[i], color[i + 1], color[i + 2]],
        0, 0,
        uv[v * 2], uv[v * 2 + 1],
      )
    }
    for (let k = 0; k + 2 < indice.length; k += 3) m.triangulo(indice[k], indice[k + 1], indice[k + 2])
    m.textura = nombre
    m.horneada = (banderas & BANDERA_HORNEADA) !== 0
    mallas.push(m)
  }
  return mallas
}

/**
 * Escribe una pieza. Existe para las pruebas —ida y vuelta contra `leerPieza`— y como
 * definición ejecutable del formato: el exportador de Blender tiene que producir estos
 * mismos bytes, y si alguien cambia uno de los dos, la prueba con la pieza real lo dice.
 */
export function escribirPieza(partes: PartePieza[]): ArrayBuffer {
  const codificador = new TextEncoder()
  const nombres = partes.map((p) => codificador.encode(p.textura ?? ''))
  /** El rango de un array por componentes, para el mínimo y la escala de la cuantización. */
  const rango = (a: Float32Array, comp: number) => {
    const min = new Float32Array(comp).fill(Infinity)
    const max = new Float32Array(comp).fill(-Infinity)
    for (let i = 0; i < a.length; i++) {
      const k = i % comp
      if (a[i] < min[k]) min[k] = a[i]
      if (a[i] > max[k]) max[k] = a[i]
    }
    const esc = new Float32Array(comp)
    for (let k = 0; k < comp; k++) {
      if (!Number.isFinite(min[k])) min[k] = 0
      // Escala cero —una parte plana en ese eje— dividiría por cero al leer.
      esc[k] = Math.max(max[k] - min[k], 1e-9)
    }
    return { min, esc }
  }

  const preparadas = partes.map((p, i) => {
    const nV = p.posicion.length / 3
    const sinUv = p.textura === null || p.uv.every((v) => v === 0)
    const indices32 = nV > 65535
    return {
      p,
      nV,
      sinUv,
      indices32,
      nombre: nombres[i],
      pos: rango(p.posicion, 3),
      uv: sinUv ? null : rango(p.uv, 2),
    }
  })

  let total = 8
  for (const q of preparadas) {
    total += 2 + q.nombre.length + relleno(2 + q.nombre.length) + 4 + 8
    total += 24 + (q.sinUv ? 0 : 16)
    total += q.nV * 6 + relleno(q.nV * 6)
    total += q.nV * 3 + relleno(q.nV * 3)
    total += q.nV * 3 + relleno(q.nV * 3)
    if (!q.sinUv) total += q.nV * 4 + relleno(q.nV * 4)
    const bytesIdx = q.p.indice.length * (q.indices32 ? 4 : 2)
    total += bytesIdx + relleno(bytesIdx)
  }

  const bytes = new ArrayBuffer(total)
  const vista = new DataView(bytes)
  const octetos = new Uint8Array(bytes)
  for (let i = 0; i < 4; i++) vista.setUint8(i, MAGIA.charCodeAt(i))
  vista.setUint16(4, VERSION, true)
  vista.setUint16(6, partes.length, true)
  let pos = 8
  const alinear = () => {
    pos += relleno(pos)
  }
  for (const q of preparadas) {
    vista.setUint16(pos, q.nombre.length, true)
    octetos.set(q.nombre, pos + 2)
    pos += 2 + q.nombre.length + relleno(2 + q.nombre.length)
    const banderas =
      (q.p.horneada ? BANDERA_HORNEADA : 0) |
      (q.sinUv ? BANDERA_SIN_UV : 0) |
      (q.indices32 ? BANDERA_INDICES_32 : 0)
    vista.setUint32(pos, banderas, true)
    pos += 4
    vista.setUint32(pos, q.nV, true)
    vista.setUint32(pos + 4, q.p.indice.length, true)
    pos += 8

    for (let k = 0; k < 3; k++) vista.setFloat32(pos + k * 4, q.pos.min[k], true)
    for (let k = 0; k < 3; k++) vista.setFloat32(pos + 12 + k * 4, q.pos.esc[k], true)
    pos += 24
    if (q.uv) {
      for (let k = 0; k < 2; k++) vista.setFloat32(pos + k * 4, q.uv.min[k], true)
      for (let k = 0; k < 2; k++) vista.setFloat32(pos + 8 + k * 4, q.uv.esc[k], true)
      pos += 16
    }

    const crudoPos = new Uint16Array(bytes, pos, q.nV * 3)
    for (let i = 0; i < q.nV * 3; i++) {
      const k = i % 3
      crudoPos[i] = Math.round(((q.p.posicion[i] - q.pos.min[k]) / q.pos.esc[k]) * 65535)
    }
    pos += q.nV * 6
    alinear()

    const crudoNrm = new Int8Array(bytes, pos, q.nV * 3)
    for (let i = 0; i < q.nV * 3; i++) {
      crudoNrm[i] = Math.max(-127, Math.min(127, Math.round(q.p.normal[i] * 127)))
    }
    pos += q.nV * 3
    alinear()

    const crudoCol = new Uint8Array(bytes, pos, q.nV * 3)
    for (let i = 0; i < q.nV * 3; i++) {
      crudoCol[i] = Math.max(0, Math.min(255, Math.round(q.p.color[i] * 255)))
    }
    pos += q.nV * 3
    alinear()

    if (q.uv) {
      const crudoUv = new Uint16Array(bytes, pos, q.nV * 2)
      for (let i = 0; i < q.nV * 2; i++) {
        const k = i % 2
        crudoUv[i] = Math.round(((q.p.uv[i] - q.uv.min[k]) / q.uv.esc[k]) * 65535)
      }
      pos += q.nV * 4
      alinear()
    }

    if (q.indices32) {
      new Uint32Array(bytes, pos, q.p.indice.length).set(q.p.indice)
      pos += q.p.indice.length * 4
    } else {
      const crudoIdx = new Uint16Array(bytes, pos, q.p.indice.length)
      for (let i = 0; i < q.p.indice.length; i++) crudoIdx[i] = q.p.indice[i]
      pos += q.p.indice.length * 2
    }
    alinear()
  }
  return bytes
}

/**
 * Lleva una pieza a su sitio en la sala: giro alrededor del eje vertical y traslación.
 *
 * Gira posiciones y normales; traslada solo posiciones. Devuelve mallas NUEVAS y deja las
 * de entrada como estaban, para poder colocar la misma pieza dos veces.
 */
export function colocar(mallas: Malla[], en: { x: number; z: number; giroY: number }): Malla[] {
  const c = Math.cos(en.giroY)
  const s = Math.sin(en.giroY)
  return mallas.map((m) => {
    const d = new Malla(Math.max(8, m.vertices))
    const pos = m.posicion
    const nrm = m.normal
    const col = m.color
    const uv = m.uv
    for (let v = 0; v < m.vertices; v++) {
      const i = v * 3
      const px = pos[i] * c + pos[i + 2] * s
      const pz = -pos[i] * s + pos[i + 2] * c
      const nx = nrm[i] * c + nrm[i + 2] * s
      const nz = -nrm[i] * s + nrm[i + 2] * c
      d.verticeSuelto(
        px + en.x, pos[i + 1], pz + en.z,
        nx, nrm[i + 1], nz,
        [col[i], col[i + 1], col[i + 2]],
        0, 0, uv[v * 2], uv[v * 2 + 1],
      )
    }
    const idx = m.indice
    for (let k = 0; k + 2 < idx.length; k += 3) d.triangulo(idx[k], idx[k + 1], idx[k + 2])
    d.textura = m.textura
    d.horneada = m.horneada
    d.alfa = m.alfa
    return d
  })
}
