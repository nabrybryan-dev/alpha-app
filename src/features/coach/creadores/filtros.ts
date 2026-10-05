import { CARRILES, NOMBRE_CARRIL, type Candidato, type Carril } from '../../../data/consola/creadores'

/**
 * Búsqueda y filtros del tablero de creadores, sobre datos que ya existen (cuenta, carril).
 * Pura: no lee nada. Los criterios viajan en la URL (`?q=&carril=&desempate=1`) para que abrir
 * un detalle, salir y volver deje el tablero en el mismo carril.
 *
 * «Espera desempate» es el carril `tambaleando`: los que necesitan criterio humano con sonido.
 */
export interface Filtros {
  q: string
  carril: Carril | 'todos'
  desempate: boolean
}

export const SIN_FILTROS: Filtros = { q: '', carril: 'todos', desempate: false }

const limpiar = (t: string) => t.trim().replace(/^@/, '').toLowerCase()

export function filtrarCandidatos(candidatos: readonly Candidato[], f: Filtros): Candidato[] {
  const q = limpiar(f.q)
  return candidatos.filter(
    (c) =>
      (q === '' || c.usuarioIg.toLowerCase().includes(q)) &&
      (f.carril === 'todos' || c.carril === f.carril) &&
      (!f.desempate || c.carril === 'tambaleando'),
  )
}

export function leerFiltros(params: URLSearchParams): Filtros {
  const carril = params.get('carril')
  return {
    q: params.get('q') ?? '',
    carril: carril !== null && (CARRILES as readonly string[]).includes(carril) ? (carril as Carril) : 'todos',
    desempate: params.get('desempate') === '1',
  }
}

/** Los filtros como parámetros de URL, sin dejar los que están en su valor por defecto. */
export function escribirFiltros(f: Filtros, base: URLSearchParams): URLSearchParams {
  const p = new URLSearchParams(base)
  for (const k of ['q', 'carril', 'desempate']) p.delete(k)
  if (f.q !== '') p.set('q', f.q)
  if (f.carril !== 'todos') p.set('carril', f.carril)
  if (f.desempate) p.set('desempate', '1')
  return p
}

/** Los criterios activos, en palabras, para decirlos junto al número de resultados. */
export function criteriosAplicados(f: Filtros): string[] {
  const c: string[] = []
  if (limpiar(f.q) !== '') c.push(`cuenta con «${f.q.trim()}»`)
  if (f.carril !== 'todos') c.push(`carril: ${NOMBRE_CARRIL[f.carril]}`)
  if (f.desempate) c.push('espera desempate')
  return c
}
