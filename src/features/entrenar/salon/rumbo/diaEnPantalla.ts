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

/** Qué es el día en pantalla respecto a hoy, en una palabra. */
export function relacionConHoy(dia: DiaRuta, elegido: boolean, hoyIso: string | undefined): string {
  if (dia.esHoy) return 'hoy'
  if (elegido) return 'viendo'
  // La sesión por omisión puede ser de un día YA PASADO (`sesionDestacada` cae atrás cuando
  // no queda ninguna por delante): esa no es la próxima, está atrasada.
  return hoyIso && dia.fechaIso < hoyIso ? 'atrasada' : 'próxima'
}
