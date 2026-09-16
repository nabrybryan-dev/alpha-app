import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import RevisionesPage from '../src/features/aprobacion/RevisionesPage'
import '../src/styles/tokens.css'

const ancho = new URLSearchParams(location.search).get('ancho') === 'amplio' ? 768 : 390
createRoot(document.getElementById('root')!).render(
  <BrowserRouter><main style={{ maxWidth: ancho, margin: 'auto', padding: 16 }}>
    <p className="mb-4 rounded-boton border border-linea p-2 text-sm">PRUEBA LOCAL · datos ficticios · sin conexión a producción</p>
    <RevisionesPage />
  </main></BrowserRouter>,
)
