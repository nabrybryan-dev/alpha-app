// jsdom no implementa IndexedDB, y ahí es donde esperan los adjuntos que todavía
// no han subido (`lib/depositoAdjuntos.ts`). Sin esto, sus tests no pueden correr.
import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

/**
 * `Blob` de jsdom viene sin `text()` ni `arrayBuffer()`: solo trae `size` y
 * `type`. Los navegadores los tienen desde hace años, así que el código de
 * producción los usa con normalidad y es el entorno de test el que se queda
 * corto. Se rellenan con `FileReader`, que jsdom sí implementa.
 *
 * Va aquí y no en `src/`: no es un problema de la app, y meter el apaño en el
 * código de producción haría creer al siguiente que hay navegadores sin esto.
 */
function leerComoBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => resolver(lector.result as ArrayBuffer)
    lector.onerror = () => rechazar(lector.error ?? new Error('No se pudo leer el Blob'))
    lector.readAsArrayBuffer(blob)
  })
}

if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob) {
    return leerComoBuffer(this)
  }
}

if (typeof Blob !== 'undefined' && typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = async function text(this: Blob) {
    return new TextDecoder().decode(await leerComoBuffer(this))
  }
}

/**
 * Espera por defecto de `findBy*` / `waitFor`: 10 s en vez de 1 s.
 *
 * Todas las rutas se cargan con `React.lazy` (`app/router.tsx`), así que casi
 * cualquier test que renderice una pantalla espera a que se resuelva un import
 * dinámico. Con el segundo por defecto, esos tests fallaban de forma intermitente
 * cuando la máquina iba cargada —suite completa en paralelo, o con la
 * instrumentación de cobertura encima— sin que hubiera nada roto: llegaron a caer
 * `SesionPage.cambio-de-sesion` y `router.test`, cada uno en una corrida distinta.
 *
 * Subir la espera no debilita nada: una aserción que de verdad no se cumple sigue
 * fallando, solo tarda más en rendirse. Lo que elimina es el falso rojo, que es
 * peor que no tener test, porque enseña a ignorar la suite.
 *
 * Tiene que quedar **por debajo** del `testTimeout` de `vitest.config.ts`: si la
 * espera de la aserción es mayor que el límite del test, el test muere por timeout
 * antes de que la espera pueda rendirse, y el mensaje de error no dice qué elemento
 * faltaba. Ese fue exactamente el fallo intermitente que costó dos diagnósticos.
 */
configure({ asyncUtilTimeout: 10_000 })

/**
 * Limpiar el DOM después de cada test, a mano.
 *
 * `@testing-library/react` ya registra su propio `afterEach(cleanup)`, pero lo hace
 * al CARGARSE el módulo, y como vive en `node_modules`, Vitest lo externaliza y no
 * lo recarga entre archivos de test. En un proceso único (`--poolOptions.forks
 * .singleFork`, `--no-isolate`, `singleThread`) ese hook queda registrado una sola
 * vez, en el contexto del PRIMER archivo que corre. Del segundo en adelante nadie
 * limpia, y como el `document` también está compartido, el DOM se acumula sin techo:
 * las queries empiezan a encontrar elementos de tests anteriores
 * (`Found multiple elements`) y cada búsqueda recorre un `body` cada vez más grande.
 *
 * Eso fue exactamente la corrida del 2026-09-07: 390 tests rojos en 3 h 11 m. Los
 * mismos 72 archivos, con este hook puesto, dieron 5 rojos en 56 s. Ninguno de los
 * 390 era un bug de la app.
 *
 * Este archivo es FUENTE, así que Vitest sí lo re-ejecuta por cada archivo de test
 * y el hook se vuelve a registrar en todos. Que en el primer archivo `cleanup()`
 * corra dos veces es inocuo: es idempotente.
 */
afterEach(() => {
  cleanup()
})
