import type { ConfirmacionSerie } from './types'

/**
 * LA PAUTA ES UNA SUGERENCIA, NO UN HECHO («como firmar un recibo»).
 *
 * Hasta el 2026-10-03 el registro arrancaba con la carga y las reps de la prescripción ya
 * escritas: quien guardaba sin tocar nada dejaba la pauta como si fuera lo que hizo, y el
 * 87,5 % de los registros de la base eran idénticos a lo prescrito. Ahora una serie solo se
 * guarda cuando la persona la confirma: «Hecho tal cual» (`tal_cual`) o cambiando un número
 * (`editada`). Las dos pantallas de registro (tarjeta de sesión y salón) comparten estas
 * reglas para que no se separen.
 */

/** Lo que se dice cuando el botón de guardar está apagado. */
export const MOTIVO_SIN_CONFIRMAR = 'Toca «Hecho tal cual» o cambia la carga o las reps para guardar.'

/** En el borrador solo se persiste `editada`: `tal_cual` guarda en el acto. */
export type ConfirmacionDeBorrador = Extract<ConfirmacionSerie, 'editada'> | undefined

/** ¿Se puede guardar la serie por el camino de «Guardar»? Solo si ya la editó. */
export function sePuedeGuardar(confirmada: ConfirmacionDeBorrador): boolean {
  return confirmada === 'editada'
}

/**
 * La confirmación tras cambiar un número. Un cambio que deja el mismo valor (el campo
 * normaliza al salir y vuelve a avisar con lo que ya había) NO es una edición.
 */
export function confirmacionTrasCambio(
  actual: ConfirmacionDeBorrador,
  valorAnterior: number,
  valorNuevo: number,
): ConfirmacionDeBorrador {
  return valorNuevo !== valorAnterior ? 'editada' : actual
}
