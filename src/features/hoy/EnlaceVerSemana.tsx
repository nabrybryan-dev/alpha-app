import { Link } from 'react-router-dom'
import { etiquetaVerSemana } from '../../domain/semana/resumen'

interface EnlaceVerSemanaProps {
  /** Solo el asesorado (`nuevo`) lo ve; el Hoy del staff queda como estaba. */
  diseno: 'nuevo' | 'clasico'
  /** Sesiones programadas y hechas de la semana; sin microciclo no hay cuenta. */
  cumplimiento?: { programadas: number; completadas: number }
  /** Cuestionarios asignados y sin responder (los de la cadena no cuentan: ya tienen su tarjeta). */
  cuestionariosPendientes: number
}

/**
 * «Ver toda tu semana» al pie de la revisión, con lo que queda por hacer. La cuenta es la
 * misma que hace Semana: sesiones sin hacer más cuestionarios sin responder.
 */
export function EnlaceVerSemana({ diseno, cumplimiento, cuestionariosPendientes }: EnlaceVerSemanaProps) {
  if (diseno !== 'nuevo') return null
  const sesiones = Math.max(0, (cumplimiento?.programadas ?? 0) - (cumplimiento?.completadas ?? 0))
  return (
    <Link
      to="/semana"
      className="press min-h-11 flex items-center justify-between gap-2 rounded-boton px-1 text-sm font-bold text-texto"
    >
      <span>{etiquetaVerSemana(sesiones + cuestionariosPendientes)}</span>
      <span aria-hidden="true">›</span>
    </Link>
  )
}
