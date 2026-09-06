/**
 * PASA EL ATLAS ANATÓMICO A NUESTRO FORMATO `.pieza`.
 *
 *   npx vite-node scripts/atlas/convertir-atlas.mts -- <carpeta con atlas.json y body-*.bin>
 *
 * Entra el atlas de `ashemag/human-atlas` (BodyParts3D 4.0, CC BY 4.0) y salen
 * `public/piezas/atlas-esqueleto.pieza(.br)` y `atlas-musculos.pieza(.br)`, listos para el
 * mismo cargador que ya trae la sala del gimnasio.
 *
 * ## Por qué hace falta convertirlo y no basta con enlazarlo
 *
 * El atlas entero son 2.288.268 triángulos y **33 MB comprimidos**: sesenta veces el
 * gimnasio completo. Esqueleto y musculatura solos —lo que aquí interesa— son 994.176
 * triángulos, todavía doce veces el gimnasio. Hay que recortarlo, y ahí está el hallazgo
 * que hace posible todo esto.
 *
 * ## COSER ANTES DE RECORTAR. Es lo único que importa de este archivo.
 *
 * La malla llega **descosida**: 0,91 vértices por triángulo cuando una superficie sellada
 * tiene 0,5. Cada costura es un borde, y un simplificador por colapso de aristas **no
 * puede cerrar un borde**. Medido sobre el intercostal externo, la pieza más grande:
 *
 *   suelta  → se atasca en 20.272 triángulos **aunque le permitas un 100 % de error**
 *   cosida  → baja a 194 triángulos con un 2 % de error
 *
 * Cien veces menos, con el mismo error. Sin coser, el recorte del cuerpo entero se
 * atascaba en 350.000 triángulos y 3,5 MB hiciera lo que hiciera. Cosido:
 *
 *   recorte   triángulos   `.pieza`   brotli
 *      100 %     994.176   11,96 MB   6,92 MB
 *       25 %     248.014    3,02 MB   1,79 MB
 *       15 %     150.066    1,85 MB   1,09 MB   ← lo que se usa
 *        8 %      83.090    1,05 MB   0,61 MB
 *
 * El original ya venía simplificado por sus autores al 0,2 % de error; esto vuelve a
 * recortar encima, con un tope del 3 %, porque aquí el cuerpo se ve entero en una pantalla
 * de teléfono y no estructura a estructura a pantalla completa.
 *
 * ## Lo que NO hace
 *
 * No mueve nada. El atlas es una postura fija de un varón adulto de referencia; el sujeto
 * de `domain/patrones/` sí se contrae —el vientre engorda al acortarse—. Son dos cosas
 * distintas y conviven: esto es la anatomía cierta, aquello es el movimiento.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { brotliCompressSync, constants } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import { escribirPieza, type PartePieza } from '../../src/features/entrenar/escena/piezas3d'

/** Cuánto se conserva de cada estructura, y el error máximo que se le tolera. */
const RECORTE = 0.15
const ERROR_MAXIMO = 0.03
/** Suelo por estructura: por debajo de 24 triángulos una pieza deja de leerse como forma. */
const MINIMO_TRIANGULOS = 24

/**
 * EL ATLAS NO ESTÁ EN LA MISMA ESCALA QUE NUESTRO SUJETO, y eso no se ve venir.
 *
 * El atlas viene en metros de persona: 1,709 m de alto, de pie, con los pies en y=0. El
 * sujeto de `domain/patrones/` NO está en metros: medido sobre su esqueleto en reposo,
 * ocupa de y=−0,092 a y=0,463, o sea **0,555 m**. Son tres veces distintos y a distinta
 * altura, así que puestos uno al lado del otro sin tocar nada, del atlas solo entra el
 * tórax en el cuadro —que es exactamente lo que pasó la primera vez—.
 *
 * Por eso la escala se hornea aquí y no en la app: es una propiedad del dato, no una
 * decisión de pantalla, y hacerlo al escribir la pieza sale gratis en tiempo de dibujo.
 */
const ALTO_DEL_SUJETO = 0.555
const ALTO_DEL_ATLAS = 1.709
const ESCALA = ALTO_DEL_SUJETO / ALTO_DEL_ATLAS
/** Dónde tiene los pies el sujeto: el atlas se planta a su misma altura, no en cero. */
const SUELO_DEL_SUJETO = -0.092

const GRUPOS: Record<string, { sistemas: string[]; color: [number, number, number] }> = {
  // El hueso lleva el mismo tono que el esqueleto que ya dibuja la app, para que al
  // superponerlos no parezcan dos anatomías distintas.
  esqueleto: { sistemas: ['skeletal'], color: [0.855, 0.835, 0.783] },
  musculos: { sistemas: ['muscular'], color: [0.62, 0.24, 0.22] },
}

interface ParteDelAtlas {
  id: string
  name: string
  system: string
  chunk: number
  positions: number
  normals: number
  indices: number
  vertexCount: number
  indexCount: number
}

/**
 * Une los vértices que ocupan exactamente el mismo sitio y promedia sus normales.
 *
 * La clave es la posición en texto: son las mismas coordenadas de origen, sin operar, así
 * que la igualdad es exacta y no hace falta tolerancia. Promediar las normales además
 * suaviza la superficie, que es lo que se quiere de un músculo.
 */
