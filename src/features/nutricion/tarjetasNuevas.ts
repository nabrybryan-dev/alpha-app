import { useDisenoFinal } from '../../app/organizacionViva'

/**
 * Bandera de las tarjetas nuevas de Nutricion (aspecto de la maqueta, PR 431).
 * Se decide en el build, como `VITE_MOTOR_APP_ACTIVO`: sin `VITE_NUTRI_TARJETAS_ACTIVO=true`
 * se ve el aspecto de siempre. Se lee en cada llamada para poder probarla.
 */
export const tarjetasNuevasActivas = (): boolean =>
  import.meta.env.VITE_NUTRI_TARJETAS_ACTIVO === 'true'

/**
 * Las tarjetas nuevas para quien las debe ver: la bandera de build o, desde el 13-nov-2026, la cuenta con el diseño
 * final (la piel de «Alpha · Rediseño» que validó Bryan). Para cualquier otra cuenta, igual que antes.
 */
export const useTarjetasNuevas = (): boolean => {
  const disenoFinal = useDisenoFinal()
  return tarjetasNuevasActivas() || disenoFinal
}

/** Devuelve la clase nueva con la bandera encendida y la de siempre con ella apagada. */
export const claseTarjeta = (nueva: string, vieja: string, activa: boolean = tarjetasNuevasActivas()): string =>
  activa ? nueva : vieja
