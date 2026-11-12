import { consultarLecturaDeOrganizacion } from '../../app/clienteOrganizarPraxis'
import type { EstadoDeOrganizacion } from '../../app/organizacionPraxis'
import type { PerfilAcceso } from '../../app/rutas'
import type { CambioDeOrganizacion, ResultadoDeAplicar } from '../../app/tarjetaDeOrganizacion'
import {
  deshacerUltimoCambioDeOrganizacion, guardarCambioDeOrganizacion, leerOrganizacion,
  type CambioParaGuardar, type DependenciasOrganizacion, type OrganizacionGuardada, type ResultadoDeGuardar,
} from '../../data/praxis/organizacion'
import { sesionDeFunciones } from '../../data/supabase'
import type { ConexionPraxis } from './motor/conexion'

/**
 * La parte de organizar de la conexión real (bandera `PRAXIS_ORGANIZAR_NAVEGAR_Y_SALUDO_LOCAL`): lee lo guardado al
 * empezar, guarda lo que la persona confirma y vuelve a leer después de cada cambio. `estado()` es síncrono (la decisión
 * lo pide así): mientras la primera lectura no llega, vale «nada escondido» y la base rechaza lo que no cuadre.
 */
export function cambioParaGuardar(c: CambioDeOrganizacion): CambioParaGuardar {
  if (c.tipo === 'pieza') return { tipo: 'pieza', accion: c.accion, pieza: c.pieza.id }
  if (c.tipo === 'solo_lo_importante') return { tipo: 'solo_lo_importante', piezas: c.piezas.map((p) => p.id) }
  return { tipo: 'restablecer' }
}

const aResultado = (r: ResultadoDeGuardar): ResultadoDeAplicar => r.resultado

export function crearOrganizarReal(
  usuarioId: string,
  entorno: { perfil: PerfilAcceso; navegar: (ruta: string) => void },
  deps: Partial<DependenciasOrganizacion> = {},
): NonNullable<ConexionPraxis['organizar']> {
  let guardada: OrganizacionGuardada = { version: 0, ocultas: [], hayCambiosParaDeshacer: false }
  let leida = false
  const releer = async (): Promise<void> => { guardada = await leerOrganizacion(usuarioId, deps); leida = true }
  void releer()

  const tras = async (r: ResultadoDeGuardar): Promise<ResultadoDeAplicar> => {
    await releer()
    return aResultado(r)
  }

  return {
    perfil: entorno.perfil,
    estado: (): EstadoDeOrganizacion => ({ ocultas: new Set(guardada.ocultas), hayCambiosParaDeshacer: guardada.hayCambiosParaDeshacer }),
    consultar: async (frase: string) => {
      const sesion = await sesionDeFunciones()
      if (!sesion) return null
      return consultarLecturaDeOrganizacion(frase, { token: sesion.access_token, urlFunciones: `${sesion.url}/functions/v1`, fetch: (...a) => fetch(...a), perfil: entorno.perfil })
    },
    navegar: entorno.navegar,
    aplicar: async (cambio) => {
      // «déjalo como estaba» (P6) es el mismo deshacer que el botón.
      if (cambio.tipo === 'deshacer') return tras(await deshacerUltimoCambioDeOrganizacion(deps))
      // Sin la primera lectura no se conoce la versión: la base no comprueba choque, pero sí todas sus reglas.
      return tras(await guardarCambioDeOrganizacion(cambioParaGuardar(cambio), leida ? guardada.version : null, deps))
    },
    deshacerUltimo: async () => tras(await deshacerUltimoCambioDeOrganizacion(deps)),
  }
}
