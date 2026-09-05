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
 * Versión 2 añade, después del nombre de textura, un `u32` de banderas: el bit 0 dice si
 * la luz viene grabada en el color (`horneada`). La versión 1 se sigue leyendo —sin
 * banderas, todo a cero— para no invalidar las piezas ya exportadas.
 */
const VERSION = 2
const BANDERA_HORNEADA = 1

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
  if (version !== 1 && version !== VERSION) {
    throw new Error(`versión de pieza ${version}; se esperaba ${VERSION}`)
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
    const posicion = f32(nV * 3)
    const normal = f32(nV * 3)
    const color = f32(nV * 3)
    const uv = f32(nV * 2)
    const indice = new Uint32Array(bytes, pos, nI)
    pos += nI * 4

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
  let total = 8
  for (let i = 0; i < partes.length; i++) {
    const p = partes[i]
    total += 2 + nombres[i].length + relleno(2 + nombres[i].length) + 4 + 8
    total += (p.posicion.length + p.normal.length + p.color.length + p.uv.length + p.indice.length) * 4
  }
  const bytes = new ArrayBuffer(total)
  const vista = new DataView(bytes)
  const octetos = new Uint8Array(bytes)
  for (let i = 0; i < 4; i++) vista.setUint8(i, MAGIA.charCodeAt(i))
  vista.setUint16(4, VERSION, true)
  vista.setUint16(6, partes.length, true)
  let pos = 8
  const meter = (a: Float32Array | Uint32Array) => {
    octetos.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), pos)
    pos += a.byteLength
  }
  for (let i = 0; i < partes.length; i++) {
    const p = partes[i]
    vista.setUint16(pos, nombres[i].length, true)
    octetos.set(nombres[i], pos + 2)
    pos += 2 + nombres[i].length + relleno(2 + nombres[i].length)
    vista.setUint32(pos, p.horneada ? BANDERA_HORNEADA : 0, true)
    pos += 4
    vista.setUint32(pos, p.posicion.length / 3, true)
    vista.setUint32(pos + 4, p.indice.length, true)
    pos += 8
    meter(p.posicion)
    meter(p.normal)
    meter(p.color)
    meter(p.uv)
    meter(p.indice)
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
