import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useLectura } from '../../components/ui/useLectura'
import { planItems } from '../../data/consola/planItems'
import { isoLocal, principalSinEmpezar, type Dueno } from '../../domain/planOrganizador'
import { CLASE_BOTON_CHICO } from './comun'
import { rutaMiPlan, useDuenoDelPlan } from './dueno'

/**
 * Banner al abrir la app: si la tarea principal de hoy sigue sin empezar, la dice y lleva a
 * «Mi plan». Se puede cerrar por hoy. Es un aviso DENTRO de la app: no usa notificaciones del
 * sistema (ver `organizador-NOTAS.md`: el envío por push necesita un servicio que no existe).
 *
 * Si la lectura falla o no hay plan, no dice nada: un banner que avisa de más enseña a
 * ignorarlo, y el error de lectura ya se ve en la pantalla «Mi plan».
 */
const CLAVE = 'alpha.plan.banner-cerrado'

function cerradoHoy(hoy: string): boolean {
  try {
    return window.sessionStorage.getItem(CLAVE) === hoy
  } catch {
    return false
  }
}

/** Solo quien tiene plan (coach o staff) lo consulta: un asesorado no hace ni la petición. */
export function BannerPlanHoy() {
  const dueno = useDuenoDelPlan()
  return dueno === null ? null : <Banner dueno={dueno} />
}

function Banner({ dueno }: { dueno: Dueno }) {
  const { pathname } = useLocation()
  const hoy = isoLocal(new Date())
  const [cerrado, setCerrado] = useState(() => cerradoHoy(hoy))
  const { lectura } = useLectura(planItems)

  if (cerrado) return null
  if (pathname === '/mi-plan' || pathname === '/coach/mi-plan') return null
  if (!lectura?.ok) return null
  const principal = principalSinEmpezar(lectura.datos, dueno, hoy)
  if (!principal) return null

  return (
    <aside
      role="status"
      aria-label="Tu tarea principal de hoy"
      className="mx-auto flex max-w-lg flex-wrap items-center gap-2 border-b border-linea bg-surface-2 px-4 py-2 text-sm text-texto"
    >
      <span className="min-w-0 flex-1">
        Tu tarea principal de hoy sigue sin empezar: <strong>{principal.titulo}</strong>
      </span>
      <Link to={rutaMiPlan(dueno)} className={`${CLASE_BOTON_CHICO} border-rojo text-rojo`}>
        Ver mi plan
      </Link>
      <button
        type="button"
        className={CLASE_BOTON_CHICO}
        onClick={() => {
          try {
            window.sessionStorage.setItem(CLAVE, hoy)
          } catch {
            /* sin almacenamiento: se cierra solo hasta recargar */
          }
          setCerrado(true)
        }}
      >
        Cerrar por hoy
      </button>
    </aside>
  )
}
