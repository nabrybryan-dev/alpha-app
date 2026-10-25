import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './ErrorBoundary'
import { HistoriaInterna } from './HistoriaInterna'
import { SoloEquipo } from './SoloEquipo'
import { usePuestoCoach } from '../features/coach/consola/usePuestoCoach'
import { AsesoradoLayout, CoachLayout, TableroLayout } from './layouts'
import { useSesion } from './SessionProvider'

const HoyPage = lazy(() => import('../features/hoy/HoyPage'))
const RutaPage = lazy(() => import('../features/entrenar/RutaPage'))
const SesionPage = lazy(() => import('../features/entrenar/SesionPage'))
const BienestarPage = lazy(() => import('../features/bienestar/BienestarPage'))
const SemanaPage = lazy(() => import('../features/semana/SemanaPage'))
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
const AsesoradoDetallePage = lazy(() => import('../features/coach/AsesoradoDetallePage'))
const BandejaPage = lazy(() => import('../features/equipo/BandejaPage'))
const EmpresaPage = lazy(() => import('../features/equipo/EmpresaPage'))
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
const IngresoPruebaPage = lazy(() => import('../features/praxis/IngresoPruebaPage'))
const NoEncontradaPage = lazy(() => import('../features/noEncontrada/NoEncontradaPage'))

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

/**
 * «/»: la portada del asesorado y la del equipo que también entrena. Para el staff es su «Mi día»:
 * la banda de trabajo de los tres sombreros (paso 9) y, debajo, su propio día de asesorado —su
 * check-in, su nutrición y sus medidas, que no se pierden—. La cuenta «Alpha» (rol coach) solo
 * tiene el puesto: no entrena como asesorada y no lleva la segunda mitad.
 */
function Inicio() {
  const { usuario } = useSesion()
  const { esCoach } = usePuestoCoach(usuario.rol)
  if (usuario.rol === 'coach') return envolver(<MiDiaCoachPage />)
  if (usuario.rol === 'nutricionista' || esCoach) {
    return envolver(
      <div className="flex flex-col gap-6">
        <MiDiaCoachPage />
        <HoyPage />
      </div>,
    )
  }
  return envolver(<HoyPage />)
}

export function AppRouter() {
  return (
    <HistoriaInterna>
    <Routes>
      <Route element={<AsesoradoLayout />}>
        <Route index element={<Inicio />} />
        <Route path="entrenar" element={envolver(<RutaPage />)} />
        <Route path="entrenar/sesion/:sesionId" element={envolver(<SesionPage />)} />
        {/* La medicion se hace DENTRO de la serie (ver RegistroSerie). Esta
            pantalla es la mesa de trabajo: ajustes, la tanda entera y los
            criterios de la fase 2. Cuelga de Entrenar porque medir la barra es
            parte de entrenar, no una herramienta de coach. Solo equipo (paso 2). */}
        <Route path="entrenar/encoder" element={envolver(<SoloEquipo destino="/entrenar"><EncoderPage /></SoloEquipo>)} />
        <Route path="bienestar" element={envolver(<BienestarPage />)} />
        <Route path="semana" element={envolver(<SemanaPage />)} />
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
        <Route path="marca" element={envolver(<SoloEquipo><MarcaPage /></SoloEquipo>)} />
        {/* Espacios de Manuela (maqueta aprobada 28-sep): «Mi entreno» presenta la semana y
            lleva al salón (/entrenar, que no cambia); «Equipo» reúne cartera y aprobaciones. */}
        <Route path="mi-entreno" element={envolver(<MiEntrenoPage />)} />
        <Route path="equipo" element={envolver(<SoloEquipo><EquipoPage /></SoloEquipo>)} />
        {/* La FICHA ÚNICA (paso 10): la misma pantalla para el coach y para Manuela. La
            dirección vieja `/coach/asesorado/:id` se conserva abajo, apuntando a esta misma
            pantalla: los enlaces ya enviados no se rompen. */}
        <Route path="equipo/:usuarioId" element={envolver(<SoloEquipo><AsesoradoDetallePage /></SoloEquipo>)} />
        {/* Bandeja (paso 9) y Empresa (paso 11) del equipo; también en la barra del staff. */}
        <Route path="bandeja" element={envolver(<SoloEquipo><BandejaPage /></SoloEquipo>)} />
        <Route path="empresa" element={envolver(<SoloEquipo><EmpresaPage /></SoloEquipo>)} />
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
      {/* La prueba con cronómetro del cuestionario de ingreso (hablando contra escribiendo). Misma guarda que
          /praxis: solo el equipo. No guarda nada. */}
      <Route path="praxis/ingreso-prueba" element={envolver(<IngresoPruebaPage />)} />
      {/* El tablero (la consola del coach) en pantalla completa: la cuenta «Alpha», en los dos computadores.
          Va por fuera de los layouts: sin barra de espacios ni enlaces de panel. */}
      <Route path="tablero" element={<TableroLayout />}>
        <Route index element={envolver(<ConsolaCoachPage />)} />
      </Route>
      <Route path="coach" element={<CoachLayout />}>
        {/* «/coach» ya no cambia con el ancho de pantalla: la cuenta personal vuelve a su Mi día y la cuenta
            «Alpha» (`solo_tablero`) la manda el layout a /tablero. */}
        <Route index element={<Navigate to="/" replace />} />
        {/* La cartera vieja ya no pinta una segunda lista: `/coach/asesorados` redirige a la
            cartera única `/equipo`. La dirección se conserva para los enlaces que ya salieron. */}
        <Route path="asesorados" element={<Navigate to="/equipo" replace />} />
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
      {/* Toda dirección que no existe (decisión de Bryan, 23-oct): una pantalla que lo dice y lleva a Hoy.
          Antes se pintaba en blanco. Va fuera de los layouts, como Praxis. */}
      <Route path="*" element={envolver(<NoEncontradaPage />)} />
    </Routes>
    </HistoriaInterna>
  )
}
