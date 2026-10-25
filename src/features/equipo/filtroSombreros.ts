import { useSyncExternalStore } from 'react'
import type { FiltroSombrero } from '../../domain/equipo/sombreros'

/**
 * El filtro de sombreros, fuera de React y compartido por toda la sesión.
 *
 * La maqueta 7 pide UN filtro que viaje entre el Hoy del equipo, la Bandeja, Equipo y
 * Empresa: la misma persona sigue mirando el mismo sombrero al cambiar de pantalla. Si
 * viviera en un `useState` de cada pantalla, cada cambio lo reiniciaría a «Todo» y el
 * trabajo de filtrar se haría cuatro veces.
 *
 * No toca datos ni red: es una preferencia de vista. Se pierde al recargar, que es lo
 * correcto —abrir la app no debería esconder trabajo de ayer.
 */
let actual: FiltroSombrero = 'todo'
const oyentes = new Set<() => void>()

export function filtroActual(): FiltroSombrero {
  return actual
}

export function ponerFiltro(nuevo: FiltroSombrero): void {
  if (nuevo === actual) return
  actual = nuevo
  for (const oyente of oyentes) oyente()
}

export function suscribirAlFiltro(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

/** Lo usa la pantalla: se vuelve a pintar cuando el filtro cambia en cualquier otra. */
export function useFiltroSombrero(): FiltroSombrero {
  return useSyncExternalStore(suscribirAlFiltro, filtroActual, filtroActual)
}

/** Solo para las pruebas: cada una arranca en «todo» y sin oyentes colgados. */
export function reiniciarFiltroParaPruebas(): void {
  actual = 'todo'
  oyentes.clear()
}
