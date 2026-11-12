import { decidirConGramaticaYModelo } from '../../../app/clienteOrganizarPraxis'
import { sePuedeConsultarAlModelo, type DecisionDeOrganizacion } from '../../../app/organizacionPraxis'
import { navegarPorFrase, type ResultadoDeNavegar } from '../../../app/navegarPraxis'
import { esOrdenPura } from '../../../domain/praxis/ordenPura'
import { normalizarCharla } from './charla'
import type { ConexionPraxis } from './conexion'

/**
 * Organizar y navegar dentro de la conversación (apagado tras `PRAXIS_ORGANIZAR_NAVEGAR_Y_SALUDO_LOCAL`).
 *
 * REGLA DURA: esto se llama DESPUÉS de `decidirTurno` (filtro de riesgo y de salud). Aquí se vuelve a comprobar con
 * `sePuedeConsultarAlModelo` (riesgo + DE_SALUD) como segundo candado: una frase de riesgo o de salud devuelve `null`
 * sin organizar, sin navegar y sin consultar al modelo.
 */
export type TurnoDeOrganizar =
  | { paso: 'organiza'; decision: DecisionDeOrganizacion }
  | { paso: 'navega'; resultado: Extract<ResultadoDeNavegar, { tipo: 'navego' | 'sin_acceso' }> }

/** Solo una orden corta de ir a lo de hoy navega: «hice 3 series hoy» es un registro, no una orden. */
const ORDEN_DE_IR = /^(llevame|ir|vamos|abre|abreme|muestra|muestrame|quiero ver|ver|me toca|lo de hoy|que me toca|mi dia)\b/

function pareceOrdenDeIr(frase: string): boolean {
  const n = normalizarCharla(frase)
  return n.split(' ').length <= 5 && !/\d/.test(n) && ORDEN_DE_IR.test(n)
}

/** `null` = no es de organizar ni de navegar (o la frase es de riesgo/salud): sigue el camino de siempre. Nunca lanza. */
export async function decidirOrganizarONavegar(frase: string, turno: 'plan' | 'registrar' | 'charlaModelo', c: ConexionPraxis): Promise<TurnoDeOrganizar | null> {
  const o = c.organizar
  if (!o) return null
  if (!sePuedeConsultarAlModelo(frase)) return null
  // Orden pura: con una segunda cláusula pegada no se organiza, no se navega y ni siquiera se consulta al modelo de organizar.
  if (!esOrdenPura(frase)) return null
  try {
    // El modelo solo se consulta cuando la frase iba a un modelo de todos modos; un turno del plan es local y no espera 3 s.
    const consultar = turno === 'plan' ? async () => null : o.consultar
    const decision = await decidirConGramaticaYModelo(frase, o.perfil, o.estado(), consultar)
    if (decision.tipo !== 'no_es_organizacion' && decision.tipo !== 'seguridad') return { paso: 'organiza', decision }
    if (pareceOrdenDeIr(frase)) {
      const r = navegarPorFrase(frase, o.perfil, o.navegar)
      if (r.tipo === 'navego' || r.tipo === 'sin_acceso') return { paso: 'navega', resultado: r }
    }
    return null
  } catch {
    return null
  }
}

/**
 * TODO (apagado): la tarjeta de confirmación de organizar («propone», «traer» con confirmar, «pregunta_cual»…) todavía no
 * existe y los textos los aprueba Bryan aparte. Mientras tanto la decisión queda conectada y esto solo avisa; no guarda ni
 * mueve nada.
 */
export function textoProvisionalDeOrganizar(): string {
  return 'Entendí que quieres organizar la app, pero todavía no puedo hacerlo desde aquí. No cambié nada.'
}
