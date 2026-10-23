import type { Banda, Cifra } from './contrato'
import { noAfirmable } from './contrato'
import { VERSION_DEL_MODELO } from './convenciones'
import { DE_LEVA_CERV, type ParametrosDeSegmento, type Segmento } from './deleva'
import {
  geometriaSagital,
  momentosDeSentadilla,
  momentosEstaticos,
  type EntradaDeSentadilla,
  type MomentosEstaticos,
  type PoseSagital,
} from './dinamica'
import { construirSujeto, type Sujeto } from './sujeto'

/**
 * BANDAS POR MONTE CARLO (fase 3).
 *
 * Plano y unidades: los de `dinamica.ts` (sagital, N·m).
 *
 * Qué hace: repite el cálculo de los momentos estáticos muchas veces, perturbando cada vez las
 * entradas inciertas con una normal de desviación dada, y devuelve el percentil 5 al 95 de
 * cada momento. El valor central NO es la media de las muestras: es el cálculo sin perturbar
 * (el de la fase 2), de modo que el valor y la banda cuentan lo mismo.
 *
 * Qué NO hace: no decide cuánta incertidumbre hay. Las desviaciones son ENTRADA (`Incertidumbre`)
 * porque la tabla de de Leva que se leyó no publica dispersión, y un valor por defecto aquí sería
 * una cifra inventada. Quien llama (o Bryan, al firmar la regla) las fija; sin ellas no hay banda.
 *
 * Componentes, todas desviaciones típicas absolutas salvo `proporciones`:
 *   talla (m) · masa (kg) · proporciones (relativa: 0,05 = 5 % sobre la masa y el CM de cada
 *   segmento, independiente por segmento, con la MASA TOTAL conservada) · angulo (rad, a cada
 *   ángulo de la pose) · carga (kg).
 *
 * Reproducible: PRNG con semilla (mulberry32). Misma semilla y mismas entradas, mismo resultado.
 */

export interface Incertidumbre {
  talla: number
  masa: number
  proporciones: number
  angulo: number
  carga: number
}

export const SIN_INCERTIDUMBRE: Incertidumbre = { talla: 0, masa: 0, proporciones: 0, angulo: 0, carga: 0 }

export interface OpcionesDeBanda {
  muestras?: number
  semilla?: number
}

