import { cargaPorGrupo } from './fatiga'
import { ORDEN_GRUPOS, type Grupo } from './taxonomia'
import type { Microciclo } from './types'

/**
 * La rejilla de volumen por grupo a lo largo del bloque: series pautadas de
 * cada grupo en cada microciclo.
 *
 * Es lo único que la hoja `PANEL ENTRENAMIENTO` del Excel hacía y la app no.
 * Por eso la planificación de bloque se seguía mirando en un archivo congelado
 * desde el 2026-08-02, aunque la app fuera la fuente de verdad. `cargaPorGrupo`
 * ya daba el volumen por grupo, pero solo del microciclo en curso, y con una
 * sola columna no se ve la ondulación: no se puede situar un grupo en su
 * landmark (MEV → MAV → MRV) mirando una semana suelta.
 *
 * Cuenta lo **pautado**, no lo ejecutado: es la rejilla con la que se planifica
 * el bloque siguiente, no el registro de lo que pasó. Para eso está
 * `cargaPorGrupo`, que trae las dos cifras del microciclo activo.
 *
 * Las series son **fraccionadas** (directo 1, indirecto 0,5), igual que en el
 * resto del dominio → ver `taxonomia.ts`.
 */

export interface FilaVolumen {
  readonly grupo: Grupo
  /** Series pautadas por microciclo, alineadas con `numeros`. 0 si no se tocó. */
  readonly porMicrociclo: readonly number[]
  /** Suma del bloque, para ordenar y para leer el sesgo de un vistazo. */
  readonly total: number
}

export interface RejillaVolumen {
  /** Números de microciclo, ascendentes. Son las columnas. */
  readonly numeros: readonly number[]
  /** Una fila por grupo con volumen, en el orden de presentación del PANEL. */
  readonly filas: readonly FilaVolumen[]
}

/** Media serie no existe en coma flotante limpia: 3 × 0,5 da 1,5000000000000002. */
function redondear(n: number): number {
  return Math.round(n * 10) / 10
}

export function volumenDeBloque(microciclos: readonly Microciclo[]): RejillaVolumen {
  // Por número, no por el orden en que vinieran de la base: la rejilla se lee de
  // izquierda a derecha como el paso del bloque.
  const ordenados = [...microciclos].sort((a, b) => a.numero - b.numero)
  const numeros = ordenados.map((m) => m.numero)

  // Un grupo que aparece en el M12 y no en el M3 necesita un 0 en la columna del
  // M3, no un hueco: la fila tiene que poder leerse como una serie temporal.
  const porGrupo = new Map<Grupo, number[]>()
  ordenados.forEach((microciclo, columna) => {
    for (const carga of cargaPorGrupo(microciclo)) {
      const fila = porGrupo.get(carga.grupo) ?? new Array<number>(ordenados.length).fill(0)
      fila[columna] = redondear(fila[columna] + carga.seriesPautadas)
      porGrupo.set(carga.grupo, fila)
    }
  })

  const filas = ORDEN_GRUPOS.filter((grupo) => porGrupo.has(grupo)).map((grupo) => {
    const porMicrociclo = porGrupo.get(grupo) ?? []
    return {
      grupo,
      porMicrociclo,
      total: redondear(porMicrociclo.reduce((suma, n) => suma + n, 0)),
    }
  })

  return { numeros, filas }
}
