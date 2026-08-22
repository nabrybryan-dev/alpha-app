import { useSyncExternalStore } from 'react'

const CONSULTA = '(prefers-reduced-motion: reduce)'

/**
 * El medio, o `null` si no se puede preguntar.
 *
 * La guarda de `matchMedia` no sobra. `AguilaInteractiva` la omitía y llamaba
 * `window.matchMedia(...)` a pelo dentro del manejador del toque: donde
 * `matchMedia` no existe —jsdom sin declarar, navegadores degradados— tocar el
 * águila lanzaba un TypeError, y el águila está en el Splash y en el Login.
 */
function consultar(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(CONSULTA)
}

/**
 * Se atienden las DOS APIs de escucha a propósito: Safari viejo solo trae
 * `addListener`, y con `addEventListener?.()` a secas la suscripción se caía en
 * silencio —sin error y sin escucha—, que es peor que fallar.
 */
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

/**
 * ¿El sistema pide menos movimiento? Lectura puntual, en el momento.
 *
 * Para manejadores de eventos y valores iniciales de estado: sitios donde no se
 * puede llamar a un hook, o donde la pregunta se responde una sola vez antes del
 * primer render. Cuando no se puede saber, se asume que no se pidió: es lo que
 * hacían cuatro de los cinco sitios que esto reemplaza.
 */
export function movimientoReducido(): boolean {
  return consultar()?.matches ?? false
}

/**
 * Lo mismo, pero reactivo: se vuelve a renderizar si la preferencia cambia.
 *
 * Escucha el cambio en vivo a propósito. Si alguien la activa con la app ya
 * abierta, quien use esto tiene que enterarse sin recargar; leerla una sola vez
 * al montar dejaría el movimiento corriendo para quien acaba de pedir que pare.
 *
 * Va por `useSyncExternalStore` y no por `useEffect` + `useState`: el valor se
 * lee en el mismo render, así que el primero ya es correcto y no hay un
 * fotograma con la animación puesta. La instantánea de servidor es `false`,
 * el comportamiento normal y no el degradado.
 */
export function useMovimientoReducido(): boolean {
  return useSyncExternalStore(suscribir, movimientoReducido, () => false)
}
