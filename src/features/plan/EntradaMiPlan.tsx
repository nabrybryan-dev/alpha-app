import { Link } from 'react-router-dom'
import { rutaMiPlan, useDuenoDelPlan } from './dueno'

/** Entrada a «Mi plan» desde Mi día y Estrategia (Manuela) y desde el panel del coach (Bryan). */
export function EntradaMiPlan() {
  const dueno = useDuenoDelPlan()
  if (dueno === null) return null
  return (
    <Link
      to={rutaMiPlan(dueno)}
      className="press entrada flex min-h-[56px] items-center justify-between gap-3 rounded-tarjeta border border-linea bg-surface-1 px-4 shadow-sm"
    >
      <span className="flex flex-col">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">Organizador</span>
        <span className="text-sm font-semibold text-texto">Mi plan · hoy, semana y 90 días</span>
      </span>
      <span aria-hidden="true" className="text-tenue">›</span>
    </Link>
  )
}
