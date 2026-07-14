import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from '../components/ui/BottomNav'
import { TopBar } from '../components/ui/TopBar'
import { useSesion } from './SessionProvider'

const titulos: Record<string, string> = {
  '/': 'Hoy',
  '/entrenar': 'Entrenar',
  '/bienestar': 'Bienestar',
  '/nutricion': 'Nutrición',
  '/chat': 'Chat',
  '/logros': 'Logros',
  '/contenidos': 'Contenidos',
  '/cuestionarios': 'Cuestionarios',
  '/marca': 'Marca',
}

function tituloDe(ruta: string): string {
  const base = `/${ruta.split('/')[1] ?? ''}`
  return titulos[base] ?? 'Alpha'
}

export function AsesoradoLayout() {
  const { usuario } = useSesion()
  const { pathname } = useLocation()
  if (usuario.rol === 'coach') return <Navigate to="/coach" replace />

  return (
    <div className="min-h-dvh bg-bg">
      <TopBar titulo={tituloDe(pathname)} />
      <main className="mx-auto max-w-lg px-4 pb-28 pt-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

export function CoachLayout() {
  const { usuario } = useSesion()
  if (usuario.rol !== 'coach') return <Navigate to="/" replace />

  return (
    <div className="min-h-dvh bg-bg">
      <TopBar titulo="Panel del coach" />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-4">
        <Outlet />
      </main>
    </div>
  )
}
