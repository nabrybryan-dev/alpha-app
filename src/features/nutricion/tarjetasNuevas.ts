/**
 * Bandera de las tarjetas nuevas de Nutricion (aspecto de la maqueta, PR 431).
 * Se decide en el build, como `VITE_MOTOR_APP_ACTIVO`: sin `VITE_NUTRI_TARJETAS_ACTIVO=true`
 * se ve el aspecto de siempre. Se lee en cada llamada para poder probarla.
 */
export const tarjetasNuevasActivas = (): boolean =>
  import.meta.env.VITE_NUTRI_TARJETAS_ACTIVO === 'true'

/** Devuelve la clase nueva con la bandera encendida y la de siempre con ella apagada. */
export const claseTarjeta = (nueva: string, vieja: string): string =>
  tarjetasNuevasActivas() ? nueva : vieja
