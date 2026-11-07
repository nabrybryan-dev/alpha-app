import { Link } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import MiPlanPage from '../plan/MiPlanPage'
import { CLASE_ETIQUETA } from '../plan/comun'
import { AvisosDeSeguridad } from '../equipo/AvisosDeSeguridad'
import { useFiltroSombrero } from '../equipo/filtroSombreros'
import { Sombreros } from '../equipo/Sombreros'
import { useCapacidadesVigentes } from '../equipo/useCapacidadesVigentes'
import { BandejaPlanesRenovados } from './consola/BandejaPlanesRenovados'
import { BandejaPrimerosPlanes } from './consola/BandejaPrimerosPlanes'
import { TarjetaSaludHermes } from './consola/TarjetaSaludHermes'
import { ocupaPuestoCoach } from './consola/usePuestoCoach'

/**
 * «Mi día» del equipo (maqueta 7, paso 9): la banda de trabajo de los tres sombreros, con la
 * seguridad del check-in siempre delante y el trabajo que ya existía —firmas, revisiones,
 * consultas, creadores y el plan— filtrado por sombrero. Debajo, su propio entreno (Yo), que
 * no se pierde: la maqueta lo pide y la persona sigue entrenando.
 *
 * No tiene datos propios: compone las bandejas que ya existen, y cada una se pinta sola si
 * quien mira tiene su capacidad (`aprobar_primer_plan`, `aprobar_plan_estrategico`).
 */
function Entrada({ a, titulo, nota }: { a: string; titulo: string; nota: string }) {
  return (
    <Link
      to={a}
      className="press flex min-h-[56px] items-center justify-between gap-3 rounded-tarjeta border border-linea bg-surface-1 px-4 shadow-sm"
    >
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-texto">{titulo}</span>
        <span className="text-xs text-tenue">{nota}</span>
      </span>
      <span aria-hidden="true" className="text-tenue">›</span>
    </Link>
  )
}

export default function MiDiaCoachPage() {
  const { usuario } = useSesion()
  const { cargando, tiene } = useCapacidadesVigentes()
  const esCoach = ocupaPuestoCoach(usuario.rol, cargando, tiene)
  // El mismo criterio que la Bandeja y Equipo: los nombres y el dolor de la cartera solo se
  // enseñan al coach o a quien tenga `leer_entrenamiento` (revisión ciega del 25-oct).
  const conNombres = esCoach || (!cargando && tiene('leer_entrenamiento'))
  const filtro = useFiltroSombrero()
  const verEntreno = filtro === 'todo' || filtro === 'entreno'
  const verNutricion = filtro === 'todo' || filtro === 'nutricion'
  const verAdministracion = filtro === 'todo' || filtro === 'administracion'

  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex flex-col gap-1 pt-1">
        <p className={CLASE_ETIQUETA}>Tu jornada</p>
        <h2 className="font-display text-3xl leading-none text-texto">Mi día</h2>
        <p className="text-sm text-tenue">
          Entrenamiento, nutrición y administración: tu trabajo de hoy, junto.
        </p>
      </header>

      <Sombreros />

      <AvisosDeSeguridad conNombres={conNombres} />

      {esCoach && <TarjetaSaludHermes />}

      {verNutricion && (
        <>
          <p className={CLASE_ETIQUETA}>Espera tu firma o tu respuesta</p>
          <BandejaPrimerosPlanes />
          <BandejaPlanesRenovados />
        </>
      )}

      {verEntreno && (
        <>
          <Entrada a="/coach/revisiones" titulo="Prescripciones y revisiones" nota="Audios, vídeos y versiones por aprobar." />
          <Entrada a="/coach/consultas" titulo="Preguntas de asesorados" nota="Consultas a Alpha y mensajes sin contestar." />
        </>
      )}

      {verAdministracion && tiene('revisar_creadores') && (
        <Entrada a="/coach/creadores" titulo="Creadores por desempatar" nota="Los que tambalean y esperan tu criterio." />
      )}

      {verAdministracion && <MiPlanPage />}

      <div className="grid grid-cols-1 gap-2.5">
        <Entrada a="/bandeja" titulo="Abrir la Bandeja" nota="Tareas, mensajes y firmas de los tres sombreros." />
        <Entrada a="/empresa" titulo="Ir a Empresa" nota="Las herramientas de cada sombrero, según tus permisos." />
        <Entrada a="/mi-entreno" titulo="Tu entreno" nota="Tu semana, tu sesión y tu propio progreso (Yo)." />
      </div>
    </div>
  )
}
