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
import { puntoDeHueso, resolver } from '../../src/domain/patrones/esqueleto'
import { esqueletoDe, type Sexo } from '../../src/domain/patrones/juegoDeHuesos'

/** Cuánto se conserva de cada estructura, y el error máximo que se le tolera. */
const RECORTE = 0.15
const ERROR_MAXIMO = 0.03
/** Suelo por estructura: por debajo de 24 triángulos una pieza deja de leerse como forma. */
const MINIMO_TRIANGULOS = 24

/**
 * EL ENCAJE CON NUESTRO SUJETO, hueso por hueso.
 *
 * Los dos miden lo mismo —el atlas va de 0,005 a 1,714 y nuestro esqueleto de 0,076 a
 * 1,690— así que NO hay que escalar nada. (Un rato creí que sí: medí `construirHuesos()`,
 * que dibuja en el espacio LOCAL de cada hueso, y tomé aquellos números por la estatura.
 * La altura la pone la matriz del hueso, no la malla.)
 *
 * Lo que sí baila son las proporciones, y medidas contra los huesos largos del atlas —que
 * traen su nombre— resulta que casi todo encaja ya:
 *
 *   hombro  1,415 → 1,412   (3 mm)
 *   codo    1,110 → 1,104   (6 mm)
 *   tobillo 0,072 → 0,076   (4 mm)
 *   muñeca  0,884 → 0,846   (3,8 cm)
 *   cadera  0,912 → 0,955   (4,3 cm)
 *   rodilla 0,449 → 0,505   (5,6 cm)
 *
 * O sea: el tronco y el brazo ya coinciden, y lo que no coincide es que **nuestro sujeto
 * tiene las piernas más cortas** y la mano más larga. Así que en vez de escalar el cuerpo
 * entero se estira por TRAMOS entre esos puntos: cada altura del atlas se lleva a la
 * altura que le toca en nuestro esqueleto, interpolando entre referencias. Es continuo por
 * construcción —no hay saltos ni costuras, que es lo que pasaría atando cada hueso por su
 * cuenta— y respeta la anatomía dentro de cada tramo.
 *
 * El brazo va con su propia lista porque cuelga: a la altura de la cadera hay a la vez
 * pelvis y muñeca, y cada una tiene que ir a un sitio distinto. Con una sola lista, mover
 * la cadera arrastraría la muñeca.
 *
 * Las referencias NO están escritas a mano: salen de los huesos largos del atlas por su
 * nombre (fémur, tibia, húmero, radio, calcáneo) y de `puntoDeHueso()` en el nuestro. Si
 * cambia cualquiera de los dos esqueletos, esto se recalcula solo.
 */

/** Una referencia: la misma articulación en los dos cuerpos. */
type Referencia = { atlas: number; nuestro: number }

/** Interpola por tramos: fuera del rango, traslada con la pendiente del tramo extremo. */
function estirar(y: number, refs: Referencia[]): number {
  if (y <= refs[0].atlas) return refs[0].nuestro + (y - refs[0].atlas)
  for (let i = 1; i < refs.length; i++) {
    if (y <= refs[i].atlas) {
      const a = refs[i - 1]
      const b = refs[i]
      const t = (y - a.atlas) / (b.atlas - a.atlas || 1e-9)
      return a.nuestro + t * (b.nuestro - a.nuestro)
    }
  }
  const u = refs[refs.length - 1]
  return u.nuestro + (y - u.atlas)
}

/** Cuánto estira el tramo donde cae esa altura: hace falta para corregir la normal. */
function pendiente(y: number, refs: Referencia[]): number {
  for (let i = 1; i < refs.length; i++) {
    if (y <= refs[i].atlas) {
      const a = refs[i - 1]
      const b = refs[i]
      return (b.nuestro - a.nuestro) / (b.atlas - a.atlas || 1e-9)
    }
  }
  return 1
}

const DEL_BRAZO = new Set(['brazoD', 'brazoI', 'antebrazoD', 'antebrazoI', 'manoD', 'manoI'])

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

