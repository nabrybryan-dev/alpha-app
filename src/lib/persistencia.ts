/**
 * Persistencia local ligera para "borradores" que deben sobrevivir a salir de
 * la app (cambiar a WhatsApp/música) o cerrarla del todo, sin que el asesorado
 * tenga que darle a guardar: el cronómetro en curso y las series a medio llenar.
 * Es localStorage con manejo de errores (cuota llena / modo privado no rompen la
 * sesión de entreno). No reemplaza a la nube: al guardar la serie de verdad, el
 * borrador se borra y el dato queda en la base.
 */

export function leerJSON<T>(clave: string, porDefecto: T): T {
  try {
    const crudo = localStorage.getItem(clave)
    return crudo ? (JSON.parse(crudo) as T) : porDefecto
  } catch {
    return porDefecto
  }
}

export function escribirJSON(clave: string, valor: unknown): void {
  try {
    localStorage.setItem(clave, JSON.stringify(valor))
  } catch {
    // sin espacio o modo privado: un borrador perdido no es crítico
  }
}

export function borrarClave(clave: string): void {
  try {
    localStorage.removeItem(clave)
  } catch {
    // noop
  }
}

/**
 * Prefijos de todo lo que este módulo deja en el teléfono.
 *
 * `alpha-notif-bienestar` no lleva id de usuario y por eso también entra aquí:
 * si no se borra, la marca de "ya te avisé hoy" de una persona deja sin
 * recordatorio a la siguiente que use el mismo teléfono.
 */
const PREFIJOS_BORRADORES = ['alpha-crono-', 'alpha-descanso-', 'alpha-serie-', 'alpha-notif-']

/**
 * Borra los borradores al cerrar sesión.
 *
 * Sobrevivir a que se cierre la app es justo lo que se busca durante un
 * entreno, pero no que sobrevivan a un cambio de persona: son kilos, reps y
 * RIR a medio escribir, y en un teléfono compartido acaban en la pantalla de
 * quien entra después.
 */
export function limpiarBorradoresLocales(): void {
  try {
    const suyas = Object.keys(localStorage).filter((clave) =>
      PREFIJOS_BORRADORES.some((prefijo) => clave.startsWith(prefijo)),
    )
    for (const clave of suyas) localStorage.removeItem(clave)
  } catch {
    // noop
  }
}
