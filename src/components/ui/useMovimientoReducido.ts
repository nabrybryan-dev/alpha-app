import { useEffect, useState } from 'react'

/**
 * `true` si el sistema pide menos movimiento.
 *
 * Escucha el cambio en vivo a propósito: si alguien activa la preferencia con la
 * app ya abierta, quien la use tiene que enterarse sin recargar. Leerla una sola
 * vez al montar dejaría animaciones corriendo para quien acaba de pedir que
 * paren.
 *
 * Copiado tal cual de `features/entrenar/ExerciseSlotMachine.tsx`, que lo tiene
 * privado. Consolidar los cinco sitios que hoy repiten esta comprobación
 * (`AguilaInteractiva`, `FichaPanini`, `Revelar`, `useContadorAnimado` y ese) va
 * en su propia tanda con tests, no de pasada dentro de otro cambio.
 */
export function useMovimientoReducido(): boolean {
  const [reducido, setReducido] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const alCambiar = () => setReducido(mq.matches)
    mq.addEventListener?.('change', alCambiar)
    return () => mq.removeEventListener?.('change', alCambiar)
  }, [])

  return reducido
}