function coser(pos: Float32Array, normalI16: Int16Array, indice: Uint32Array, vertices: number) {
  const mapa = new Map<string, number>()
  const nuevo = new Uint32Array(vertices)
  const p: number[] = []
  const n: number[] = []
  for (let i = 0; i < vertices; i++) {
    const clave = `${pos[i * 3]},${pos[i * 3 + 1]},${pos[i * 3 + 2]}`
    let j = mapa.get(clave)
    if (j === undefined) {
      j = p.length / 3
      mapa.set(clave, j)
      p.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])
      n.push(0, 0, 0)
    }
    nuevo[i] = j
    for (let a = 0; a < 3; a++) n[j * 3 + a] += normalI16[i * 3 + a]
  }
  const normal = new Float32Array(n.length)
  for (let i = 0; i < n.length; i += 3) {
    const largo = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1
    for (let a = 0; a < 3; a++) normal[i + a] = n[i + a] / largo
  }
  return { pos: new Float32Array(p), normal, indice: Uint32Array.from(indice, (i) => nuevo[i]) }
}

async function main() {
  const dir = process.argv[2]
  if (!dir) throw new Error('falta la carpeta del atlas (con atlas.json y body-*.bin)')

  const { MeshoptSimplifier } = await import(pathToFileURL(`${dir}/node_modules/meshoptimizer/index.js`).href)
  await MeshoptSimplifier.ready

  const manifiesto = JSON.parse(readFileSync(`${dir}/atlas.json`, 'utf8')) as {
    parts: ParteDelAtlas[]
    chunks: { url: string }[]
  }
  const trozos = manifiesto.chunks.map((_, i) => readFileSync(`${dir}/body-${i}.bin`))

  mkdirSync('public/piezas', { recursive: true })
  for (const [nombre, grupo] of Object.entries(GRUPOS)) {
    const suyas = manifiesto.parts.filter((p) => grupo.sistemas.includes(p.system))
    const salida: PartePieza[] = []
    let triOriginal = 0
    let triFinal = 0
    let errorMaximo = 0

    suyas.forEach((p, i) => {
      const b = trozos[p.chunk]
      const bruto = {
        pos: new Float32Array(b.buffer.slice(b.byteOffset + p.positions, b.byteOffset + p.positions + p.vertexCount * 12)),
        nrm: new Int16Array(b.buffer.slice(b.byteOffset + p.normals, b.byteOffset + p.normals + p.vertexCount * 6)),
        idx: new Uint32Array(b.buffer.slice(b.byteOffset + p.indices, b.byteOffset + p.indices + p.indexCount * 4)),
      }
      triOriginal += p.indexCount / 3

      const { pos, normal, indice } = coser(bruto.pos, bruto.nrm, bruto.idx, p.vertexCount)
      const objetivo = Math.max(MINIMO_TRIANGULOS * 3, Math.floor((p.indexCount * RECORTE) / 3) * 3)
      const [simplificado, error] = MeshoptSimplifier.simplify(
        indice,
        pos,
        3,
        Math.min(indice.length, objetivo),
        ERROR_MAXIMO,
      )
      errorMaximo = Math.max(errorMaximo, error)

      const [remap, cuantos] = MeshoptSimplifier.compactMesh(simplificado)
      const posicion = new Float32Array(cuantos * 3)
      const nrm = new Float32Array(cuantos * 3)
      for (let viejo = 0; viejo < remap.length; viejo++) {
        const n = remap[viejo]
        if (n === 0xffffffff) continue
        // A la escala del sujeto y a su altura. La normal no se toca: escalar por igual en
        // los tres ejes no la gira.
        posicion[n * 3] = pos[viejo * 3] * ESCALA
        posicion[n * 3 + 1] = pos[viejo * 3 + 1] * ESCALA + SUELO_DEL_SUJETO
        posicion[n * 3 + 2] = pos[viejo * 3 + 2] * ESCALA
        nrm.set(normal.subarray(viejo * 3, viejo * 3 + 3), n * 3)
      }

      // Variación de tono por estructura: dos músculos pegados con el mismo color exacto
      // se leen como uno solo. Es un ±6 %, lo justo para que se distinga el borde.
      const v = 1 + ((i * 37) % 13) / 100 - 0.06
      const color = new Float32Array(cuantos * 3)
      for (let k = 0; k < cuantos; k++) {
        color[k * 3] = grupo.color[0] * v
        color[k * 3 + 1] = grupo.color[1] * v
        color[k * 3 + 2] = grupo.color[2] * v
      }

      salida.push({
        textura: null,
        posicion,
        normal: nrm,
        color,
        uv: new Float32Array(cuantos * 2),
        indice: simplificado,
        horneada: false,
      })
      triFinal += simplificado.length / 3
    })

    const bytes = escribirPieza(salida)
    const ruta = `public/piezas/atlas-${nombre}.pieza`
    writeFileSync(ruta, Buffer.from(bytes))
    const br = brotliCompressSync(Buffer.from(bytes), {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
        [constants.BROTLI_PARAM_SIZE_HINT]: bytes.byteLength,
      },
    })
    writeFileSync(`${ruta}.br`, br)
    console.log(
      `${ruta}  ${suyas.length} estructuras · ${triOriginal.toLocaleString('es')} → ${triFinal.toLocaleString('es')} triángulos · ` +
        `${(bytes.byteLength / 1e6).toFixed(2)} MB → ${(br.length / 1e6).toFixed(2)} MB comprimida · error máx ${(errorMaximo * 100).toFixed(2)} %`,
    )
  }
}

await main()
