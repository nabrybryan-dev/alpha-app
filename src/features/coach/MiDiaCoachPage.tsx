import { Link } from 'react-router-dom'
import MiPlanPage from '../plan/MiPlanPage'
import { CLASE_ETIQUETA } from '../plan/comun'
import { BandejaPlanesRenovados } from './consola/BandejaPlanesRenovados'
import { BandejaPrimerosPlanes } from './consola/BandejaPrimerosPlanes'
import { useCapacidades } from './consola/useCapacidades'

/**
 * «Mi día» de Bryan en el teléfono: la MISMA pantalla de espacios que la de Manuela, con lo de
 * su puesto —sus tareas de hoy (Mi plan) y lo que espera su firma o su respuesta—. No tiene datos
 * propios: compone las bandejas que ya existen, y cada una se pinta sola si quien mira tiene su
 * capacidad (`aprobar_primer_plan`, `aprobar_plan_estrategico`).
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
  const { tiene } = useCapacidades()
  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex flex-col gap-1 pt-1">
        <p className={CLASE_ETIQUETA}>Tu jornada</p>
        <h2 className="font-display text-3xl leading-none text-texto">Mi día</h2>
      </header>

      <p className={CLASE_ETIQUETA}>Espera tu firma o tu respuesta</p>
      <BandejaPrimerosPlanes />
      <BandejaPlanesRenovados />
      <Entrada a="/coach/revisiones" titulo="Prescripciones y revisiones" nota="Audios, vídeos y versiones por aprobar." />
      <Entrada a="/coach/consultas" titulo="Preguntas de asesorados" nota="Consultas a Alpha y mensajes sin contestar." />
      {tiene('revisar_creadores') && (
        <Entrada a="/coach/creadores" titulo="Creadores por desempatar" nota="Los que tambalean y esperan tu criterio." />
      )}

      <MiPlanPage />
    </div>
  )
}
