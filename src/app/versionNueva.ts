/**
 * «¿El teléfono está corriendo la app de antes?»
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL FALLO QUE ESTO CIERRA (15-sep-2026)
 * ─────────────────────────────────────────────────────────────────────────────
 * El 14-sep se arregló en producción un fallo de Entrenar (`e.cues.trim`). Al
 * día siguiente Karin, Natalia y Juliana lo seguían viendo: la columna `version`
 * de `errores_navegador` decía que sus teléfonos corrían el build ANTERIOR al
 * arreglo, un día entero después.
 *
 * La app instalada en la pantalla de inicio del iPhone no se vuelve a abrir
 * desde cero: se despierta como quedó. El service worker solo pregunta por una
 * versión nueva al cargar la página (`registerSW.js` escucha `load`), así que
 * un teléfono que nunca recarga nunca se entera. Y aunque se entere, la página
 * que ya está pintada sigue siendo la vieja.
 *
 * Lo peor era el botón: ante un error que NO es de despliegue, «Reintentar»
 * volvía a pintar el mismo código viejo, que fallaba igual. Para siempre.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO SE SABE
 * ─────────────────────────────────────────────────────────────────────────────
 * Cada build deja `version.json` con el sha con el que se construyó (el mismo
 * que viaja en cada error, ver `vite.config.ts`). El teléfono lo pide a la red
 * y lo compara con el suyo. `version.json` NO lo precachea el service worker
 * (solo guarda js, css y html), y se pide con `no-store` y un parámetro que
 * cambia, así que la respuesta es siempre la del servidor de ahora.
 *
 * Ante cualquier duda la respuesta es «no»: sin versión propia (desarrollo,
 * pruebas), sin red, o si el servidor devuelve otra cosa —el rewrite de Vercel
 * contesta con `index.html` si el archivo no existe—. Decir «sí» por error
 * recargaría la app sin motivo; decir «no» por error deja las cosas como
 * estaban antes de este arreglo.
 */

/** Lo que tarda como mucho en contestar. Con mala cobertura no se espera más. */
const ESPERA_MS = 4_000

export async function hayVersionNueva(
  actual: string = (import.meta.env.VITE_VERSION_APP as string | undefined) ?? '',
  pedir: typeof fetch = (...args) => fetch(...args),
): Promise<boolean> {
  if (!actual) return false

  const corte = typeof AbortController !== 'undefined' ? new AbortController() : null
  const reloj = corte ? setTimeout(() => corte.abort(), ESPERA_MS) : null

  try {
    const respuesta = await pedir(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      signal: corte?.signal,
    })
    if (!respuesta.ok) return false
    const cuerpo: unknown = await respuesta.json()
    const publicada =
      cuerpo && typeof cuerpo === 'object' && 'version' in cuerpo
        ? (cuerpo as { version: unknown }).version
        : null
    return typeof publicada === 'string' && publicada !== '' && publicada !== actual
  } catch {
    return false
  } finally {
    if (reloj) clearTimeout(reloj)
  }
}

/** Entre dos preguntas al volver a la app. Volver diez veces en un minuto no son diez. */
const ENTRE_PREGUNTAS_MS = 5 * 60_000

/**
 * Al volver a la app desde segundo plano, pide al service worker que mire si hay
 * versión nueva.
 *
 * Es la otra mitad del arreglo: `registerSW.js` solo pregunta al cargar la
 * página, y el iPhone despierta la app sin cargarla. Con esto la versión nueva
 * se descarga mientras la persona usa la app, y la siguiente vez que la abra ya
 * es la buena. NO recarga nada por su cuenta: recargar a mitad de una serie
 * sería peor que el fallo.
 *
 * Devuelve la función que deja de escuchar.
 */
export function vigilarVersionAlVolver(ahora: () => number = Date.now): () => void {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return () => {}

  let ultima = ahora()
  const alCambiar = () => {
    if (document.visibilityState !== 'visible') return
    if (ahora() - ultima < ENTRE_PREGUNTAS_MS) return
    ultima = ahora()
    try {
      void navigator.serviceWorker
        ?.getRegistration?.()
        .then((registro) => registro?.update())
        .catch(() => {})
    } catch {
      // Sin service worker o sin permiso: no hay nada que actualizar.
    }
  }

  document.addEventListener('visibilitychange', alCambiar)
  return () => document.removeEventListener('visibilitychange', alCambiar)
}
