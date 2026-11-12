import { interpretarOrden } from '../domain/praxis/ordenes/ordenesDeVoz'
import { decidirDestino } from './destinosPraxis'
import type { PerfilAcceso } from './rutas'

/**
 * NAVEGAR DE VERDAD (paso 3, «F3», del plano de conexiones de la Praxis única, 5-nov-2026).
 *
 * Praxis lleva a una persona a una pantalla SOLO si `decidirDestino` (la guarda de la app, no una propia) la deja
 * entrar. La función de navegación del router llega inyectada: aquí no hay React ni router, así que se prueba
 * con una función falsa. Si no entra, se dice con una frase corta; nunca se la manda a otra parte en silencio.
 * Hoy ningún botón visible llama a esto: lo usará la Praxis única cuando se encienda.
 */

export type ResultadoDeNavegar =
  | { tipo: 'navego'; patron: string; titulo: string }
  /** El destino existe pero esa persona no entra: se le dice, no se la desvía. */
  | { tipo: 'sin_acceso'; patron: string; frase: string }
  | { tipo: 'no_es_destino'; patron: string }
  /** La frase era de salud o de riesgo: jamás navega; `respuesta` es la que ya da el filtro de riesgo. */
  | { tipo: 'no_navega'; motivo: 'riesgo'; respuesta: string }

export const FRASE_SIN_ACCESO = 'Esa pantalla no está disponible para tu cuenta.'

export function navegarA(patron: string, perfil: PerfilAcceso, navegar: (ruta: string) => void): ResultadoDeNavegar {
  const d = decidirDestino(patron, perfil)
  if (d.tipo === 'sin_acceso') return { tipo: 'sin_acceso', patron, frase: FRASE_SIN_ACCESO }
  if (d.tipo === 'no_es_destino') return { tipo: 'no_es_destino', patron }
  navegar(d.destino.patron)
  return { tipo: 'navego', patron: d.destino.patron, titulo: d.destino.titulo }
}

/**
 * De una frase dicha a una pantalla de la app. Hoy solo «lo de hoy» sale de la app (`/`); el resto de las órdenes
 * mueven el salón y no son rutas. Lo de salud o riesgo se corta antes: nunca navega.
 */
export function navegarPorFrase(frase: string, perfil: PerfilAcceso, navegar: (ruta: string) => void): ResultadoDeNavegar {
  const orden = interpretarOrden(frase)
  if (orden.tipo === 'salud') return { tipo: 'no_navega', motivo: 'riesgo', respuesta: orden.respuesta }
  if (orden.tipo === 'hoy') return navegarA('/', perfil, navegar)
  return { tipo: 'no_es_destino', patron: frase.trim() }
}
