import { aportesDeCategoria, type Grupo } from '../../../domain/taxonomia'
import { ejercicioCompleto } from '../../../domain/cumplimiento'
import type { CheckinDiario, EjercicioPrescrito, Sesion } from '../../../domain/types'
import { NOMBRE_DE_REGION, REGIONES, type IdDeRegion } from './regiones'

/**
 * DE LAS SERIES ANOTADAS AL COLOR DE CADA REGION DEL CUERPO.
 *
 * Cuenta SERIES ANOTADAS, no estimulo (la maqueta lo dice debajo de la lectura). El reparto
 * es el de `domain/taxonomia` —el mismo del mapa de fatiga—: una serie vale 1 al grupo
 * directo y 1/2 a cada indirecto. De grupo a region de la maqueta hay un segundo factor
 * (`GRUPO_A_REGIONES`): el grupo «Espalda» alimenta el dorsal entero y el trapecio a medias,
 * como en las filas de la maqueta 7.
 */

export type SeriesPorRegion = Partial<Record<IdDeRegion, number>>

export const GRUPO_A_REGIONES: Readonly<Record<Grupo, readonly { region: IdDeRegion; peso: number }[]>> = {
  Pecho: [{ region: 'pecho', peso: 1 }],
  Hombros: [{ region: 'delt', peso: 1 }],
  Espalda: [
    { region: 'dors', peso: 1 },
    { region: 'trap', peso: 0.5 },
  ],
  Bíceps: [
    { region: 'bic', peso: 1 },
    { region: 'ante', peso: 0.5 },
  ],
  Tríceps: [{ region: 'tri', peso: 1 }],
  Cuádriceps: [{ region: 'cua', peso: 1 }],
  Isquios: [{ region: 'isq', peso: 1 }],
  Glúteos: [{ region: 'glu', peso: 1 }],
  Aductores: [{ region: 'adu', peso: 1 }],
  Pantorrillas: [{ region: 'gem', peso: 1 }],
  Abdomen: [
    { region: 'abd', peso: 1 },
    { region: 'obl', peso: 0.5 },
  ],
  Lumbares: [{ region: 'lumb', peso: 1 }],
}

/** Series anotadas por region en las sesiones que se le pasen (hoy, un dia o la semana). */
export function seriesPorRegion(sesiones: readonly Sesion[]): SeriesPorRegion {
  const total: SeriesPorRegion = {}
  for (const s of sesiones) {
    for (const e of s.ejercicios) {
      if (e.series.length === 0) continue
      for (const { grupo, factor } of aportesDeCategoria(e.categoria, e.nombre)) {
        for (const { region, peso } of GRUPO_A_REGIONES[grupo]) {
          total[region] = (total[region] ?? 0) + e.series.length * factor * peso
        }
      }
    }
  }
  return total
}

/** k = 0,3 + 0,7 · series / max. Sin series (o sin maximo) no hay tinte: 0. */
export function intensidadDeRegion(series: number, maximo: number): number {
  if (series <= 0 || maximo <= 0) return 0
  if (series >= maximo) return 1
  return 0.3 + (0.7 * series) / maximo
}

/** Dolor de 0 a 10 a partir del cual la region se pinta en rojo (maqueta 7). */
export const DOLOR_MINIMO = 4

const PALABRAS_DE_DOLOR: readonly { patron: RegExp; regiones: readonly IdDeRegion[] }[] = [
  { patron: /hombro|deltoid/, regiones: ['delt'] },
  { patron: /pecho|pectoral/, regiones: ['pecho'] },
  { patron: /codo|bicep(?!s? femoral)/, regiones: ['bic'] },
  { patron: /triceps|tricep/, regiones: ['tri'] },
  { patron: /antebrazo|muneca|mano/, regiones: ['ante'] },
  { patron: /abdomen|abdominal|barriga|estomago/, regiones: ['abd'] },
  { patron: /costado|oblicuo/, regiones: ['obl'] },
  { patron: /cuello|trapecio|cervical/, regiones: ['trap'] },
  // «la espalda» a secas es las dos; «alta» o «baja» es solo la que dice.
  { patron: /dorsal|espalda alta|omoplato|espalda(?! (alta|baja))/, regiones: ['dors'] },
  { patron: /lumbar|espalda baja|cintura|espalda(?! (alta|baja))/, regiones: ['lumb'] },
  { patron: /gluteo|cadera|nalga/, regiones: ['glu'] },
  { patron: /ingle|aductor/, regiones: ['adu'] },
  { patron: /muslo|cuadriceps|rodilla/, regiones: ['cua'] },
  { patron: /isquio|femoral|biceps femoral/, regiones: ['isq'] },
  { patron: /pierna|gemelo|pantorrilla|tobillo|pie\b|talon/, regiones: ['gem'] },
]

