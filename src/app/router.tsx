import { lazy, Suspense, type ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './ErrorBoundary'
import { AsesoradoLayout, CoachLayout } from './layouts'

const HoyPage = lazy(() => import('../features/hoy/HoyPage'))
const MicrocicloPage = lazy(() => import('../features/entrenar/MicrocicloPage'))
const SesionPage = lazy(() => import('../features/entrenar/SesionPage'))
const BienestarPage = lazy(() => import('../features/bienestar/BienestarPage'))
const NutricionPage = lazy(() => import('../features/nutricion/NutricionPage'))
const ChatPage = lazy(() => import('../features/chat/ChatPage'))
const CuestionariosPage = lazy(() => import('../features/cuestionarios/CuestionariosPage'))
const ContenidosPage = lazy(() => import('../features/contenidos/ContenidosPage'))
const LogrosPage = lazy(() => import('../features/logros/LogrosPage'))
const MarcaPage = lazy(() => import('../features/marca/MarcaPage'))
const EquipoNutricionPage = lazy(() => import('../features/nutri/EquipoNutricionPage'))
const AsesoradosPage = lazy(() => import('../features/coach/AsesoradosPage'))
const AsesoradoDetallePage = lazy(() => import('../features/coach/AsesoradoDetallePage'))
const CoachChatPage = lazy(() => import('../features/coach/CoachChatPage'))

function Cargando() {
  return <p className="p-6 text-center text-sm text-tenue">Cargando…</p>
}

function envolver(children: ReactNode) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Cargando />}>{children}</Suspense>
    </ErrorBoundary>
  )
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AsesoradoLayout />}>
        <Route index element={envolver(<HoyPage />)} />
        <Route path="entrenar" element={envolver(<MicrocicloPage />)} />
        <Route path="entrenar/sesion/:sesionId" element={envolver(<SesionPage />)} />
        <Route path="bienestar" element={envolver(<BienestarPage />)} />
        <Route path="nutricion" element={envolver(<NutricionPage />)} />
        <Route path="chat" element={envolver(<ChatPage />)} />
        <Route path="cuestionarios" element={envolver(<CuestionariosPage />)} />
        <Route path="contenidos" element={envolver(<ContenidosPage />)} />
        <Route path="logros" element={envolver(<LogrosPage />)} />
        <Route path="marca" element={envolver(<MarcaPage />)} />
        <Route path="equipo-nutricion" element={envolver(<EquipoNutricionPage />)} />
      </Route>
      <Route path="coach" element={<CoachLayout />}>
        <Route index element={envolver(<AsesoradosPage />)} />
        <Route path="asesorado/:usuarioId" element={envolver(<AsesoradoDetallePage />)} />
        <Route path="chat" element={envolver(<CoachChatPage />)} />
      </Route>
    </Routes>
  )
}
