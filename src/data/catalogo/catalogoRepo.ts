/**
 * Acceso al catálogo de alimentos que va empaquetado con la app.
 *
 * A diferencia del resto de repositorios, este no lee de `localStorage` ni se
 * sincroniza: el catálogo es la misma referencia para todo el mundo, no cambia
 * salvo que se regenere el índice, y no contiene ningún dato personal. Por eso
 * tampoco recibe un `usuarioId`.
 *
 * El índice lo genera `scripts/generar-indice-alimentos.mjs`. No editarlo a
 * mano: se regenera desde el catálogo del Cerebro cada vez que este crece.
 *
 * Datos de composición nutricional tomados de la Tabla de Composición de
 * Alimentos Colombianos (TCAC 2018), Instituto Colombiano de Bienestar
 * Familiar - ICBF.
 */

import type { AlimentoIndice, FiltroBusqueda } from '../../domain/nutricion/busqueda'
import { buscar } from '../../domain/nutricion/busqueda'
import bruto from './alimentos.json'

const ALIMENTOS = bruto as AlimentoIndice[]

/** Índice por id: la hoja de cantidad lo consulta en cada pulsación del
 *  stepper, y recorrer 1.195 alimentos en cada una se nota en un móvil. */
const POR_ID = new Map(ALIMENTOS.map((a) => [a.id, a]))

export interface CatalogoRepo {
  buscar(consulta: string, filtro?: FiltroBusqueda, tope?: number): AlimentoIndice[]
  porId(id: string): AlimentoIndice | undefined
  /** Cuántos alimentos hay en total. La hoja de búsqueda lo enseña ("N de …"). */
  total(): number
  /** Los grupos que existen, para los chips de filtro. */
  grupos(): string[]
}

export const catalogoRepo: CatalogoRepo = {
  buscar: (consulta, filtro, tope) => buscar(ALIMENTOS, consulta, filtro, tope),
  porId: (id) => POR_ID.get(id),
  total: () => ALIMENTOS.length,
  grupos: () => [...new Set(ALIMENTOS.map((a) => a.grupo))].sort((a, b) => a.localeCompare(b, 'es')),
}
