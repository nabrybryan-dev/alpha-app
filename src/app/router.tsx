import { lazy, Suspense, type ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './ErrorBoundary'
import { AsesoradoLayout, CoachLayout } from './layouts'

const HoyPage = lazy(() => import('../features/hoy/HoyPage'))
const RutaPage = lazy(() => import('../features/entrenar/RutaPage'))
const SesionPage = lazy(() => import('../features/entrenar/SesionPage'))
const BienestarPage = lazy(() => import('../features/bienestar/BienestarPage'))
const ProgresoPage = lazy(() => import('../features/progreso/ProgresoPage'))
const DiarioDia = lazy(() => import('../features/nutricion/DiarioDia'))
const NutricionLayout = lazy(() => import('../features/nutricion/NutricionLayout'))
const MiPlan = lazy(() => import('../features/nutricion/MiPlan'))
const AlDiaEmbarazo = lazy(() => import('../features/nutricion/AlDiaEmbarazo'))
const ChatPage = lazy(() => import('../features/chat/ChatPage'))
const CuestionariosPage = lazy(() => import('../features/cuestionarios/CuestionariosPage'))
const ContenidosPage = lazy(() => import('../features/contenidos/ContenidosPage'))
const LogrosPage = lazy(() => import('../features/logros/LogrosPage'))
const MarcaPage = lazy(() => import('../features/marca/MarcaPage'))
const EquipoNutricionPage = lazy(() => import('../features/nutri/EquipoNutricionPage'))
const CifrasAsesoradosPage = lazy(() => import('../features/nutri/CifrasAsesoradosPage'))
const AsesoradosPage = lazy(() => import('../features/coach/AsesoradosPage'))
const AsesoradoDetallePage = lazy(() => import('../features/coach/AsesoradoDetallePage'))
const CoachChatPage = lazy(() => import('../features/coach/CoachChatPage'))
const ConsultasPage = lazy(() => import('../features/coach/ConsultasPage'))
const EncoderPage = lazy(() => import('../features/encoder/EncoderPage'))

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
        <Route path="entrenar" element={envolver(<RutaPage />)} />
        <Route path="entrenar/sesion/:sesionId" element={envolver(<SesionPage />)} />
        <Route path="bienestar" element={envolver(<BienestarPage />)} />
        <Route path="progreso" element={envolver(<ProgresoPage />)} />
        {/* Las dos cuelgan del layout: la compuerta se aplica una vez y no
            hay forma de entrar por la URL saltandosela. */}
        <Route path="nutricion" element={envolver(<NutricionLayout />)}>
          <Route index element={<DiarioDia />} />
          <Route path="plan" element={<MiPlan />} />
          {/* Cuelga del layout como las otras dos, así que la compuerta
              también la cubre: nadie llega aquí sin la encuesta hecha. Lo que
              no hace es bloquear —ver `AlDiaEmbarazo`—. */}
          <Route path="al-dia" element={<AlDiaEmbarazo />} />
        </Route>
        <Route path="chat" element={envolver(<ChatPage />)} />
        <Route path="cuestionarios" element={envolver(<CuestionariosPage />)} />
        <Route path="contenidos" element={envolver(<ContenidosPage />)} />
        <Route path="logros" element={envolver(<LogrosPage />)} />
        <Route path="marca" element={envolver(<MarcaPage />)} />
        <Route path="equipo-nutricion" element={envolver(<EquipoNutricionPage />)} />
        <Route path="equipo-nutricion/cifras" element={envolver(<CifrasAsesoradosPage />)} />
      </Route>
      <Route path="coach" element={<CoachLayout />}>
        <Route index element={envolver(<AsesoradosPage />)} />
        <Route path="asesorado/:usuarioId" element={envolver(<AsesoradoDetallePage />)} />
        <Route path="chat" element={envolver(<CoachChatPage />)} />
        <Route path="consultas" element={envolver(<ConsultasPage />)} />
        {/* Cuelga de CoachLayout a proposito: la herramienta de validacion no
            la ve ningun asesorado, ni por la URL. Y sus numeros son
            provisionales mientras la prueba de gravedad no apruebe. */}
        <Route path="encoder" element={envolver(<EncoderPage />)} />
      </Route>
    </Routes>
  )
}
