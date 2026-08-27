/**
 * Qué hacer cuando el dispositivo se queda sin espacio.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE
 * ─────────────────────────────────────────────────────────────────────────────
 * `localStorage` tiene una cuota por origen: 5 MB en Chrome y Edge, 10 en
 * Firefox. La app escribe ahí dos cosas, y hasta ahora ninguna de las dos
 * comprobaba si cabía:
 *
 *   `alpha-db-v2`     la instantánea entera, en CADA escritura y CADA hidratación
 *   `alpha-cola-sync` las operaciones que todavía no han subido
 *
 * Medido el 2026-08-27 sobre 1.000 asesorados sembrados: al coach le tocan
 * 26.920 bytes por asesorado solo de microciclos, así que **revienta a los 194**.
 * Con 24 va por el 12 % de la cuota. Ver
 * `docs/specs/2026-08-27-informe-de-carga-mil-usuarios.md`.
 *
 * Y no fallaba avisando: `setItem` lanza y nadie lo capturaba. Desde `mutar` eso
 * significa que **la escritura se pierde** —la persona registra algo y no se
 * guarda— sin un error que lo explique.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA REGLA, Y ES LO ÚNICO QUE HAY QUE RECORDAR
 * ─────────────────────────────────────────────────────────────────────────────
 * **La instantánea es una CACHÉ: se puede volver a bajar de la nube.**
 * **La cola NO: es la única copia de lo que aún no ha subido.**
 *
 * Así que cuando no quepan las dos, cede la instantánea. Nunca al revés.
 */

/**
 * ¿Este error es «no cabe»?
 *
 * Cada navegador lo nombra distinto, y los códigos importan tanto como los
 * nombres: Safari en modo privado lanza con el nombre estándar pero Firefox usa
 * el suyo propio.
 */
export function esCuotaLlena(error: unknown): boolean {
  const e = error as { name?: unknown; code?: unknown } | null | undefined
  if (!e || typeof e !== 'object') return false
  return (
    e.name === 'QuotaExceededError' || // Chrome, Edge, Safari
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || // Firefox
    e.code === 22 || // el código estándar, por si el nombre viene vacío
    e.code === 1014 // el de Firefox
  )
}

let sinEspacio = false

/**
 * ¿Se ha quedado sin espacio en algún momento de esta sesión?
 *
 * Lo consulta la interfaz para poder avisar. No se limpia solo con que una
 * escritura vuelva a caber: mientras el aparato esté al límite, la persona tiene
 * que saberlo aunque le entre la siguiente por los pelos.
 */
export function sinEspacioEnElDispositivo(): boolean {
  return sinEspacio
}

export function marcarSinEspacio(): void {
  sinEspacio = true
}

/** Solo para las pruebas: devolver el módulo a cero entre casos. */
export function olvidarSinEspacio(): void {
  sinEspacio = false
}
