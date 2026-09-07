import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from './app/ErrorBoundary'
import { MovimientoProvider } from './app/MovimientoProvider'
import { AppRouter } from './app/router'
import { SessionProvider } from './app/SessionProvider'
import { ThemeProvider } from './app/ThemeProvider'

function App() {
  return (
    <ErrorBoundary pantallaCompleta>
      <ThemeProvider>
        {/* Va por fuera del router: el nivel de movimiento es de la app entera,
            no de una pantalla, y remontarlo en cada navegación volvería a medir
            la fluidez cada vez. */}
        <MovimientoProvider>
          <SessionProvider>
            <BrowserRouter>
              <AppRouter />
            </BrowserRouter>
          </SessionProvider>
        </MovimientoProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
