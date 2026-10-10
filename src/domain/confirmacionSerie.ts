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
 * SIN EL ESFUERZO NO SE GUARDA (decisión del coach, 2026-10-10). El RIR arranca vacío para
 * que nadie guarde el objetivo como propio; pero vacío también se guardaba, y la cadena que
 * arma la semana siguiente no acepta una serie sin RIR. Se pide aquí, con un toque.
 */
export const MOTIVO_SIN_ESFUERZO = 'Marca cuántas repeticiones te quedaban para guardar.'

/**
 * ¿La persona ya dijo cuántas le quedaban? El 0 cuenta: es una respuesta.
 *
 * SE COMPRUEBA QUE SEA UN RIR, no solo que exista: el borrador sale de `localStorage` y
 * nadie lo valida al leerlo. Un `null` o un «Control» de un borrador viejo pasaban un
 * `!== undefined` y se guardaban sin ningún botón marcado (misma trampa que `cumplimiento.ts`).
 */
export function tieneEsfuerzo(rir: unknown): rir is number {
  return typeof rir === 'number' && Number.isInteger(rir) && rir >= 0 && rir <= 5
}

/**
 * ¿Este ejercicio se mide con RIR? Una plancha isométrica o un trabajo de control no tienen
 * repeticiones en reserva (ver `SerieRegistrada.rir`): exigirlo ahí sería inventar el dato
 * que esta regla vino a proteger. Lleva RIR si el objetivo es un número, un rango («2-3») o
 * el FALLO; un objetivo de solo texto («ISOMETRÍA», «CONTROL») o vacío, no.
 */
export function llevaEsfuerzo(rirObjetivo: unknown): boolean {
  if (typeof rirObjetivo === 'number') return Number.isFinite(rirObjetivo)
  if (typeof rirObjetivo !== 'string') return false
  const texto = rirObjetivo.trim().toUpperCase()
  return texto === 'FALLO' || /\d/.test(texto)
}

/**
 * Por qué «Guardar» está apagado, o `null` si ya se puede. Primero el esfuerzo: falta en
 * los dos caminos. `exigeEsfuerzo` = `llevaEsfuerzo(ejercicio.rirObjetivo)`.
 */
export function motivoDeNoGuardar(
  confirmada: ConfirmacionDeBorrador,
  rir: unknown,
  exigeEsfuerzo = true,
): string | null {
  if (exigeEsfuerzo && !tieneEsfuerzo(rir)) return MOTIVO_SIN_ESFUERZO
  return sePuedeGuardar(confirmada) ? null : MOTIVO_SIN_CONFIRMAR
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
