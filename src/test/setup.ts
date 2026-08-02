// jsdom no implementa IndexedDB, y ahí es donde esperan los adjuntos que todavía
// no han subido (`lib/depositoAdjuntos.ts`). Sin esto, sus tests no pueden correr.
import 'fake-indexeddb/auto'
import { configure } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

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
