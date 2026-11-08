// Rutas relativas con extensión .ts, como el resto de la función (Deno).
import type { Rol } from '../../../src/domain/praxis/acceso.ts'
import { decisionParaMeta, enrutarPraxis } from '../../../src/domain/praxis/enrutarPraxis.ts'

import { proponerDesdeMensajeLargo, type CampoCheckin } from '../../../src/domain/praxis/registro/mensajeLargo.ts'

/** Lo que el paso de mensajes largos propondría: SOLO nombres de campo y conteos, nunca valores, citas ni texto. */
export interface LargoEnSombra { riesgo: boolean; areas: CampoCheckin[]; descartadas: number; dudosas: number }
export type DecisionEnSombra = ReturnType<typeof decisionParaMeta> & { largo?: LargoEnSombra }

/**
 * Umbral de «frase larga»: 20 palabras o más. Un registro rápido («dormí seis horas», «comí bien y entrené»)
 * rara vez pasa de 10; contar cómo le fue en dos o tres áreas con sus razones empieza hacia las 20. Más bajo mediría
 * ruido del registro rápido; más alto dejaría fuera los mensajes de tres áreas. Ajustable tras mirar frases reales.
 */
export const PALABRAS_MENSAJE_LARGO = 20

/** Calcula el paso de mensajes largos y devuelve solo conteos y nombres de campo. Si falla, devuelve undefined. */
function largoEnSombra(frase: string): LargoEnSombra | undefined {
  if (frase.trim().split(/\s+/).length < PALABRAS_MENSAJE_LARGO) return undefined
  try {
    const r = proponerDesdeMensajeLargo(frase)
    if (r.tipo === 'riesgo') return { riesgo: true, areas: [], descartadas: 0, dudosas: 0 }
    return { riesgo: false, areas: [...new Set(r.propuestas.map((p) => p.campo))].sort(), descartadas: r.descartado.length, dudosas: r.dudosas.length }
  } catch (e) {
    console.error('praxis-registro: largo_sombra falló', e instanceof Error ? e.name : 'error')
    return undefined
  }
}

/**
 * F1 EN SOMBRA (4-nov-2026): lo que diría el enrutador de la Praxis única por reglas. Nadie lo usa para decidir:
 * va en `meta.decision` y en la línea `praxis-registro: decision_sombra`, sin la frase ni la persona, para comparar
 * con lo que hizo la función. Si algo falla aquí, la respuesta a la persona sale igual.
 */
export function decisionEnSombra(s: { rol?: string; usuarioId: string; puesto?: boolean }, frase: string, registroRapido: boolean): DecisionEnSombra | undefined {
  try {
    const base = decisionParaMeta(enrutarPraxis({ frase, rol: (s.rol ?? 'asesorado') as Rol, personaId: s.usuarioId, ocupaElPuesto: s.puesto === true, registroRapido }))
    const largo = largoEnSombra(frase)
    const decision: DecisionEnSombra = largo ? { ...base, largo } : base
    console.log('praxis-registro: decision_sombra', JSON.stringify(decision))
    return decision
  } catch (e) {
    console.error('praxis-registro: decision_sombra falló', e instanceof Error ? e.name : 'error')
    return undefined
  }
}
