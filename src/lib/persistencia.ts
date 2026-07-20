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