/** Un grupo de estructuras que sale como una pieza: por sistema anatómico o por nombre exacto. */
interface Grupo {
  sistemas?: string[]
  nombres?: string[]
  color: [number, number, number]
  /** Cuánto se conserva. Una piel es UNA superficie grande y aguanta menos recorte que un hueso. */
  recorte: number
  /**
   * Si los brazos se cuelgan al lado del cuerpo. El atlas femenino viene en posición
   * anatómica —brazos abiertos unos 18°— y nuestro sujeto los lleva colgando a 7°. Sin
   * esto, la piel del brazo queda fuera del brazo.
   */
  colgarBrazos?: boolean
}

/**
 * DOS FUENTES, y no son simétricas. Es la primera cosa que hay que saber del femenino.
 *
 * El masculino (BodyParts3D) trae 296 huesos y 402 músculos con nombre. El femenino
 * (Human Reference Atlas, HuBMAP) trae órganos y **una piel entera**, pero de músculos
 * solo tiene 16 —y son los del ojo— y de esqueleto 91 piezas que son la columna y las dos
 * rodillas: sin cráneo, sin costillas, sin brazos, sin pies. Medido el 2026-09-06 sobre su
 * manifiesto. Así que del femenino sale UNA pieza, la piel, y no un esqueleto que sería
 * una columna con dos rodillas flotando.
 */
const FUENTES: Record<string, { manifiesto: string; prefijo: string; sexo: Sexo; grupos: Record<string, Grupo> }> = {
  masculino: {
    manifiesto: 'atlas.json',
    prefijo: 'body',
    sexo: 'hombre',
    grupos: {
      // El hueso lleva el mismo tono que el esqueleto que ya dibuja la app, para que al
      // superponerlos no parezcan dos anatomías distintas.
      esqueleto: { sistemas: ['skeletal'], color: [0.855, 0.835, 0.783], recorte: 0.15 },
      musculos: { sistemas: ['muscular'], color: [0.62, 0.24, 0.22], recorte: 0.15 },
    },
  },
  femenino: {
    manifiesto: 'atlas-female.json',
    prefijo: 'female',
    sexo: 'mujer',
    grupos: {
      // Solo la superficie. Las otras 16 piezas «integumentary» son tejido interno de la
      // mama (lóbulos, conductos), que no es piel ni se ve desde fuera.
      piel: { nombres: ['skin of body'], color: [0.72, 0.6, 0.53], recorte: 0.3, colgarBrazos: true },
    },
  },
}

interface Manifiesto {
  parts: ParteDelAtlas[]
  chunks: { url: string }[]
}

