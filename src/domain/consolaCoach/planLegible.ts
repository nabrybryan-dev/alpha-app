/**
 * Lee `planes_estrategicos.contenido` (jsonb de forma libre, la fija quien lo genera —
 * `planesEstrategicos.ts`) sin asumir una forma que no está garantizada. Solo se muestran
 * los campos que de verdad existen con el tipo esperado; nada se inventa cuando faltan.
 * Muestra real, comprobada con una consulta de solo lectura sobre `planes_estrategicos`
 * (2026-09-25): `objetivo_largo_plazo`, `metrica_principal`, `horizonte`, `reglas[].texto`,
 * `reglas_derogadas[].texto`. No existe un campo `fase` en ningún plan vigente de hoy, así
 * que esta lectura no lo inventa; si algún día aparece, se añade aquí, no se adivina.
 */
export interface PlanLegible {
  objetivo: string | undefined
  metricaPrincipal: string | undefined
  horizonte: string | undefined
  reglas: string[]
  reglasDerogadas: string[]
  /** true si se pudo leer al menos un campo esperado; false → hay que enseñar el JSON crudo. */
  reconocido: boolean
}

function esTextoNoVacio(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0
}

function textosDeReglas(valor: unknown): string[] {
  if (!Array.isArray(valor)) return []
  const textos: string[] = []
  for (const regla of valor) {
    if (typeof regla !== 'object' || regla === null) continue
    const texto = (regla as Record<string, unknown>).texto
    if (esTextoNoVacio(texto)) textos.push(texto)
  }
  return textos
}

export function leerPlanLegible(contenido: unknown): PlanLegible {
  if (typeof contenido !== 'object' || contenido === null) {
    return {
      objetivo: undefined,
      metricaPrincipal: undefined,
      horizonte: undefined,
      reglas: [],
      reglasDerogadas: [],
      reconocido: false,
    }
  }

  const c = contenido as Record<string, unknown>
  const objetivo = esTextoNoVacio(c.objetivo_largo_plazo) ? c.objetivo_largo_plazo : undefined
  const metricaPrincipal = esTextoNoVacio(c.metrica_principal) ? c.metrica_principal : undefined
  const horizonte = esTextoNoVacio(c.horizonte) ? c.horizonte : undefined
  const reglas = textosDeReglas(c.reglas)
  const reglasDerogadas = textosDeReglas(c.reglas_derogadas)

  const reconocido =
    objetivo !== undefined ||
    metricaPrincipal !== undefined ||
    horizonte !== undefined ||
    reglas.length > 0 ||
    reglasDerogadas.length > 0

  return { objetivo, metricaPrincipal, horizonte, reglas, reglasDerogadas, reconocido }
}
