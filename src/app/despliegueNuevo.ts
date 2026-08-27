/**
 * «Esta sección no se pudo mostrar»: el trozo de código que la app pide ya no
 * existe en el servidor.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ PASA DE VERDAD
 * ─────────────────────────────────────────────────────────────────────────────
 * Las rutas se cargan con `lazy(() => import(...))` (`router.tsx`), así que cada
 * sección viaja en su propio fichero con un hash en el nombre:
 * `NutricionLayout-BuMVtoI_.js`. Al desplegar, ese hash cambia y el fichero
 * viejo deja de existir.
 *
 * Una pestaña que llevaba abierta desde antes del despliegue sigue ejecutando el
 * código antiguo, que pide el nombre antiguo. Y como Vercel reescribe todo a
 * `index.html`, la respuesta ni siquiera es un 404: es HTML donde se esperaba
 * JavaScript. De ahí los cuatro mensajes distintos que reconoce
 * `esModuloQueYaNoExiste`, uno por navegador.
 *
 * Pasa en TODAS las secciones porque todas se cargan igual, y pasa más cuanto
 * más se despliega.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ «REINTENTAR» NO SERVÍA
 * ─────────────────────────────────────────────────────────────────────────────
 * El botón solo limpiaba el estado del `ErrorBoundary` y volvía a renderizar, o
 * sea a pedir EL MISMO fichero que no existe. Falla igual. La única salida era
 * cerrar la app y volver a entrar, que es lo que la persona acababa haciendo.
 *
 * Lo que hace falta es recargar la página: entonces el navegador pide el
 * `index.html` nuevo, que apunta a los nombres nuevos.
 */

/**
 * ¿Es este error «el trozo que pides ya no existe»?
 *
 * Cada motor lo dice a su manera, y el cuarto no menciona módulos siquiera: es
 * el caso de Vercel devolviendo `index.html` con `text/html` donde se esperaba
 * JavaScript.
 */
export function esModuloQueYaNoExiste(error: unknown): boolean {
  const mensaje = error instanceof Error ? error.message : String(error ?? '')
  return (
    /failed to fetch dynamically imported module/i.test(mensaje) || // Chrome, Edge
    /error loading dynamically imported module/i.test(mensaje) || // Firefox
    /importing a module script failed/i.test(mensaje) || // Safari
    // Las dos formas en que Chrome se queja de recibir el `index.html` del
    // rewrite donde esperaba JavaScript. La segunda es la de las versiones
    // viejas; se dejan las dos porque el equipo no actualiza a la vez.
    /expected a javascript module script/i.test(mensaje) ||
    /is not a valid javascript mime type/i.test(mensaje)
  )
}

const CLAVE = 'alpha-recarga-por-despliegue'

/**
 * Cuánto hay que esperar para volver a recargar.
 *
 * Es un FRENO CONTRA EL BUCLE, no una optimización. Si la recarga no arreglara
 * el problema —el servidor sigue sin ese fichero, no hay red— sin este límite
 * la app se recargaría sola una y otra vez, y eso es peor que el error: al menos
 * el error deja leer lo que pasa y tocar un botón.
 *
 * A la segunda dentro de la ventana se deja de insistir y se enseña el aviso.
 */
const VENTANA_MS = 15_000

/**
 * Tira la caché del service worker y lo suelta, para que la recarga vaya a la
 * red de verdad.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ NO BASTA CON RECARGAR, QUE ES LO QUE FALLÓ
 * ─────────────────────────────────────────────────────────────────────────────
 * La primera versión de esto solo llamaba a `location.reload()`, y no arreglaba
 * nada. El motivo: `vite-plugin-pwa` PRECACHEA `index.html`. Así que la recarga
 * la sirve el service worker viejo desde su caché, devuelve el MISMO
 * `index.html` de antes, que pide los MISMOS ficheros que ya no existen, y
 * vuelve a fallar. El freno contra el bucle impedía el segundo intento, y la
 * persona acababa recargando a mano igual que antes.
 *
 * Borrando la caché primero, la recarga no tiene de dónde sacar lo viejo y va a
 * la red.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ NO SE TOCA, Y ES LO QUE IMPORTA
 * ─────────────────────────────────────────────────────────────────────────────
 * `caches` es la Cache Storage API, donde el service worker guarda JS, CSS e
 * imágenes. **No es `localStorage`.** Ni la instantánea (`alpha-db-v2`) ni la
 * cola de lo que falta por subir (`alpha-cola-sync`) viven ahí, así que esto no
 * puede perder ni una serie registrada sin señal.
 *
 * Y soltar el service worker no deja la app sin funcionamiento offline: se
 * vuelve a registrar solo en la carga siguiente, que es justo la que viene.
 */
async function tirarLoViejoYRecargar(recargar: () => void): Promise<void> {
  try {
    if (typeof caches !== 'undefined') {
      const nombres = await caches.keys()
      await Promise.all(nombres.map((n) => caches.delete(n)))
    }
  } catch {
    // Sin permiso o sin soporte: se recarga igual, que a veces basta.
  }

  try {
    const registros = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
    await Promise.all(registros.map((r) => r.unregister()))
  } catch {
    // Ídem.
  }

  recargar()
}

/**
 * Recarga la página, como mucho una vez cada `VENTANA_MS`.
 *
 * Devuelve `true` si va a recargar. Quien llama usa eso para decidir si merece
 * la pena pintar el aviso o si la página está a punto de irse de todas formas.
 *
 * El freno se anota ANTES de la limpieza, que es asíncrona: si llegara un
 * segundo error mientras se borran las cachés, no debe disparar una segunda
 * limpieza a la vez.
 *
 * `ahora` y `recargar` se inyectan para poder probar esto sin recargar el
 * navegador de las pruebas.
 */
export function recargarPorDespliegue(
  ahora: number = Date.now(),
  recargar: () => void = () => window.location.reload(),
): boolean {
  let ultima = 0
  try {
    ultima = Number(sessionStorage.getItem(CLAVE) ?? 0)
  } catch {
    // Modo privado o almacenamiento bloqueado: sin memoria del intento
    // anterior. Se prefiere recargar -que casi siempre arregla- a no hacer nada.
  }

  if (Number.isFinite(ultima) && ahora - ultima < VENTANA_MS) return false

  try {
    sessionStorage.setItem(CLAVE, String(ahora))
  } catch {
    // Si no se puede anotar, el freno no funcionará. Es un mal menor frente a
    // dejar la sección rota sin intentar nada.
  }

  void tirarLoViejoYRecargar(recargar)
  return true
}
