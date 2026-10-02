import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './ErrorBoundary'
import { useEsEscritorio } from '../lib/useEsEscritorio'
import { AsesoradoLayout, CoachLayout } from './layouts'
import { useSesion } from './SessionProvider'

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
const MiDiaCoachPage = lazy(() => import('../features/coach/MiDiaCoachPage'))
const AsesoradosPage = lazy(() => import('../features/coach/AsesoradosPage'))
const AsesoradoDetallePage = lazy(() => import('../features/coach/AsesoradoDetallePage'))
const CoachChatPage = lazy(() => import('../features/coach/CoachChatPage'))
const ConsultasPage = lazy(() => import('../features/coach/ConsultasPage'))
const ConsolaCoachPage = lazy(() => import('../features/coach/consola/ConsolaCoachPage'))
const CreadoresPage = lazy(() => import('../features/coach/creadores/CreadoresPage'))
const AdministracionPage = lazy(() => import('../features/coach/administracion/AdministracionPage'))
const EstrategiasPage = lazy(() => import('../features/coach/administracion/EstrategiasPage'))
const EquipoPage = lazy(() => import('../features/equipo/EquipoPage'))
const MiPlanPage = lazy(() => import('../features/plan/MiPlanPage'))
const MiEntrenoPage = lazy(() => import('../features/entrenar/miEntreno/MiEntrenoPage'))
const RevisionesPage = lazy(() => import('../features/aprobacion/RevisionesPage'))
const EncoderPage = lazy(() => import('../features/entrenar/encoder/EncoderPage'))
const PraxisPage = lazy(() => import('../features/praxis/PraxisPage'))
const PraxisEjemploPage = lazy(() => import('../features/praxis/PraxisEjemploPage'))

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

/** «/»: la portada del asesorado y del staff que entrena; para Bryan, su «Mi día». */
function Inicio() {
  const { usuario } = useSesion()
  return envolver(usuario.rol === 'coach' ? <MiDiaCoachPage /> : <HoyPage />)
}

/** «/coach»: en escritorio abre la consola (marco «Alpha»); en el teléfono, «Mi día». */
function InicioDelCoach() {
  const esEscritorio = useEsEscritorio()
  return <Navigate to={esEscritorio ? '/coach/consola' : '/'} replace />
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AsesoradoLayout />}>
        <Route index element={<Inicio />} />
        <Route path="entrenar" element={envolver(<RutaPage />)} />
        <Route path="entrenar/sesion/:sesionId" element={envolver(<SesionPage />)} />
        {/* La medicion se hace DENTRO de la serie (ver RegistroSerie). Esta
            pantalla es la mesa de trabajo: ajustes, la tanda entera y los
            criterios de la fase 2. Cuelga de Entrenar porque medir la barra es
            parte de entrenar, no una herramienta de coach. */}
        <Route path="entrenar/encoder" element={envolver(<EncoderPage />)} />
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
        {/* Espacios de Manuela (maqueta aprobada 28-sep): «Mi entreno» presenta la semana y
            lleva al salón (/entrenar, que no cambia); «Equipo» reúne cartera y aprobaciones. */}
        <Route path="mi-entreno" element={envolver(<MiEntrenoPage />)} />
        <Route path="equipo" element={envolver(<EquipoPage />)} />
        <Route path="equipo-nutricion" element={envolver(<EquipoNutricionPage />)} />
        {/* Organizador (0098): el plan de Manuela; el de Bryan cuelga de /coach. */}
        <Route path="mi-plan" element={envolver(<MiPlanPage />)} />
        <Route path="equipo-nutricion/cifras" element={envolver(<CifrasAsesoradosPage />)} />
      </Route>
      {/* Praxis (diseño cosmos). Va por fuera de los dos layouts porque es la pantalla
          entera —su cielo ocupa todo y trae su propia barra— y porque la tiene que poder
          abrir el coach, al que `AsesoradoLayout` manda a /coach. La guarda vive en
          `PraxisPage`: solo staff, porque Praxis todavía no está abierta a los
          asesorados (ver `domain/praxis/acceso.ts`). /praxis usa los datos reales de la
          persona con sesión; /praxis/ejemplo conserva la maqueta completa, con datos de
          ejemplo, detrás de la misma guarda. */}
      <Route path="praxis" element={envolver(<PraxisPage />)} />
      <Route path="praxis/ejemplo" element={envolver(<PraxisEjemploPage />)} />
      <Route path="coach" element={<CoachLayout />}>
        <Route index element={<InicioDelCoach />} />
        {/* La cartera de asesorados: portada del coach hasta el rediseño por espacios; ahora se llega
            desde Mi día (teléfono) o desde las pestañas de la consola (escritorio). */}
        <Route path="asesorados" element={envolver(<AsesoradosPage />)} />
        <Route path="asesorado/:usuarioId" element={envolver(<AsesoradoDetallePage />)} />
        <Route path="chat" element={envolver(<CoachChatPage />)} />
        <Route path="consultas" element={envolver(<ConsultasPage />)} />
        {/* Solo lectura: primera entrega de la consola del coach
            (DISENO-CONSOLA-V2.md). Sin migraciones, sin botones que
            escriban; el director revisa el PR antes de fusionar. */}
        <Route path="consola" element={envolver(<ConsolaCoachPage />)} />
        <Route path="revisiones" element={envolver(<RevisionesPage />)} />
        {/* Tablero de creadores (0090, F1): solo lectura; lo abre el coach o quien tenga
            `revisar_creadores` (Manuela). */}
        <Route path="creadores" element={envolver(<CreadoresPage />)} />
        {/* Estrategias (con `responder_mercadeo` o `revisar_creadores`) y Administración (con
            `organizar_plan` o `decisiones_compartidas`); el tablero de la 0102 va dentro y dice
            «pendiente» sin `ver_administracion`. */}
        <Route path="estrategias" element={envolver(<EstrategiasPage />)} />
        <Route path="administracion" element={envolver(<AdministracionPage />)} />
        {/* Organizador (0098): el plan de Bryan. */}
        <Route path="mi-plan" element={envolver(<MiPlanPage />)} />
      </Route>
    </Routes>
  )
}
