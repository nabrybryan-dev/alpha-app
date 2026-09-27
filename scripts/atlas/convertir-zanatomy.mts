/**
 * PASA LOS MÚSCULOS Y TENDONES DE Z-ANATOMY A `.pieza`, en el marco del atlas de la landing.
 *
 *   npx vite-node scripts/atlas/convertir-zanatomy.mts -- <carpeta export> <carpeta atlas BodyParts3D>
 *
 * Entra lo que saca `exportar_musculos.py` de Blender (Z-Anatomy, CC BY-SA 4.0, que a su
 * vez parte de BodyParts3D): un binario con cada objeto de «4: Muscular system» en
 * coordenadas de mundo de Blender —Z arriba, ~1,88 m— y un JSON con unos huesos de
 * referencia. Sale `public/piezas/landing/atlas-musculos-zanatomy.pieza(.br)`: una parte
 * por objeto, con el nombre del músculo en el campo de nombre de la parte.
 *
 * ## El tendón va en blanco
 *
 * Z-Anatomy pinta el tendón como un 2.º material («Tendon») de la misma malla del músculo,
 * y además trae tendones y aponeurosis como objetos propios. Todo vértice de una cara con
 * material «Tendon», o de un objeto cuyo nombre dice tendón/aponeurosis, sale en blanco
 * puro (255,255,255); el resto en el rojo de músculo de siempre (±6 % por estructura).
 * Para que el recorte no se coma esa frontera, se simplifica con el tendón como atributo.
 *
 * ## El encaje NO es a ojo
 *
 * Se ajusta una semejanza —rotación, escala uniforme y traslación, por mínimos cuadrados
 * (Horn/Umeyama)— entre puntos de referencia del esqueleto de Z-Anatomy y los mismos del
 * esqueleto de BodyParts3D ya convertido (`atlas-esqueleto-alta.pieza`): coronilla,
 * cabezas de fémur, rodillas, talones, hombros y los centroides de los huesos largos.
 * Así hereda exactamente el marco de la landing: Y arriba, metros, pies en y≈0, mirando a
 * +Z, lado derecho anatómico en −X.
 *
 * Coser y recortar son los de `convertir-atlas.mts` (`coser.mts` y meshoptimizer).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { brotliCompressSync, constants } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import { escribirPieza, leerPieza, type PartePieza } from '../../src/features/entrenar/escena/piezas3d'
import { puntoDeHueso, resolver } from '../../src/domain/patrones/esqueleto'
import { coser } from './coser.mts'

const SALIDA = process.env.ZA_SALIDA || 'public/piezas/landing/atlas-musculos-zanatomy.pieza'
const ESQUELETO = 'public/piezas/landing/atlas-esqueleto-alta.pieza'
const MUSCULOS_ACTUAL = 'public/piezas/landing/atlas-musculos-alta.pieza'
const OBJETIVO_TRIANGULOS = Number(process.env.ZA_TRIANGULOS || 260_000)
const ERROR_MAXIMO = 0.03
const MINIMO_TRIANGULOS = 24
const COLOR_MUSCULO: [number, number, number] = [0.62, 0.24, 0.22]

type V3 = [number, number, number]

interface ObjetoZA {
  nombre: string
  esTendon: boolean
  pos: Float32Array
  nrm: Float32Array
  tendon: Uint8Array
  idx: Uint32Array
}

function leerExport(ruta: string): ObjetoZA[] {
  const b = readFileSync(ruta)
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const out: ObjetoZA[] = []
  let p = 0
  const f32 = (n: number) => {
    const a = new Float32Array(n)
    for (let i = 0; i < n; i++) a[i] = dv.getFloat32(p + i * 4, true)
    p += n * 4
    return a
  }
  while (p < b.length) {
    const largo = dv.getUint16(p, true)
    const nombre = b.subarray(p + 2, p + 2 + largo).toString('utf8')
    p += 2 + largo
    const esTendon = dv.getUint8(p) === 1
    const nV = dv.getUint32(p + 1, true)
    const nT = dv.getUint32(p + 5, true)
    p += 9
    const pos = f32(nV * 3)
    const nrm = f32(nV * 3)
    const tendon = Uint8Array.from(b.subarray(p, p + nV))
    p += nV
    const idx = new Uint32Array(nT * 3)
    for (let i = 0; i < nT * 3; i++) idx[i] = dv.getUint32(p + i * 4, true)
    p += nT * 12
    out.push({ nombre, esTendon, pos, nrm, tendon, idx })
  }
  return out
}

/** Blender (Z arriba, mira a −Y) → provisional Y arriba mirando a +Z. Rotación propia. */
const provisional = (x: number, y: number, z: number): V3 => [x, z, -y]

