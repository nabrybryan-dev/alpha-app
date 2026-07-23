import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from '../components/ui/BottomNav'
import { TopBar } from '../components/ui/TopBar'
import { db, hoyIso } from '../data/dbInstance'
import { revisarRecordatorioBienestar } from '../features/bienestar/recordatorio'
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

  // Recordatorio de las 6 pm: al abrir la app, al volver a ella y cada 10 min
  // mientras esté abierta. Solo dispara si falta el check-in de hoy.
  useEffect(() => {
    if (usuario.rol === 'coach') return
    const revisar = () => {
      const hoy = hoyIso()
      const hecho = db.bienestar.byUsuario(usuario.id).some((c) => c.fecha === hoy)
      void revisarRecordatorioBienestar(hecho, hoy)
    }
    revisar()
    const alVolver = () => {
      if (document.visibilityState === 'visible') revisar()
    }
    document.addEventListener('visibilitychange', alVolver)
    const id = window.setInterval(revisar, 10 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      window.clearInterval(id)
    }
  }, [usuario.id, usuario.rol])

  if (usuario.rol === 'coach') return <Navigate to="/coach" replace />

  return (
    <div className="min-h-dvh bg-bg">
      <TopBar titulo={tituloDe(pathname)} />
      {/* overflow-x-clip: ningún pseudo-elemento o borde debe generar scroll
          horizontal; el TopBar (sticky) y la BottomNav (fija) van fuera de main. */}
      <main className="mx-auto max-w-lg overflow-x-clip px-4 pb-28 pt-4">
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
