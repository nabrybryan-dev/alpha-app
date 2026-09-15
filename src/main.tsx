import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import App from './App.tsx'
import { montarMedidor } from './lib/rendimiento'
import { instalarRecogidaDeErrores } from './data/errores/reportarError'
import { vigilarVersionAlVolver } from './app/versionNueva'

// ANTES de pintar: un fallo del primer render también tiene que quedar contado. En modo demo no
// escucha nada. Nunca lanza. Ver `data/errores/reportarError.ts`.
instalarRecogidaDeErrores()

// Al volver a la app desde segundo plano, que el service worker mire si hay versión nueva. El
// iPhone despierta la app sin recargarla y `registerSW.js` solo pregunta al cargar: sin esto un
// teléfono podía seguir un día entero con un fallo ya arreglado. Ver `app/versionNueva.ts`.
vigilarVersionAlVolver()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// EL MEDIDOR DE RENDIMIENTO, y solo si la URL lo pide (`?medir=1`). Sin la bandera esta
// llamada devuelve `null` sin crear un nodo, sin escuchar un evento y sin pedir un solo
// fotograma: quien entra a entrenar no paga un instrumento que nadie va a leer. Va fuera
// del árbol de React a propósito —un panel que se repinta con el estado de la app mediría
// la app con el medidor dentro—. Ver `lib/rendimiento.ts`.
montarMedidor()
