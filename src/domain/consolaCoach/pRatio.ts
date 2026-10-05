/**
 * P-ratio: la fracción del cambio de peso que fue masa magra, entre dos
 * mediciones de la misma persona.
 *
 * Espejo intencional de `herramientas/composicion/composicion.py::p_ratio`
 * (repo `cerebro-alpha-agentes`): misma fórmula, misma causa de
 * indisponibilidad. La maqueta aprobada (`MAQUETA-CONSOLA.html`) y esta
 * herramienta comparten el mismo motivo cuando el dato no es interpretable —
 * nunca un número inventado (DISENO-CONSOLA-V2.md §8.4 y §7.8).
 *
 * 0 = todo lo perdido (o ganado) fue grasa. 1 = todo fue masa magra. En
 * pérdida de peso interesa que sea BAJO; en ganancia, que sea alto.
 */

/**
 * TODO-DECISION (Bryan): el umbral mínimo de |Δpeso| en kg para que el
 * P-ratio se considere interpretable. Copiado literal del valor que usa hoy
 * `composicion.py::p_ratio` (0.1 kg) mientras no exista una decisión propia
 * respaldada por el método y sus pruebas (`test_composicion.py`). No es un
 * valor calibrado para la consola: es el mismo corte que ya usa la
 * herramienta real, para no inventar un criterio nuevo sin que Bryan lo vea.
 */
export const UMBRAL_DELTA_PESO_KG = 0.1

export interface MedidaParaPRatio {
  pesoKg?: number
  masaMagraKg?: number
}

/**
 * Devuelve `undefined` (no interpretable) cuando falta cualquiera de los
 * cuatro datos o cuando |Δpeso| < `UMBRAL_DELTA_PESO_KG` — dividir por un
 * cambio casi nulo no da infinito, da que la pregunta no aplica todavía.
 */
export function pRatio(antes: MedidaParaPRatio, despues: MedidaParaPRatio): number | undefined {
  if (antes.masaMagraKg === undefined || despues.masaMagraKg === undefined) return undefined
  if (antes.pesoKg === undefined || despues.pesoKg === undefined) return undefined

  const deltaPeso = despues.pesoKg - antes.pesoKg
  if (Math.abs(deltaPeso) < UMBRAL_DELTA_PESO_KG) return undefined

  return Math.round(((despues.masaMagraKg - antes.masaMagraKg) / deltaPeso) * 1000) / 1000
}