// ---------------------------------------------------------------- puntos de referencia

/** Los puntos de referencia de un esqueleto ya en Y arriba, mirando a +Z, derecho en −X. */
function referencias(hueso: (nombre: string) => number[][]): Record<string, V3> {
  const centro = (vs: number[][]): V3 => {
    const c: V3 = [0, 0, 0]
    for (const v of vs) for (let k = 0; k < 3; k++) c[k] += v[k] / vs.length
    return c
  }
  const extremo = (vs: number[][], eje: number) => {
    let lo = Infinity
    let hi = -Infinity
    for (const v of vs) {
      lo = Math.min(lo, v[eje])
      hi = Math.max(hi, v[eje])
    }
    return [lo, hi]
  }
  const r: Record<string, V3> = {}
  for (const lado of ['D', 'I'] as const) {
    const femur = hueso(`femur${lado}`)
    const [fy0, fy1] = extremo(femur, 1)
    const L = fy1 - fy0
    // Cabeza de fémur: la franja alta, mitad medial (más cerca de x = 0).
    const alta = femur.filter((v) => v[1] > fy1 - 0.12 * L)
    const ax = alta.map((v) => Math.abs(v[0])).sort((a, b) => a - b)
    const med = ax[Math.floor(ax.length / 2)]
    r[`cabezaFemur${lado}`] = centro(alta.filter((v) => Math.abs(v[0]) <= med))
    // Rodilla: cóndilos (franja baja del fémur) y rótula.
    r[`condilos${lado}`] = centro(femur.filter((v) => v[1] < fy0 + 0.06 * L))
    r[`rotula${lado}`] = centro(hueso(`rotula${lado}`))
    r[`femur${lado}`] = centro(femur)
    r[`tibia${lado}`] = centro(hueso(`tibia${lado}`))
    // Talón: lo más posterior del calcáneo (z mínima, mira a +Z).
    const calc = hueso(`calcaneo${lado}`)
    const [cz0, cz1] = extremo(calc, 2)
    r[`talon${lado}`] = centro(calc.filter((v) => v[2] < cz0 + 0.15 * (cz1 - cz0)))
    r[`calcaneo${lado}`] = centro(calc)
    // Hombro: cabeza del húmero (franja alta).
    const hum = hueso(`humero${lado}`)
    const [hy0, hy1] = extremo(hum, 1)
    r[`hombro${lado}`] = centro(hum.filter((v) => v[1] > hy1 - 0.08 * (hy1 - hy0)))
    r[`humero${lado}`] = centro(hum)
    r[`clavicula${lado}`] = centro(hueso(`clavicula${lado}`))
    r[`escapula${lado}`] = centro(hueso(`escapula${lado}`))
  }
  const craneo = hueso('craneo')
  const [, cy1] = extremo(craneo, 1)
  const [cy0] = extremo(craneo, 1)
  r.coronilla = centro(craneo.filter((v) => v[1] > cy1 - 0.03 * (cy1 - cy0)))
  r.craneo = centro(craneo)
  return r
}

// ---------------------------------------------------------------- Horn / Umeyama

