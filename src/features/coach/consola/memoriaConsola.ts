/**
 * Dónde guarda la consola a quién se está mirando (sessionStorage de esta pestaña del
 * navegador), para que sobreviva a recargar. Vive aparte de `ConsolaCoachPage` para que otra
 * pantalla —la cartera de Equipo— pueda abrir la consola ya puesta en una persona sin
 * importar la consola entera, que va en su propio trozo a demanda.
 */
export const CLAVE_MEMORIA_CONSOLA = 'consola-coach:seleccion'

/**
 * Deja elegida a esta persona para la próxima vez que se abra la consola. Conserva la
 * pestaña que hubiera. sessionStorage puede no existir o lanzar: entonces no hace nada y la
 * consola abre en la primera persona, como siempre.
 */
export function recordarPersonaEnConsola(usuarioId: string): void {
  try {
    const crudo = window.sessionStorage.getItem(CLAVE_MEMORIA_CONSOLA)
    const previa = crudo ? (JSON.parse(crudo) as Record<string, unknown>) : {}
    window.sessionStorage.setItem(CLAVE_MEMORIA_CONSOLA, JSON.stringify({ ...previa, persona: usuarioId }))
  } catch {
    // Sin almacenamiento, la consola abre en la primera persona de la cartera.
  }
}
