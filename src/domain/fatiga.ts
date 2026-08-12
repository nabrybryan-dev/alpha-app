import type { Microciclo } from './types'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * LA MONEDA DEL VOLUMEN: AQUÍ SE CUENTA **DIRECTO**
 * ────────────────────────────────────────────────────────────────────────────
 * Cada ejercicio suma a **un solo grupo** —el que gane en `grupoDeCategoria`— y
 * a ninguno más. Un peso muerto rumano cuenta entero para isquios y **cero**
 * para glúteos, aunque los entrene.
 *
 * Está escrito aquí porque hasta el 2026-08-12 era implícito, y esa ambigüedad
 * ya causó un error de diseño: se dio por supuesto que la app contaba «total»
 * (indirectas valiendo 1) y se concluyó al revés de lo que toca. Ver
 * `docs/specs/2026-08-12-reparto-de-volumen-por-zona-diseno.md` §2.
 *
 * Las tres monedas de la literatura (Pelland et al., Sports Med 2026), con su
 * propio ejemplo —5 series de press de banca y 5 de remo en la semana—:
 *
 *   total       indirectas valen 1     → 10
 *   fraccionado indirectas valen 0,5   → 7,5   ← la que mejor predice
 *   directo     indirectas valen 0     → 5     ← **donde estamos**
 *
 * Consecuencia práctica: contra unos landmarks dados, **este conteo mide por
 * debajo**. El día que se pase a fraccionado el número por grupo subirá, y hay
 * que medir cuánto antes de tocar ningún umbral.
 */

export type NivelFatiga = 'fresco' | 'en-trabajo' | 'cargado'

/** En qué moneda cuenta la app hoy. Ver el bloque de arriba. */
export const MONEDA_VOLUMEN = 'directa' as const

export interface CargaGrupo {
  grupo: string
  seriesHechas: number
  seriesPautadas: number
  /** Porcentaje 0-100 del volumen pautado ya ejecutado en el microciclo. */
  pct: number
  nivel: NivelFatiga
}

/**
 * Mapa de categorías (taxonomía del PANEL Heracles y la simplificada de la
 * app) + nombres de ejercicio a grupos musculares. Se evalúa sobre el texto
 * "CATEGORÍA NOMBRE" normalizado; el primer patrón que calce gana, así que
 * el orden importa (p. ej. PESO MUERTO → Isquios antes que la regla genérica
 * DOMINANTE DE CADERA → Glúteos). El orden también define la presentación.
 */
const GRUPOS: { grupo: string; patron: RegExp }[] = [
  { grupo: 'Pecho', patron: /EMPUJE (HORIZONTAL|INCLINADO|DECLINADO)|PECTORAL|PRESS (PLANO|INCLINADO|DE PECHO)/ },
  { grupo: 'Hombros', patron: /EMPUJE VERTICAL|DELTOIDES|ELEVACION(ES)? LATERAL|PRESS MILITAR/ },
  { grupo: 'Espalda', patron: /TRACCION|ESPALDA|REMO|JALON|PULLOVER|FACE PULL/ },
  { grupo: 'Bíceps', patron: /BICEPS|CURL MARTILLO/ },
  { grupo: 'Tríceps', patron: /TRICEPS|EXTENSION DE CODO/ },
  { grupo: 'Cuádriceps', patron: /SENTADILLA|CUADRICEPS|PRENSA|EXTENSION (DE )?RODILLA|DOMINANTE DE RODILLA/ },
  { grupo: 'Isquios', patron: /BISAGRA|ISQUIOS|FEMORAL|PESO MUERTO/ },
  { grupo: 'Glúteos', patron: /GLUTEO|HIP THRUST|ABDUCCION|HIPEREXTENSION|DOMINANTE DE CADERA/ },
  { grupo: 'Aductores', patron: /ADUCTOR|ADUCCION/ },
  { grupo: 'Pantorrillas', patron: /PANTORRILLA|GEMELO/ },
  { grupo: 'Abdomen', patron: /ABDOMEN|CORE|PLANCHA/ },
]

function normalizar(categoria: string): string {
  const sinDiacriticos = categoria.normalize('NFD').replace(/[̀-ͯ]/g, '')
  return sinDiacriticos.toUpperCase()
}

export function grupoDeCategoria(categoria: string, nombreEjercicio = ''): string | undefined {
  const limpio = normalizar(`${categoria} ${nombreEjercicio}`)
  return GRUPOS.find((g) => g.patron.test(limpio))?.grupo
}

function nivelDe(pct: number): NivelFatiga {
  if (pct < 25) return 'fresco'
  if (pct < 75) return 'en-trabajo'
  return 'cargado'
}

/**
 * Sitúa cada grupo muscular según el volumen ya ejecutado en el microciclo:
 * series registradas vs series pautadas por categoría (el volumen se cuenta
 * por categoría, no por ejercicio, igual que el PANEL del método).
 */
export function cargaPorGrupo(microciclo: Microciclo): CargaGrupo[] {
  const acumulado = new Map<string, { hechas: number; pautadas: number }>()
  for (const sesion of microciclo.sesiones) {
    for (const ejercicio of sesion.ejercicios) {
      const grupo = grupoDeCategoria(ejercicio.categoria, ejercicio.nombre)
      if (!grupo) continue
      const previo = acumulado.get(grupo) ?? { hechas: 0, pautadas: 0 }
      acumulado.set(grupo, {
        hechas: previo.hechas + ejercicio.series.length,
        pautadas: previo.pautadas + ejercicio.sets,
      })
    }
  }
  return GRUPOS.filter((g) => acumulado.has(g.grupo)).map(({ grupo }) => {
    const suma = acumulado.get(grupo) ?? { hechas: 0, pautadas: 0 }
    const pct =
      suma.pautadas > 0 ? Math.min(100, Math.round((suma.hechas / suma.pautadas) * 100)) : 0
    return {
      grupo,
      seriesHechas: suma.hechas,
      seriesPautadas: suma.pautadas,
      pct,
      nivel: nivelDe(pct),
    }
  })
}
