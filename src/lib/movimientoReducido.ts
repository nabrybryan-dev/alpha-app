import { useSyncExternalStore } from 'react'

const CONSULTA = '(prefers-reduced-motion: reduce)'

/**
 * jsdom no implementa `matchMedia`, y algunos navegadores viejos solo traen la
 * API anterior (`addListener`). Se comprueban las dos: sin esto, el hook revienta
 * en los tests y en Safari antiguo.
 */
function consultar(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(CONSULTA)
}

function suscribir(alCambiar: () => void): () => void {
  const medio = consultar()
  if (!medio) return () => {}

  if (typeof medio.addEventListener === 'function') {
    medio.addEventListener('change', alCambiar)
    return () => medio.removeEventListener('change', alCambiar)
  }

  medio.addListener(alCambiar)
  return () => medio.removeListener(alCambiar)
}

function leer(): boolean {
  return consultar()?.matches ?? false
}

/**
 * `true` cuando la persona ha pedido menos movimiento en su sistema.
 *
 * Se lee en vivo, no una sola vez al montar: quien cambia el ajuste con la app
 * abierta debe ver el efecto sin recargar. Cuando no se puede saber —jsdom, un
 * navegador sin `matchMedia`— se responde `false`, que es el comportamiento
 * normal y no el degradado.
 */
export function useMovimientoReducido(): boolean {
  return useSyncExternalStore(suscribir, leer, () => false)
}
