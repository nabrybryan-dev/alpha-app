// Rutas relativas con extensión .ts, como el resto de la función (Deno).
import type { Rol } from '../../../src/domain/praxis/acceso.ts'
import { nombresDeCamposParaMeta } from '../../../src/domain/praxis/camposParaTipo.ts'
import { decisionParaMeta, enrutarPraxis } from '../../../src/domain/praxis/enrutarPraxis.ts'

export type DecisionEnSombra = ReturnType<typeof decisionParaMeta> & { campos_por_tipo?: ReturnType<typeof nombresDeCamposParaMeta> }

/**
 * F1 EN SOMBRA (4-nov-2026): lo que diría el enrutador de la Praxis única por reglas. Nadie lo usa para decidir:
 * va en `meta.decision` y en la línea `praxis-registro: decision_sombra`, sin la frase ni la persona, para comparar
 * con lo que hizo la función. Si algo falla aquí, la respuesta a la persona sale igual.
 * F6: `campos_por_tipo` lleva SOLO los nombres de campo que mostraría ese tipo de pregunta, nunca texto de una pieza.
 */
export function decisionEnSombra(s: { rol?: string; usuarioId: string; puesto?: boolean }, frase: string, registroRapido: boolean): DecisionEnSombra | undefined {
  try {
    const base = decisionParaMeta(enrutarPraxis({ frase, rol: (s.rol ?? 'asesorado') as Rol, personaId: s.usuarioId, ocupaElPuesto: s.puesto === true, registroRapido }))
    const campos = nombresDeCamposParaMeta(base.tipo)
    const decision: DecisionEnSombra = { ...base, ...(campos ? { campos_por_tipo: campos } : {}) }
    console.log('praxis-registro: decision_sombra', JSON.stringify(decision))
    return decision
  } catch (e) {
    console.error('praxis-registro: decision_sombra falló', e instanceof Error ? e.name : 'error')
    return undefined
  }
}
