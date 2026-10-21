import { crearAzar, normal } from './bandas'
import { noAfirmable, type Cifra } from './contrato'
import { VERSION_DEL_MODELO } from './convenciones'

/**
 * REPARTO DE UN MOMENTO ENTRE MÚSCULOS (M5, fase 4), sin constantes anatómicas.
 *
 * Plano: el de la articulación que se reparte (un solo eje). Unidades SI: N·m, N, m, m².
 *
 * Todo dato anatómico (área de sección fisiológica, brazo de palanca interno, largo de reposo)
 * es ENTRADA del llamador. Este módulo no trae ni una cifra de músculo porque las fuentes de
 * esas cifras no están verificadas todavía (Riener y Edrich 1999 sin abrir; licencia del modelo
 * de Rajagopal 2016 sin leer; ver `NOTAS-FUENTES-FASE4-20OCT.md`). Lo que sí contiene es el
 * método, probado contra soluciones analíticas.
 *
 * Método (Crowninshield y Brand 1981, descrito en fuentes secundarias): minimizar
 * Σ (F_i / A_i)^r sujeto a Σ F_i·d_i = M con F_i ≥ 0. Para r > 1 y brazos d_i > 0 la solución
 * es cerrada: F_i = c·(d_i·A_i^r)^(1/(r−1)), con c = M / Σ d_j·(d_j·A_j^r)^(1/(r−1)).
 * Con r = 2: F_i = M·A_i²·d_i / Σ A_j²·d_j². El exponente r lo elige quien llama: el criterio
 * cambia el reparto, y la literatura no lo cierra (principio P-5: se guarda la observación).
 *
 * Un músculo con brazo ≤ 0 no puede producir ese momento: recibe fuerza 0. Si el momento a
 * repartir es ≤ 0 o no hay ningún músculo con brazo positivo, NO se reparte (`no_afirmable`).
 */

export interface Musculo {
  nombre: string
  /** Área de sección fisiológica, m². */
  area: number
  /** Brazo de palanca interno respecto del eje, m; positivo si el músculo produce el momento pedido. */
  brazo: number
}

export interface FuerzaDeMusculo {
  nombre: string
  /** Fuerza, N. */
  fuerza: number
  /** Parte del momento que lleva este músculo, adimensional, suma 1. */
  fraccion: number
}

export function repartirMomento(momento: number, musculos: readonly Musculo[], r: number): FuerzaDeMusculo[] | null {
  if (!Number.isFinite(momento) || momento <= 0) return null
  if (!Number.isFinite(r) || r <= 1) return null
  if (musculos.some((m) => !Number.isFinite(m.area) || m.area <= 0 || !Number.isFinite(m.brazo))) return null
  const activos = musculos.filter((m) => m.brazo > 0)
  if (activos.length === 0) return null
  const peso = (m: Musculo) => Math.pow(m.brazo * Math.pow(m.area, r), 1 / (r - 1))
  const c = momento / activos.reduce((t, m) => t + m.brazo * peso(m), 0)
  if (!Number.isFinite(c) || c <= 0 || activos.some((m) => !Number.isFinite(peso(m)) || peso(m) <= 0)) return null
  return musculos.map((m) => {
    const fuerza = m.brazo > 0 ? c * peso(m) : 0
    return { nombre: m.nombre, fuerza, fraccion: (fuerza * Math.max(m.brazo, 0)) / momento }
  })
}

/** Banda de la fracción de cada músculo cuando el ÁREA de cada uno es incierta (sd relativa, independiente). */
export function bandasDeReparto(
  momento: number,
  musculos: readonly Musculo[],
  r: number,
  sdRelativaDelArea: number,
  { muestras = 2000, semilla = 20261020 } = {},
): { nombre: string; fraccion: Cifra }[] | null {
  if (!Number.isInteger(muestras) || muestras < 1) throw new RangeError('muestras debe ser un entero >= 1')
  const central = repartirMomento(momento, musculos, r)
  if (!central) return null
  const azar = crearAzar(semilla)
  const datos: number[][] = musculos.map(() => [])
  for (let i = 0; i < muestras; i++) {
    const perturbados = musculos.map((m) => ({ ...m, area: m.area * Math.max(0.05, 1 + sdRelativaDelArea * normal(azar)) }))
    const rep = repartirMomento(momento, perturbados, r)
    if (!rep) continue
    rep.forEach((x, j) => datos[j].push(x.fraccion))
  }
  const pct = (o: number[], q: number) => {
    const i = (o.length - 1) * q
    return o[Math.floor(i)] + (o[Math.ceil(i)] - o[Math.floor(i)]) * (i - Math.floor(i))
  }
  return musculos.map((m, j) => {
    const o = [...datos[j]].sort((a, b) => a - b)
    const v = central[j].fraccion
    return {
      nombre: m.nombre,
      fraccion: {
        id: `reparto.fraccion.${m.nombre}`,
        valor: v,
        unidad: '1',
        estado: 'estimado',
        fuente: ['reparto.metodo.crowninshield-brand-1981'],
        supuestos: [
          `criterio: minimizar Σ(F/A)^r con r = ${r} (lo fija quien llama; la literatura no lo cierra)`,
          `áreas y brazos son entrada, hipotéticos hasta verificar una fuente`,
          `sd relativa del área ${sdRelativaDelArea}, ${muestras} muestras, semilla ${semilla}`,
        ],
        banda: { inf: Math.min(pct(o, 0.05), v), sup: Math.max(pct(o, 0.95), v), nivel: 'percentil 5 a 95 del Monte Carlo' },
        version: VERSION_DEL_MODELO,
      } satisfies Cifra,
    }
  })
}

/**
 * ÍNDICE DE LONGITUD REGIONAL: cuánto se alarga (+) o acorta (−) un músculo en una postura,
 * respecto de su largo de referencia, como fracción. ℓ = ℓ0 + r_cadera·θ_cadera − r_rodilla·θ_rodilla
 * (flexión positiva, radianes). `brazoCadera` > 0 si el músculo EXTIENDE la cadera, < 0 si la
 * flexiona; `brazoRodilla` > 0 si FLEXIONA la rodilla. Un músculo monoarticular tiene un brazo en 0.
 * Es un modelo de brazo constante: ordena posturas, NO da longitudes reales. Los brazos son entrada.
 */
export function indiceDeLongitud(
  m: { brazoCadera: number; brazoRodilla: number; largoDeReferencia: number },
  p: { cadera: number; rodilla: number },
): number | null {
  const ok = [m.brazoCadera, m.brazoRodilla, m.largoDeReferencia, p.cadera, p.rodilla].every(Number.isFinite)
  if (!ok || m.largoDeReferencia <= 0) return null
  return (m.brazoCadera * p.cadera - m.brazoRodilla * p.rodilla) / m.largoDeReferencia
}

/** El momento pasivo (cápsula, ligamentos, fibras en reposo) NO se calcula: sin coeficientes verificados. */
export function momentoPasivo(id: string): Cifra {
  return noAfirmable(
    id,
    'N·m',
    'Riener y Edrich 1999 no se abrió en texto completo: ningún coeficiente está verificado y no se inventa',
    VERSION_DEL_MODELO,
  )
}
