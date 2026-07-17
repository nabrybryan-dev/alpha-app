import type { Microciclo } from './types'

export type NivelFatiga = 'fresco' | 'en-trabajo' | 'cargado'

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
