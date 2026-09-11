import { createContext, useContext } from 'react'
import type { NivelDeMovimiento } from '../lib/movimientoAdaptativo'

/**
 * El contexto del movimiento y su hook, aparte del componente.
 *
 * Están en su propio archivo por una razón concreta y no por gusto: un archivo
 * que exporta un componente Y otra cosa rompe el refresco rápido de Vite —el
 * módulo entero se recarga en vez de actualizarse en sitio, y se pierde el
 * estado de la pantalla en cada guardado—. `eslint` lo avisa con
 * `react-refresh/only-export-components`, y la regla de este repo es no dejar ni
 * un aviso más de los que había.
 *
 * `SessionProvider` y `ThemeProvider` sí lo mezclan, pero eso es deuda anterior
 * con su aviso ya contabilizado: copiarla habría sido añadir una tercera.
 */

export interface Movimiento {
  nivel: NivelDeMovimiento
  /**
   * Declara si hay una serie en curso. Lo llama la pantalla de entrenamiento:
   * es contexto de producto, no de rendimiento.
   */
  declararSerie: (enCurso: boolean) => void
}

export const ContextoDeMovimiento = createContext<Movimiento | null>(null)

/**
 * El nivel de movimiento vigente y cómo declarar una serie en curso.
 *
 * Fuera del proveedor devuelve `pleno` y una función que no hace nada, en vez de
 * lanzar: esto modera adornos, y un adorno nunca debe poder tumbar una pantalla.
 * Los tests montan componentes sueltos constantemente.
 */
export function useMovimiento(): Movimiento {
  return useContext(ContextoDeMovimiento) ?? { nivel: 'pleno', declararSerie: () => {} }
}
