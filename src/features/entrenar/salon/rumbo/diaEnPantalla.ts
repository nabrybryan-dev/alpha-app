import type { DiaRuta } from '../../../../domain/rutaEntrenamiento'

/**
 * El índice del día cuya sesión está en pantalla.
 *
 * Con un día elegido en la semana, ese. Sin elegir, el día de la sesión que el salón
 * enseña —que no siempre es hoy: con la de hoy hecha, el salón abre la próxima—. Y si no
 * hay sesión, hoy. La banda de arriba y la semana desplegada leen de aquí para no volver a
 * decir dos días distintos (el 25-oct la banda decía DOMINGO sobre la sesión del lunes).
 */
export function diaEnPantalla(
  semana: readonly DiaRuta[],
  sesionId: string | undefined,
  diaElegido: number | null,
): number {
  if (diaElegido !== null) return diaElegido
  const deLaSesion = sesionId ? semana.findIndex((d) => d.sesionId === sesionId) : -1
  return deLaSesion !== -1 ? deLaSesion : semana.findIndex((d) => d.esHoy)
}
