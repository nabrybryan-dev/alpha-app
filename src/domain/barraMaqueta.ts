/**
 * Barra de abajo al estilo de la maqueta v17 (pieza B2 del diseño, decisión de Bryan 5-nov:
 * indicador rojo en la pestaña activa y Praxis al centro; el rojo es el de la app, no el de la maqueta).
 *
 * Apagada por defecto: con `false` la barra es exactamente la píldora flotante de hoy.
 * Encenderla es cambiar esta constante (o pasar `barraMaqueta` a `BottomNav` en una prueba).
 */
export const BARRA_MAQUETA_ACTIVA = false

/** Ruta de la pestaña que va al centro de la barra del equipo. */
export const RUTA_PRAXIS = '/praxis'

/**
 * Devuelve las pestañas con Praxis en el centro. No quita, añade ni cambia ninguna:
 * solo mueve Praxis a la posición central (con una cantidad par, la posición justo
 * a la derecha del medio, p. ej. índice 3 de 6). Sin Praxis (asesorado) devuelve el mismo orden.
 */
export function conPraxisAlCentro<T extends { ruta: string }>(pestanas: readonly T[]): T[] {
  const resto = pestanas.filter((p) => p.ruta !== RUTA_PRAXIS)
  const praxis = pestanas.find((p) => p.ruta === RUTA_PRAXIS)
  if (!praxis) return [...pestanas]
  const centro = Math.floor(pestanas.length / 2)
  return [...resto.slice(0, centro), praxis, ...resto.slice(centro)]
}
