import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSesion } from '../../../app/SessionProvider'
import { buscarRuta, type PerfilAcceso } from '../../../app/rutas'
import { CAPACIDADES } from '../../../data/consola/capacidadesStaff'
import { puedeVerPraxis } from '../../../domain/praxis/acceso'
import { usePuestoCoach } from '../../coach/consola/usePuestoCoach'
import { fijarOrganizacionViva, useOrganizacionVisible } from '../../../app/organizacionViva'
import { deshacerUltimoCambioDeOrganizacion, guardarCambioDeOrganizacion, leerOrganizacion } from '../../../data/praxis/organizacion'
import { organizarEncendidoPara, praxisDePruebaPara } from '../../../domain/praxis/rapidezLocal'
import { CapaPraxis, type PuertoDeGuardado } from './CapaPraxis'
import { avisoRealActivo, manejadorDeAvisoDeSalud } from './avisoReal'

/**
 * La capa conectada a la sesión: saca el perfil de quien está dentro y la monta SOLO si esa persona puede ver
 * Praxis (`puedeVerPraxis`, la misma guarda de la ruta `/praxis`). Un asesorado no la recibe mientras
 * `PRAXIS_ABIERTA_A_ASESORADOS` sea `false`.
 *
 * «Avisar a mi coach»: con `VITE_PRAXIS_AVISO_REAL` apagada (por defecto) lleva al chat que la app ya tiene; encendida (solo
 * tras aplicar la 0108) deja UNA fila de aviso con el tipo de señal, sin la frase (`avisoReal.ts`). El aviso por pieza
 * no se ofrece (su nivel no cabe en la 0108).
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
  // Guardado real (0179) solo para las cuentas con organizar encendido; el resto sigue en memoria de la sesión.
  const encendido = organizarEncendidoPara(usuario.id)
  const organizacion = useOrganizacionVisible(usuario.id)
  const guardado = useMemo<PuertoDeGuardado | undefined>(() => {
    if (!encendido) return undefined
    const releer = async () => fijarOrganizacionViva(usuario.id, await leerOrganizacion(usuario.id))
    return {
      guardar: async (accion, pieza) => {
        const r = await guardarCambioDeOrganizacion({ tipo: 'pieza', accion, pieza: pieza.id }, null)
        await releer()
        return r.resultado
      },
      deshacer: async () => {
        const r = await deshacerUltimoCambioDeOrganizacion()
        await releer()
        return r.resultado
      },
      ocultasGuardadas: organizacion.ocultas,
    }
  }, [encendido, usuario.id, organizacion.ocultas])
  if (usuario.rol === 'asesorado' && cargando) return null
  // La puerta de siempre, más la excepción de prueba por cuenta (asesorado puro de Bryan); la bandera general sigue cerrada.
  if (!puedeVerPraxis(usuario.rol, undefined, esCoach) && !praxisDePruebaPara(usuario.id)) return null
  return (
    <CapaPraxis
      perfil={perfil}
      guardado={guardado}
      pantallaActual={buscarRuta(pathname)?.patron ?? pathname}
      navegar={navegar}
      alAvisarCoachDeSalud={manejadorDeAvisoDeSalud({ activo: avisoRealActivo(), usuarioId: usuario.id, navegar })}
      alAbrirCheckin={() => navegar('/bienestar')}
    />
  )
}
