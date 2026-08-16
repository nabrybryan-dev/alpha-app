/**
 * Qué cuenta como motivo válido para un veto.
 *
 * Vive aquí, en dominio, y no dentro de la pantalla, porque tiene que decir lo
 * MISMO que el `check` de la migración 0040:
 *
 *   check (length(trim(motivo)) >= 3)
 *
 * Si la pantalla fuera más permisiva que la base, la escritura pasaría la
 * validación local, se encolaría, el upsert reventaría contra el constraint y la
 * cola de descartados tiene tope: el veto se perdería en silencio. La
 * nutricionista lo vería marcado en su pantalla y en la nube no existiría.
 *
 * Es literalmente el fallo que tumbó la 0040 la primera vez. Por eso el número
 * está en un solo sitio y con el nombre puesto.
 */

/** Lo que exige el `check` de la 0040. Cambiar aquí obliga a cambiar allá. */
export const MINIMO_MOTIVO = 3

/**
 * Qué falta para que el motivo valga, o `null` si ya vale.
 *
 * Es la única puerta a propósito: devuelve el texto en vez de un booleano
 * porque la pantalla tiene que poder decir POR QUÉ no deja guardar. Un botón
 * apagado sin explicación se lee como una app rota, y tener además un
 * `esValido()` invitaría a apagarlo sin decir nada.
 */
export function porQueNoValeElMotivo(motivo: string): string | null {
  const limpio = motivo.trim()
  if (limpio.length === 0) return 'Escribe por qué no debe comerlo.'
  if (limpio.length < MINIMO_MOTIVO) return `Al menos ${MINIMO_MOTIVO} letras: «${limpio}» no dice nada.`
  return null
}
