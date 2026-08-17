import { useEffect, useState } from 'react'

const CONSULTA = '(prefers-reduced-motion: reduce)'

/**
 * ¿El sistema pide menos movimiento? Lectura puntual, en el momento.
 *
 * Para manejadores de eventos y valores iniciales de estado: sitios donde no se
 * puede llamar a un hook, o donde la pregunta se responde una sola vez antes del
 * primer render.
 *
 * La guarda de `matchMedia` no sobra. `AguilaInteractiva` la omitía y llamaba
 * `window.matchMedia(...)` a pelo dentro del manejador del toque: donde
 * `matchMedia` no existe —jsdom sin declarar, navegadores degradados— tocar el
 * águila lanzaba un TypeError, y el águila está en el Splash y en el Login. Sin
 * la comprobación no se puede saber la preferencia, así que se asume que no se
 * pidió: es lo que hacían cuatro de los cinco sitios que esto reemplaza.
 */
export function movimientoReducido(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(CONSULTA).matches
  )
}

/**
 * Lo mismo, pero reactivo: se vuelve a renderizar si la preferencia cambia.
 *
 * Escucha el cambio en vivo a propósito. Si alguien la activa con la app ya
 * abierta, quien use esto tiene que enterarse sin recargar; leerla una sola vez
 * al montar dejaría el movimiento corriendo para quien acaba de pedir que pare.
 *
 * Usa la versión puntual como valor inicial para que el primer render ya sea el
 * correcto y no haya un fotograma con la animación puesta.
 */
export function useMovimientoReducido(): boolean {
  const [reducido, setReducido] = useState(movimientoReducido)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(CONSULTA)
    const alCambiar = () => setReducido(mq.matches)
    mq.addEventListener?.('change', alCambiar)
    return () => mq.removeEventListener?.('change', alCambiar)
  }, [])

  return reducido
}
