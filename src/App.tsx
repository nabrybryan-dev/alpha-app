import { lazy, Suspense } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from './app/ErrorBoundary'
import { MovimientoProvider } from './app/MovimientoProvider'
import { AppRouter } from './app/router'
import { esRutaPublica } from './app/rutasPublicas'
import { SessionProvider } from './app/SessionProvider'
import { ThemeProvider } from './app/ThemeProvider'

// Público y sin sesión: no pasa por `SessionProvider` (ver `app/rutasPublicas.ts`).
const InteresadosPage = lazy(() => import('./features/interesados/InteresadosPage'))

function App() {
  return (
    <ErrorBoundary pantallaCompleta>
      <ThemeProvider>
        {/* Va por fuera del router: el nivel de movimiento es de la app entera,
            no de una pantalla, y remontarlo en cada navegación volvería a medir
            la fluidez cada vez. */}
        <MovimientoProvider>
          {esRutaPublica(window.location.pathname) ? (
            <BrowserRouter>
              <Suspense fallback={null}>
                <InteresadosPage />
              </Suspense>
            </BrowserRouter>
          ) : (
            <SessionProvider>
              <BrowserRouter>
                <AppRouter />
              </BrowserRouter>
            </SessionProvider>
          )}
        </MovimientoProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