/** Interpolación suave entre 0 y 1: para que el giro del brazo no arranque la axila. */
function suave(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

async function main() {
  const dir = process.argv[2]
  if (!dir) throw new Error('falta la carpeta del atlas (con atlas.json, atlas-female.json y los .bin)')

  const { MeshoptSimplifier } = await import(pathToFileURL(`${dir}/node_modules/meshoptimizer/index.js`).href)
  await MeshoptSimplifier.ready

  mkdirSync('public/piezas', { recursive: true })

  for (const [sexo, fuente] of Object.entries(FUENTES)) {
    // NUESTRO esqueleto en reposo, para sacar de él las alturas de referencia.
    // Cada atlas se encaja contra el juego de huesos de SU sexo: el masculino contra el
    // varón —que desde el 2026-09-06 es el defecto y tiene sus mismas medidas, así que el
    // estirado sale casi nulo— y la piel femenina contra la mujer.
    const definicion = esqueletoDe(fuente.sexo)
    const esq = resolver({}, [0, 0, 0], [0, 0, 0], definicion)
    const huesos = definicion.map((h) => ({
      nombre: h.nombre,
      a: puntoDeHueso(esq, h.nombre, 0) as number[],
      b: puntoDeHueso(esq, h.nombre, 1) as number[],
    }))
    const punto = (n: string, extremo: 0 | 1) => huesos.find((h) => h.nombre === n)![extremo === 0 ? 'a' : 'b']
    const nuestro = (n: string, extremo: 0 | 1) => punto(n, extremo)[1]

    /** A qué hueso nuestro pertenece una estructura: el segmento más cercano a su centro. */
    const huesoDe = (p: ParteDelAtlas) => {
      const c = p.bounds[0].map((v, k) => (v + p.bounds[1][k]) / 2)
      let mejor = huesos[0].nombre
      let dm = Infinity
      for (const h of huesos) {
        const ab = [h.b[0] - h.a[0], h.b[1] - h.a[1], h.b[2] - h.a[2]]
        const ap = [c[0] - h.a[0], c[1] - h.a[1], c[2] - h.a[2]]
        const l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1e-9
        const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / l2))
        const d = Math.hypot(c[0] - (h.a[0] + ab[0] * t), c[1] - (h.a[1] + ab[1] * t), c[2] - (h.a[2] + ab[2] * t))
        if (d < dm) {
          dm = d
          mejor = h.nombre
        }
      }
      return mejor
    }

    const manifiesto = JSON.parse(readFileSync(`${dir}/${fuente.manifiesto}`, 'utf8')) as Manifiesto
    const trozos = manifiesto.chunks.map((_, i) => readFileSync(`${dir}/${fuente.prefijo}-${i}.bin`))

    // Las referencias del ATLAS, de sus huesos largos por su nombre. Fémur y tibia son
    // obligatorios —sin ellos no hay encaje y se para: una referencia inventada movería el
    // cuerpo entero sin que nadie lo notara—. Los del brazo y el calcáneo son opcionales
    // porque el femenino no los trae: entonces el suelo es lo más bajo de la pieza y la
    // coronilla lo más alto.
    const caja = (re: RegExp) => {
      const suyas = manifiesto.parts.filter((p) => re.test(p.name))
      if (suyas.length === 0) return null
      return {
        abajo: Math.min(...suyas.map((p) => p.bounds[0][1])),
        arriba: Math.max(...suyas.map((p) => p.bounds[1][1])),
      }
    }
    const femur = caja(/^(Right|Left) femur$/)
    const tibia = caja(/^(Right|Left) tibia$/)
    if (!femur || !tibia) throw new Error(`${sexo}: sin fémur o tibia en el atlas no puedo encajarlo`)
    const humero = caja(/^(Right|Left) humerus$/)
    const radio = caja(/^(Right|Left) radius$/)
    const calcaneo = caja(/^(Right|Left) calcaneus$/)
    const todas = manifiesto.parts
    const suelo = calcaneo?.abajo ?? Math.min(...todas.map((p) => p.bounds[0][1]))
    const coronilla = Math.max(...todas.map((p) => p.bounds[1][1]))

    const DEL_CUERPO: Referencia[] = [
      { atlas: suelo, nuestro: 0 },
      { atlas: tibia.abajo, nuestro: nuestro('tibiaD', 1) },
      { atlas: (femur.abajo + tibia.arriba) / 2, nuestro: nuestro('musloD', 1) },
      { atlas: femur.arriba, nuestro: nuestro('musloD', 0) },
      humero
        ? { atlas: humero.arriba, nuestro: nuestro('brazoD', 0) }
        : { atlas: coronilla, nuestro: nuestro('craneo', 1) },
    ]
    const DEL_BRAZO_REFS: Referencia[] | null =
      humero && radio
        ? [
            { atlas: radio.abajo, nuestro: nuestro('manoD', 0) },
            { atlas: (radio.arriba + humero.abajo) / 2, nuestro: nuestro('antebrazoD', 0) },
            { atlas: humero.arriba, nuestro: nuestro('brazoD', 0) },
          ]
        : null
    console.log(`[${sexo}] referencias del cuerpo:`, DEL_CUERPO.map((r) => `${r.atlas.toFixed(3)}→${r.nuestro.toFixed(3)}`).join('  '))
    if (DEL_BRAZO_REFS) console.log(`[${sexo}] referencias del brazo :`, DEL_BRAZO_REFS.map((r) => `${r.atlas.toFixed(3)}→${r.nuestro.toFixed(3)}`).join('  '))

    for (const [nombre, grupo] of Object.entries(fuente.grupos)) {
      const suyas = manifiesto.parts.filter((p) =>
        grupo.sistemas ? grupo.sistemas.includes(p.system) : (grupo.nombres ?? []).includes(p.name),
      )
      if (suyas.length === 0) throw new Error(`${sexo}/${nombre}: no hay estructuras que exportar`)
      const salida: PartePieza[] = []
      let triOriginal = 0
      let triFinal = 0
      let errorMaximo = 0

      suyas.forEach((p, i) => {
        const refs = DEL_BRAZO_REFS && DEL_BRAZO.has(huesoDe(p)) ? DEL_BRAZO_REFS : DEL_CUERPO
        const b = trozos[p.chunk]
        const bruto = {
          pos: new Float32Array(b.buffer.slice(b.byteOffset + p.positions, b.byteOffset + p.positions + p.vertexCount * 12)),
          nrm: new Int16Array(b.buffer.slice(b.byteOffset + p.normals, b.byteOffset + p.normals + p.vertexCount * 6)),
          idx: new Uint32Array(b.buffer.slice(b.byteOffset + p.indices, b.byteOffset + p.indices + p.indexCount * 4)),
        }
        triOriginal += p.indexCount / 3

        const { pos, normal, indice } = coser(bruto.pos, bruto.nrm, bruto.idx, p.vertexCount)

        // COLGAR LOS BRAZOS. Se mide el ángulo del brazo de la piel a la altura de la
        // muñeca y se gira lo que haga falta alrededor del hombro, con un peso que crece
        // con la distancia al hombro: en la axila no se mueve nada, en la mano gira entero.
        // Es lo que impide que el giro arranque la piel del costado.
        if (grupo.colgarBrazos) {
          const yMuneca = nuestro('manoD', 0)
          for (const lado of [-1, 1]) {
            const hombro = punto(lado < 0 ? 'brazoD' : 'brazoI', 0)
            const mano = punto(lado < 0 ? 'manoD' : 'manoI', 0)
            let sx = 0
            let n = 0
            for (let v = 0; v < pos.length; v += 3) {
              if (pos[v] * lado > 0.17 && Math.abs(pos[v + 1] - yMuneca) < 0.02) {
                sx += pos[v]
                n++
              }
            }
            if (n === 0) continue
            const anguloAtlas = Math.atan2((sx / n - hombro[0]) * lado, hombro[1] - yMuneca)
            const anguloNuestro = Math.atan2((mano[0] - hombro[0]) * lado, hombro[1] - mano[1])
            const giro = (anguloNuestro - anguloAtlas) * lado
            for (let v = 0; v < pos.length; v += 3) {
              if (pos[v] * lado < 0.17 || pos[v + 1] > hombro[1] + 0.02) continue
              const dx = pos[v] - hombro[0]
              const dy = pos[v + 1] - hombro[1]
              const peso = suave((Math.hypot(dx, dy) - 0.1) / 0.15)
              const a = giro * peso
              const c = Math.cos(a)
              const s = Math.sin(a)
              pos[v] = hombro[0] + dx * c - dy * s
              pos[v + 1] = hombro[1] + dx * s + dy * c
              const nx = normal[v]
              const ny = normal[v + 1]
              normal[v] = nx * c - ny * s
              normal[v + 1] = nx * s + ny * c
            }
          }
        }

        const objetivo = Math.max(MINIMO_TRIANGULOS * 3, Math.floor((p.indexCount * grupo.recorte) / 3) * 3)
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
          // La altura se lleva a la de nuestro esqueleto; el ancho y el fondo no se tocan:
          // los dos cuerpos ya coinciden en eso y estirarlos sería deformar la anatomía.
          const y = pos[viejo * 3 + 1]
          posicion[n * 3] = pos[viejo * 3]
          posicion[n * 3 + 1] = estirar(y, refs)
          posicion[n * 3 + 2] = pos[viejo * 3 + 2]
          // La normal se corrige por el estirado: al comprimir en Y, la normal se inclina al
          // revés —dividiendo, no multiplicando— o la luz delataría un muslo aplastado.
          const k = pendiente(y, refs) || 1
          const nx = normal[viejo * 3]
          const ny = normal[viejo * 3 + 1] / k
          const nz = normal[viejo * 3 + 2]
          const largoN = Math.hypot(nx, ny, nz) || 1
          nrm[n * 3] = nx / largoN
          nrm[n * 3 + 1] = ny / largoN
          nrm[n * 3 + 2] = nz / largoN
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
}

await main()
