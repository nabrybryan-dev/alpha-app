import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from './app/ErrorBoundary'
import { AppRouter } from './app/router'
import { SessionProvider } from './app/SessionProvider'
import { ThemeProvider } from './app/ThemeProvider'

function App() {
  return (
    <ErrorBoundary pantallaCompleta>
      <ThemeProvider>
        <SessionProvider>
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </SessionProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