/** PRNG pequeño y determinista (mulberry32). */
export function crearAzar(semilla: number): () => number {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Normal estándar por Box-Muller. Consume dos uniformes por llamada, siempre, para que el orden no dependa del valor. */
export function normal(azar: () => number): number {
  const u1 = Math.max(azar(), 1e-300)
  const u2 = azar()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

const PARES = new Set<string>(['brazo', 'antebrazo', 'mano', 'muslo', 'tibia', 'pie'])
/** Los segmentos que entran en el cálculo de la sentadilla con su fracción de masa. */
const USADOS: readonly Segmento[] = ['brazo', 'antebrazo', 'mano', 'muslo', 'tibia', 'pie']

/**
 * Perturba las proporciones: cada masa y cada CM se multiplica por (1 + rel·N). Después las masas
 * se reescalan para que la suma (pares dos veces) sea la de antes: la masa del cuerpo se midió, lo
 * incierto es cómo se reparte. Devuelve el sujeto y los parámetros de cabeza y tronco perturbados.
 */
export function perturbarProporciones(
  s: Sujeto,
  rel: number,
  azar: () => number,
): { sujeto: Sujeto; cerv: Record<'cabeza' | 'tronco', ParametrosDeSegmento> } | null {
  const base = DE_LEVA_CERV[s.sexo]
  const factor = () => 1 + rel * normal(azar)
  const segmentos = { ...s.segmentos }
  const nuevaMasa: Record<string, number> = {}
  const nuevoCm: Record<string, number> = {}
  for (const n of USADOS) {
    nuevaMasa[n] = s.segmentos[n].masa * factor()
    nuevoCm[n] = Math.min(0.99, Math.max(0.01, s.segmentos[n].cm * factor()))
  }
  for (const n of ['cabeza', 'tronco'] as const) {
    nuevaMasa[n] = base[n].masa * factor()
    nuevoCm[n] = Math.min(0.99, Math.max(0.01, base[n].cm * factor()))
  }
  const peso = (n: string) => (PARES.has(n) ? 2 : 1)
  const antes = [...USADOS, 'cabeza', 'tronco'].reduce(
    (t, n) => t + peso(n) * (n === 'cabeza' || n === 'tronco' ? base[n as 'cabeza'].masa : s.segmentos[n as Segmento].masa),
    0,
  )
  const despues = [...USADOS, 'cabeza', 'tronco'].reduce((t, n) => t + peso(n) * nuevaMasa[n], 0)
  const k = antes / despues
  if (!Number.isFinite(k) || [...USADOS, 'cabeza', 'tronco'].some((n) => !(nuevaMasa[n] > 0))) return null
  for (const n of USADOS) {
    const masa = nuevaMasa[n] * k
    segmentos[n] = { ...s.segmentos[n], masa, cm: nuevoCm[n], masaKg: masa * s.masa }
  }
  return {
    sujeto: { ...s, segmentos },
    cerv: {
      cabeza: { ...base.cabeza, masa: nuevaMasa.cabeza * k, cm: nuevoCm.cabeza },
      tronco: { ...base.tronco, masa: nuevaMasa.tronco * k, cm: nuevoCm.tronco },
    },
  }
}

/** Una muestra de momentos con las entradas perturbadas. */
export function muestraDeMomentos(e: EntradaDeSentadilla, u: Incertidumbre, azar: () => number): MomentosEstaticos | null {
  const pose = e.pose as PoseSagital
  if (!Number.isFinite(e.cargaKg)) return null
  const talla = (e.talla as number) + u.talla * normal(azar)
  const masa = (e.masa as number) + u.masa * normal(azar)
  const base = construirSujeto({ sexo: e.sexo, talla, masa })
  if (!base) return null
  const perturbado = perturbarProporciones(base, u.proporciones, azar)
  if (!perturbado) return null
  const { sujeto, cerv } = perturbado
  const a = (x: number) => x + u.angulo * normal(azar)
  const p: PoseSagital = {
    tibia: a(pose.tibia),
    muslo: a(pose.muslo),
    tronco: a(pose.tronco),
    cabeza: a(pose.cabeza),
    barraT: pose.barraT,
    pieZ: pose.pieZ,
  }
  const carga = Math.max(0, (e.cargaKg as number) + u.carga * normal(azar))
  return momentosEstaticos(geometriaSagital(sujeto, carga, p, cerv))
}

export const NIVEL_P5_P95 = 'percentil 5 a 95 del Monte Carlo'
export const NIVEL_ENSANCHADO = 'percentil 5 a 95 del Monte Carlo, ensanchado hasta incluir el valor central'
export const NIVEL_SIN_DISPERSION = 'ancho cero: las entradas no tienen incertidumbre, no hay dispersión que medir'

/**
 * Banda p5-p95 de unas muestras ordenadas, con el valor central DENTRO (un modelo asimétrico puede dejarlo
 * fuera) y el `nivel` diciendo la verdad: si hubo que ensanchar para incluirlo ya no es un p5-p95 puro, y
 * si no hay ancho no es un intervalo de nada (B-1 y B-2 de la revisión de Opus).
 */
export function bandaP5P95(ordenados: number[], valor: number): Banda {
  const p5 = percentil(ordenados, 0.05)
  const p95 = percentil(ordenados, 0.95)
  const inf = Math.min(p5, valor)
  const sup = Math.max(p95, valor)
  const nivel = sup === inf ? NIVEL_SIN_DISPERSION : inf !== p5 || sup !== p95 ? NIVEL_ENSANCHADO : NIVEL_P5_P95
  return { inf, sup, nivel }
}

export function percentil(ordenados: number[], q: number): number {
  const i = (ordenados.length - 1) * q
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return ordenados[lo] + (ordenados[hi] - ordenados[lo]) * (i - lo)
}

export interface MuestrasDeMomentos {
  tobillo: number[]
  rodilla: number[]
  cadera: number[]
  descartadas: number
}

export function muestrear(
  e: EntradaDeSentadilla,
  u: Incertidumbre,
  { muestras = 2000, semilla = 20261020 }: OpcionesDeBanda = {},
): MuestrasDeMomentos {
  if (!Number.isInteger(muestras) || muestras < 1) throw new RangeError('muestras debe ser un entero >= 1')
  const azar = crearAzar(semilla)
  const salida: MuestrasDeMomentos = { tobillo: [], rodilla: [], cadera: [], descartadas: 0 }
  for (let i = 0; i < muestras; i++) {
    const m = muestraDeMomentos(e, u, azar)
    if (!m) {
      salida.descartadas++
      continue
    }
    salida.tobillo.push(m.tobillo)
    salida.rodilla.push(m.rodilla)
    salida.cadera.push(m.cadera)
  }
  return salida
}

const SUPUESTOS_DE_BANDA = (u: Incertidumbre, n: number, semilla: number) => [
  `Monte Carlo de ${n} muestras, semilla ${semilla}, normales independientes`,
  `desviaciones: talla ${u.talla} m, masa ${u.masa} kg, proporciones ${u.proporciones} (relativa), ángulos ${u.angulo} rad, carga ${u.carga} kg`,
  'las desviaciones las fija quien llama: de Leva no publica dispersión en la tabla leída',
]

export function bandasDeSentadilla(
  e: EntradaDeSentadilla,
  u: Incertidumbre,
  opciones: OpcionesDeBanda = {},
): { tobillo: Cifra; rodilla: Cifra; cadera: Cifra } {
  const v = VERSION_DEL_MODELO
  const central = momentosDeSentadilla(e)
  const faltante = (id: string, motivo: string) => noAfirmable(id, 'N·m', motivo, v)
  if (central.cadera.valor === null) {
    const motivo = central.cadera.motivo ?? 'sin dato'
    return {
      tobillo: faltante('sentadilla.momento.tobillo', motivo),
      rodilla: faltante('sentadilla.momento.rodilla', motivo),
      cadera: faltante('sentadilla.momento.cadera', motivo),
    }
  }
  const n = opciones.muestras ?? 2000
  if (!Number.isInteger(n) || n < 1) throw new RangeError('muestras debe ser un entero >= 1')
  const semilla = opciones.semilla ?? 20261020
  const m = muestrear(e, u, opciones)
  const armar = (articulacion: 'tobillo' | 'rodilla' | 'cadera'): Cifra => {
    const c = central[articulacion]
    const datos = m[articulacion]
    if (datos.length < n * 0.9) {
      return faltante(c.id, `${m.descartadas} de ${n} muestras cayeron fuera de rango: la incertidumbre pedida rompe el modelo`)
    }
    const orden = [...datos].sort((x, y) => x - y)
    const banda: Banda = bandaP5P95(orden, c.valor as number)
    return { ...c, estado: 'estimado', banda, supuestos: [...c.supuestos, ...SUPUESTOS_DE_BANDA(u, n, semilla)] }
  }
  return { tobillo: armar('tobillo'), rodilla: armar('rodilla'), cadera: armar('cadera') }
}