/** Autovector del mayor autovalor de una 4×4 simétrica (Jacobi). */
function autovectorMayor(A: number[][]): number[] {
  const a = A.map((f) => f.slice())
  const V = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => (i === j ? 1 : 0)))
  for (let barrido = 0; barrido < 100; barrido++) {
    let fuera = 0
    for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) fuera += a[p][q] ** 2
    if (fuera < 1e-22) break
    for (let p = 0; p < 4; p++)
      for (let q = p + 1; q < 4; q++) {
        if (Math.abs(a[p][q]) < 1e-30) continue
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q])
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c
        for (let k = 0; k < 4; k++) {
          const akp = a[k][p]
          const akq = a[k][q]
          a[k][p] = c * akp - s * akq
          a[k][q] = s * akp + c * akq
        }
        for (let k = 0; k < 4; k++) {
          const apk = a[p][k]
          const aqk = a[q][k]
          a[p][k] = c * apk - s * aqk
          a[q][k] = s * apk + c * aqk
        }
        for (let k = 0; k < 4; k++) {
          const vkp = V[k][p]
          const vkq = V[k][q]
          V[k][p] = c * vkp - s * vkq
          V[k][q] = s * vkp + c * vkq
        }
      }
  }
  let mejor = 0
  for (let i = 1; i < 4; i++) if (a[i][i] > a[mejor][mejor]) mejor = i
  return [0, 1, 2, 3].map((k) => V[k][mejor])
}

interface Semejanza {
  R: number[][]
  s: number
  t: V3
}

/** Semejanza de mínimos cuadrados que lleva `a` sobre `b` (Horn 1987, con escala). */
function ajustar(a: V3[], b: V3[]): Semejanza {
  const n = a.length
  const ca: V3 = [0, 0, 0]
  const cb: V3 = [0, 0, 0]
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
    ca[k] += a[i][k] / n
    cb[k] += b[i][k] / n
  }
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  let va = 0
  for (let i = 0; i < n; i++) {
    const x = [a[i][0] - ca[0], a[i][1] - ca[1], a[i][2] - ca[2]]
    const y = [b[i][0] - cb[0], b[i][1] - cb[1], b[i][2] - cb[2]]
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[r][c] += x[r] * y[c]
    va += x[0] ** 2 + x[1] ** 2 + x[2] ** 2
  }
  const [[Sxx, Sxy, Sxz], [Syx, Syy, Syz], [Szx, Szy, Szz]] = S
  const N = [
    [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
    [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
    [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
    [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz],
  ]
  const [w, x, y, z] = autovectorMayor(N)
  const R = [
    [w * w + x * x - y * y - z * z, 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), w * w - x * x + y * y - z * z, 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), w * w - x * x - y * y + z * z],
  ]
  let num = 0
  for (let i = 0; i < n; i++) {
    const xa = [a[i][0] - ca[0], a[i][1] - ca[1], a[i][2] - ca[2]]
    const ra = rotar(R, xa as V3)
    num += ra[0] * (b[i][0] - cb[0]) + ra[1] * (b[i][1] - cb[1]) + ra[2] * (b[i][2] - cb[2])
  }
  const s = num / va
  const rca = rotar(R, ca)
  return { R, s, t: [cb[0] - s * rca[0], cb[1] - s * rca[1], cb[2] - s * rca[2]] }
}

const rotar = (R: number[][], v: V3): V3 => [
  R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2],
  R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2],
  R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2],
]
const aplicar = (T: Semejanza, v: V3): V3 => {
  const r = rotar(T.R, v)
  return [T.s * r[0] + T.t[0], T.s * r[1] + T.t[1], T.s * r[2] + T.t[2]]
}

// ---------------------------------------------------------------- comprobación

/** Mediana de la distancia de cada vértice al hueso más cercano de nuestro esqueleto. */
function medianaAlHueso(posiciones: Float32Array[]): number {
  const esq = resolver({}, [0, 0, 0], [0, 0, 0])
  const segs = Object.keys(esq.largo).map((n) => ({
    a: puntoDeHueso(esq, n, 0) as number[],
    b: puntoDeHueso(esq, n, 1) as number[],
  }))
  const ds: number[] = []
  for (const pos of posiciones)
    for (let i = 0; i < pos.length; i += 3) {
      let dm = Infinity
      for (const h of segs) {
        const ab0 = h.b[0] - h.a[0], ab1 = h.b[1] - h.a[1], ab2 = h.b[2] - h.a[2]
        const ap0 = pos[i] - h.a[0], ap1 = pos[i + 1] - h.a[1], ap2 = pos[i + 2] - h.a[2]
        const l2 = ab0 * ab0 + ab1 * ab1 + ab2 * ab2 || 1e-9
        const t = Math.max(0, Math.min(1, (ap0 * ab0 + ap1 * ab1 + ap2 * ab2) / l2))
        const d = (ap0 - ab0 * t) ** 2 + (ap1 - ab1 * t) ** 2 + (ap2 - ab2 * t) ** 2
        if (d < dm) dm = d
      }
      ds.push(Math.sqrt(dm))
    }
  ds.sort((a, b) => a - b)
  return ds[Math.floor(ds.length / 2)]
}

