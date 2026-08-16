import { aportesDeCategoria, ORDEN_GRUPOS, type Grupo } from './taxonomia'
import type { Microciclo } from './types'

export type NivelFatiga = 'fresco' | 'en-trabajo' | 'cargado'

export interface CargaGrupo {
  grupo: Grupo
  /** Series fraccionadas: el trabajo directo vale 1 y el indirecto 0,5. */
  seriesHechas: number
  seriesPautadas: number
  /** Porcentaje 0-100 del volumen pautado ya ejecutado en el microciclo. */
  pct: number
  nivel: NivelFatiga
}

/** Media serie no existe en coma flotante limpia: 3 × 0,5 da 1,5000000000000002. */
function redondear(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Series fraccionadas para mostrar: `12` en vez de `12,0`, y `7,5` con coma
 * decimal, que es como se escribe en español.
 */
export function formatearSeries(series: number): string {
  return Number.isInteger(series) ? String(series) : series.toFixed(1).replace('.', ',')
}

function nivelDe(pct: number): NivelFatiga {
  if (pct < 25) return 'fresco'
  if (pct < 75) return 'en-trabajo'
  return 'cargado'
}

/**
 * Sitúa cada grupo muscular según el volumen ya ejecutado en el microciclo:
 * series registradas vs series pautadas.
 *
 * El reparto es el de `taxonomia.ts`: cada ejercicio suma **1 serie a su grupo
 * directo y 0,5 a cada indirecto**, así que un mismo ejercicio alimenta varios
 * grupos. Antes contaba entero para uno solo y el PANEL medía por debajo.
 */
export function cargaPorGrupo(microciclo: Microciclo): CargaGrupo[] {
  const acumulado = new Map<Grupo, { hechas: number; pautadas: number }>()
  for (const sesion of microciclo.sesiones) {
    for (const ejercicio of sesion.ejercicios) {
      for (const { grupo, factor } of aportesDeCategoria(ejercicio.categoria, ejercicio.nombre)) {
        const previo = acumulado.get(grupo) ?? { hechas: 0, pautadas: 0 }
        acumulado.set(grupo, {
          hechas: previo.hechas + ejercicio.series.length * factor,
          pautadas: previo.pautadas + ejercicio.sets * factor,
        })
      }
    }
  }
  return ORDEN_GRUPOS.filter((grupo) => acumulado.has(grupo)).map((grupo) => {
    const suma = acumulado.get(grupo) ?? { hechas: 0, pautadas: 0 }
    const pct =
      suma.pautadas > 0 ? Math.min(100, Math.round((suma.hechas / suma.pautadas) * 100)) : 0
    return {
      grupo,
      seriesHechas: redondear(suma.hechas),
      seriesPautadas: redondear(suma.pautadas),
      pct,
      nivel: nivelDe(pct),
    }
  })
}
