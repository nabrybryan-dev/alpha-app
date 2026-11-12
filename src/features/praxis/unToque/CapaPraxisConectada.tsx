import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSesion } from '../../../app/SessionProvider'
import { buscarRuta, type PerfilAcceso } from '../../../app/rutas'
import { CAPACIDADES } from '../../../data/consola/capacidadesStaff'
import { puedeVerPraxis } from '../../../domain/praxis/acceso'
import { usePuestoCoach } from '../../coach/consola/usePuestoCoach'
import { CapaPraxis } from './CapaPraxis'

/**
 * La capa conectada a la sesión: saca el perfil de quien está dentro y la monta SOLO si esa persona puede ver
 * Praxis (`puedeVerPraxis`, la misma guarda de la ruta `/praxis`). Un asesorado no la recibe mientras
 * `PRAXIS_ABIERTA_A_ASESORADOS` sea `false`.
 *
 * Los dos avisos al coach NO escriben nada nuevo: «Avisar a mi coach» lleva al chat que la app ya tiene, y el aviso
 * por pieza no se ofrece (no existe todavía su camino de escritura; ver la descripción del PR).
 */
export function CapaPraxisConectada() {
  const { usuario } = useSesion()
  const { esCoach, cargando, tiene } = usePuestoCoach(usuario.rol)
  const navegar = useNavigate()
  const { pathname } = useLocation()
  const perfil: PerfilAcceso = useMemo(
    () => ({ rol: usuario.rol, capacidades: new Set(CAPACIDADES.filter((c) => tiene(c))) }),
    [usuario.rol, tiene],
  )
  if (usuario.rol === 'asesorado' && cargando) return null
  if (!puedeVerPraxis(usuario.rol, undefined, esCoach)) return null
  return (
    <CapaPraxis
      perfil={perfil}
      pantallaActual={buscarRuta(pathname)?.patron ?? pathname}
      navegar={navegar}
      alAvisarCoachDeSalud={() => navegar('/chat')}
      alAbrirCheckin={() => navegar('/bienestar')}
    />
  )
}