const leer = (ruta: string) => {
  const b = readFileSync(ruta)
  return leerPieza(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
}

// ---------------------------------------------------------------- principal

async function main() {
  const [dirExport, dirAtlas] = process.argv.slice(2)
  if (!dirExport || !dirAtlas) throw new Error('uso: convertir-zanatomy.mts <carpeta export> <carpeta atlas>')
  const { MeshoptSimplifier } = await import(pathToFileURL(`${dirAtlas}/node_modules/meshoptimizer/index.js`).href)
  await MeshoptSimplifier.ready

  // --- Referencias en BodyParts3D: las partes de la pieza van en el orden del manifiesto.
  const manifiesto = JSON.parse(readFileSync(`${dirAtlas}/atlas.json`, 'utf8')) as { parts: { name: string; system: string }[] }
  const nombresHueso = manifiesto.parts.filter((p) => p.system === 'skeletal').map((p) => p.name)
  const esqueleto = leer(ESQUELETO)
  if (esqueleto.length !== nombresHueso.length) throw new Error(`esqueleto: ${esqueleto.length} partes, manifiesto ${nombresHueso.length}`)
  const verticesDe = (m: { posicion: Float32Array; vertices: number }) => {
    const out: number[][] = []
    for (let i = 0; i < m.vertices; i++) out.push([m.posicion[i * 3], m.posicion[i * 3 + 1], m.posicion[i * 3 + 2]])
    return out
  }
  const BP: Record<string, string[]> = {
    femurD: ['Right femur'], femurI: ['Left femur'], tibiaD: ['Right tibia'], tibiaI: ['Left tibia'],
    rotulaD: ['Right patella'], rotulaI: ['Left patella'], calcaneoD: ['Right calcaneus'], calcaneoI: ['Left calcaneus'],
    humeroD: ['Right humerus'], humeroI: ['Left humerus'], claviculaD: ['Right clavicle'], claviculaI: ['Left clavicle'],
    escapulaD: ['Right scapula'], escapulaI: ['Left scapula'],
    craneo: ['Right parietal bone', 'Left parietal bone', 'Frontal bone', 'Occipital bone'],
  }
  const ZA: Record<string, string[]> = {
    femurD: ['Femur.r'], femurI: ['Femur.l'], tibiaD: ['Tibia.r'], tibiaI: ['Tibia.l'],
    rotulaD: ['Patella.r'], rotulaI: ['Patella.l'], calcaneoD: ['Calcaneus.r'], calcaneoI: ['Calcaneus.l'],
    humeroD: ['Humerus.r'], humeroI: ['Humerus.l'], claviculaD: ['Clavicle.r'], claviculaI: ['Clavicle.l'],
    escapulaD: ['Scapula.r'], escapulaI: ['Scapula.l'],
    craneo: ['Parietal bone.r', 'Parietal bone.l', 'Frontal bone', 'Occipital bone'],
  }
  const refBP = referencias((n) =>
    BP[n].flatMap((nombre) => {
      const i = nombresHueso.indexOf(nombre)
      if (i < 0) throw new Error(`BodyParts3D sin ${nombre}`)
      return verticesDe(esqueleto[i])
    }),
  )
  const huesosZA = JSON.parse(readFileSync(`${dirExport}/huesos.json`, 'utf8')) as Record<string, number[][]>
  const refZA = referencias((n) =>
    ZA[n].flatMap((nombre) => {
      if (!huesosZA[nombre]) throw new Error(`Z-Anatomy sin ${nombre}`)
      return huesosZA[nombre].map((v) => provisional(v[0], v[1], v[2]))
    }),
  )
  const claves = Object.keys(refBP)
  const T = ajustar(claves.map((k) => refZA[k]), claves.map((k) => refBP[k]))
  const det =
    T.R[0][0] * (T.R[1][1] * T.R[2][2] - T.R[1][2] * T.R[2][1]) -
    T.R[0][1] * (T.R[1][0] * T.R[2][2] - T.R[1][2] * T.R[2][0]) +
    T.R[0][2] * (T.R[1][0] * T.R[2][1] - T.R[1][1] * T.R[2][0])
  const angulo = (Math.acos(Math.max(-1, Math.min(1, (T.R[0][0] + T.R[1][1] + T.R[2][2] - 1) / 2))) * 180) / Math.PI
  console.log(`encaje: escala ${T.s.toFixed(4)} · giro residual ${angulo.toFixed(2)}° · det ${det.toFixed(3)} · t [${T.t.map((v) => v.toFixed(3)).join(', ')}]`)
  let suma = 0
  for (const k of claves) {
    const p = aplicar(T, refZA[k])
    const d = Math.hypot(p[0] - refBP[k][0], p[1] - refBP[k][1], p[2] - refBP[k][2])
    suma += d * d
    console.log(`  ${k.padEnd(14)} ${(d * 100).toFixed(1)} cm`)
  }
  console.log(`  RMS ${((Math.sqrt(suma / claves.length)) * 100).toFixed(2)} cm sobre ${claves.length} referencias`)

  // --- Músculos: coser, llevar al marco, recortar.
  const objetos = leerExport(`${dirExport}/musculos.bin`)
  const preparados = objetos.map((o) => {
    const nV = o.pos.length / 3
    const c = coser(o.pos, o.nrm, o.idx, nV)
    // coser renumera: el tendón de cada vértice nuevo es el OR de los que se juntaron.
    const tend = new Uint8Array(c.pos.length / 3)
    for (let i = 0; i < o.idx.length; i++) if (o.tendon[o.idx[i]]) tend[c.indice[i]] = 1
    if (o.esTendon) tend.fill(1)
    const pos = new Float32Array(c.pos.length)
    const nrm = new Float32Array(c.pos.length)
    for (let v = 0; v < pos.length; v += 3) {
      const p = aplicar(T, provisional(c.pos[v], c.pos[v + 1], c.pos[v + 2]))
      const n = rotar(T.R, provisional(c.normal[v], c.normal[v + 1], c.normal[v + 2]))
      pos.set(p, v)
      nrm.set(n, v)
    }
    return { nombre: o.nombre, pos, nrm, tend, idx: c.indice }
  })
  const triBruto = preparados.reduce((s, p) => s + p.idx.length / 3, 0)

  const recortar = (proporcion: number) => {
    let tri = 0
    let err = 0
    const res = preparados.map((p) => {
      const objetivo = Math.max(MINIMO_TRIANGULOS * 3, Math.floor((p.idx.length * proporcion) / 3) * 3)
      const attr = Float32Array.from(p.tend)
      const [ind, e] = MeshoptSimplifier.simplifyWithAttributes(
        p.idx, p.pos, 3, attr, 1, [0.5], null, Math.min(p.idx.length, objetivo), ERROR_MAXIMO,
      )
      tri += ind.length / 3
      err = Math.max(err, e)
      return ind as Uint32Array
    })
    return { res, tri, err }
  }
  let proporcion = OBJETIVO_TRIANGULOS / triBruto
  let r = recortar(proporcion)
  for (let i = 0; i < 6 && Math.abs(r.tri - OBJETIVO_TRIANGULOS) / OBJETIVO_TRIANGULOS > 0.01; i++) {
    proporcion *= OBJETIVO_TRIANGULOS / r.tri
    r = recortar(proporcion)
    console.log(`  recorte ${(proporcion * 100).toFixed(2)} % → ${r.tri.toLocaleString('es')} triángulos`)
  }

  const salida: PartePieza[] = []
  let vTend = 0
  let vTotal = 0
  let yMin = Infinity
  let yMax = -Infinity
  preparados.forEach((p, i) => {
    const simplificado = r.res[i]
    const [remap, cuantos] = MeshoptSimplifier.compactMesh(simplificado)
    const posicion = new Float32Array(cuantos * 3)
    const normal = new Float32Array(cuantos * 3)
    const color = new Float32Array(cuantos * 3)
    const v = 1 + ((i * 37) % 13) / 100 - 0.06
    for (let viejo = 0; viejo < remap.length; viejo++) {
      const n = remap[viejo]
      if (n === 0xffffffff) continue
      for (let k = 0; k < 3; k++) {
        posicion[n * 3 + k] = p.pos[viejo * 3 + k]
        normal[n * 3 + k] = p.nrm[viejo * 3 + k]
      }
      const blanco = p.tend[viejo] === 1
      for (let k = 0; k < 3; k++) color[n * 3 + k] = blanco ? 1 : COLOR_MUSCULO[k] * v
      if (blanco) vTend++
      yMin = Math.min(yMin, posicion[n * 3 + 1])
      yMax = Math.max(yMax, posicion[n * 3 + 1])
    }
    vTotal += cuantos
    salida.push({
      textura: p.nombre,
      posicion,
      normal,
      color,
      uv: new Float32Array(cuantos * 2),
      indice: simplificado,
      horneada: false,
    })
  })

  const bytes = escribirPieza(salida)
  writeFileSync(SALIDA, Buffer.from(bytes))
  const br = brotliCompressSync(Buffer.from(bytes), {
    params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY, [constants.BROTLI_PARAM_SIZE_HINT]: bytes.byteLength },
  })
  writeFileSync(`${SALIDA}.br`, br)
  console.log(
    `${SALIDA}  ${salida.length} piezas · ${triBruto.toLocaleString('es')} → ${r.tri.toLocaleString('es')} triángulos · ` +
      `${(bytes.byteLength / 1e6).toFixed(2)} MB → ${(br.length / 1e6).toFixed(2)} MB comprimida · error máx ${(r.err * 100).toFixed(2)} %`,
  )

  // --- Comprobaciones, sobre la pieza RELEÍDA (lo que verá la app, ya cuantizado).
  const nueva = leer(SALIDA)
  let blancos = 0
  let total = 0
  let alto0 = Infinity
  let alto1 = -Infinity
  for (const m of nueva) {
    for (let i = 0; i < m.vertices; i++) {
      total++
      if (m.color[i * 3] === 1 && m.color[i * 3 + 1] === 1 && m.color[i * 3 + 2] === 1) blancos++
      alto0 = Math.min(alto0, m.posicion[i * 3 + 1])
      alto1 = Math.max(alto1, m.posicion[i * 3 + 1])
    }
  }
  const actual = leer(MUSCULOS_ACTUAL)
  let a0 = Infinity
  let a1 = -Infinity
  for (const m of actual) for (let i = 0; i < m.vertices; i++) {
    a0 = Math.min(a0, m.posicion[i * 3 + 1])
    a1 = Math.max(a1, m.posicion[i * 3 + 1])
  }
  const pos = (ms: typeof nueva) => ms.map((m) => m.posicion.slice(0, m.vertices * 3))
  console.log(`alto nueva: ${alto0.toFixed(3)} → ${alto1.toFixed(3)} m (alto ${(alto1 - Math.max(0, alto0)).toFixed(3)}) · actual ${a0.toFixed(3)} → ${a1.toFixed(3)} m`)
  console.log(`tendón: ${blancos}/${total} vértices = ${((blancos / total) * 100).toFixed(1)} % (antes de cuantizar ${((vTend / vTotal) * 100).toFixed(1)} %)`)
  console.log(`nombres: ${nueva.filter((m) => m.textura).length}/${nueva.length} partes con nombre; p.ej. «${nueva[0].textura}»`)
  console.log(`mediana al hueso: nueva ${(medianaAlHueso(pos(nueva)) * 100).toFixed(2)} cm · actual ${(medianaAlHueso(pos(actual)) * 100).toFixed(2)} cm`)
  void yMin
  void yMax
}

await main()