function sinTildes(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Las regiones que duelen segun el check-in: dolor >= 4 y lo que la persona escribio en
 * «donde duele». Lo que no se reconoce no se inventa: sin region, el rojo no sale en el
 * cuerpo (el aviso al coach es del check-in y no se toca aqui).
 */
export function regionesConDolor(checkin: Pick<CheckinDiario, 'dolor' | 'dolorDonde'> | undefined): IdDeRegion[] {
  if (!checkin || (checkin.dolor ?? 0) < DOLOR_MINIMO || !checkin.dolorDonde) return []
  const texto = sinTildes(checkin.dolorDonde)
  const salida = new Set<IdDeRegion>()
  for (const { patron, regiones } of PALABRAS_DE_DOLOR) {
    if (patron.test(texto)) for (const r of regiones) salida.add(r)
  }
  return REGIONES.map((r) => r.id).filter((id) => salida.has(id))
}

export interface TinteDeRegion {
  k: number
  dolor: boolean
  /** La sesión la trabaja de forma directa y aún le queda algún ejercicio: se pinta en rojo. */
  pendiente?: boolean
  /** Cuándo (ms, `Date.now()`) se terminó su último ejercicio en esta visita: arranca la transición. */
  trabajadaEn?: number
}

export type TinteDelCuerpo = Record<IdDeRegion, TinteDeRegion>

/**
 * Las regiones que un ejercicio trabaja DE FORMA DIRECTA: grupo con factor 1 y región con peso
 * 1. Lo indirecto (el tríceps de un press, el trapecio de un remo) no se enciende como «por
 * trabajar»: pintado en rojo, medio cuerpo saldría pendiente por cualquier ejercicio.
 */
export function regionesDirectas(ejercicio: Pick<EjercicioPrescrito, 'categoria' | 'nombre'>): IdDeRegion[] {
  const salida = new Set<IdDeRegion>()
  for (const { grupo, factor } of aportesDeCategoria(ejercicio.categoria, ejercicio.nombre)) {
    if (factor < 1) continue
    for (const { region, peso } of GRUPO_A_REGIONES[grupo]) if (peso >= 1) salida.add(region)
  }
  return REGIONES.map((r) => r.id).filter((id) => salida.has(id))
}

/**
 * Lo que la sesión deja POR TRABAJAR (Bryan, 25-oct): las regiones directas de sus ejercicios
 * que no están terminados. Una región trabajada por dos ejercicios sigue pendiente hasta que
 * se terminan los dos.
 */
export function regionesPorTrabajar(sesion: Pick<Sesion, 'ejercicios'> | undefined): IdDeRegion[] {
  if (!sesion) return []
  const salida = new Set<IdDeRegion>()
  for (const e of sesion.ejercicios) {
    if (ejercicioCompleto(e)) continue
    for (const r of regionesDirectas(e)) salida.add(r)
  }
  return REGIONES.map((r) => r.id).filter((id) => salida.has(id))
}

/**
 * El tinte de las 15 regiones: intensidad por series, lo que queda por trabajar y la marca
 * de dolor, siempre aparte. `trabajadasEn` dice cuándo se cerró cada región en esta visita.
 */
export function tinteDelCuerpo(
  series: SeriesPorRegion,
  doloridas: readonly IdDeRegion[],
  pendientes: readonly IdDeRegion[] = [],
  trabajadasEn: Partial<Record<IdDeRegion, number>> = {},
): TinteDelCuerpo {
  const maximo = Math.max(0, ...Object.values(series))
  const duele = new Set(doloridas)
  const falta = new Set(pendientes)
  return Object.fromEntries(
    REGIONES.map(({ id }) => {
      const t: TinteDeRegion = { k: intensidadDeRegion(series[id] ?? 0, maximo), dolor: duele.has(id) }
      if (falta.has(id)) t.pendiente = true
      else if (trabajadasEn[id] !== undefined) t.trabajadaEn = trabajadasEn[id]
      return [id, t]
    }),
  ) as TinteDelCuerpo
}

function cifra(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : String(r).replace('.', ',')
}

/** «Dorsal 2 · Bíceps 1 · Trapecio 1»: las tres mayores, y vacia si no hay series. */
export function lecturaCorta(series: SeriesPorRegion): string {
  return REGIONES.map((r, orden) => ({ r, orden, n: series[r.id] ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.orden - b.orden)
    .slice(0, 3)
    .map((x) => `${NOMBRE_DE_REGION[x.r.id]} ${cifra(x.n)}`)
    .join(' · ')
}
