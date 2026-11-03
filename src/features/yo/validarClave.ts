/** El largo mínimo de la clave: el mismo de la pantalla de recuperación (`NuevaClavePage`). */
export const CLAVE_MINIMA = 6

/** El motivo por el que la clave nueva no sirve, o `null` si sirve. */
export function motivoDeClaveInvalida(clave: string, confirmar: string): string | null {
  if (clave.length < CLAVE_MINIMA) return `La contraseña debe tener al menos ${CLAVE_MINIMA} caracteres`
  if (clave !== confirmar) return 'Las dos contraseñas no coinciden'
  return null
}
