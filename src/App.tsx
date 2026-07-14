import { BrowserRouter } from 'react-router-dom'
import { AppRouter } from './app/router'
import { SessionProvider } from './app/SessionProvider'
import { ThemeProvider } from './app/ThemeProvider'

function App() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </SessionProvider>
    </ThemeProvider>
  )
}

export default App
