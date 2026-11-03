/**
 * Aprobacion de los PARAMETROS de un plan renovado (migracion 0158), separada de la del plan.
 *
 * Decision de Bryan (2-nov-2026): la firma el coach con su cuenta; la aprobacion vence si
 * cambia cualquiera de los valores y NO se arrastra a un plan nuevo. Este modulo es la parte
 * pura: la forma canonica de los parametros, su igualdad y el estado de la aprobacion.
 * La base vuelve a comprobar la igualdad con jsonb (`aprobar_parametros_plan`).
 */

/** Los parametros en forma canonica: claves ordenadas, sin `undefined`. */
export type ParametrosCanonicos = Record<string, unknown>

export type EstadoAprobacionParametros = 'sin_aprobar' | 'vigente' | 'vencida'

/**
 * Cuantos parametros trae la seccion «10. Parametros para decidir». Los NOMBRES no estan
 * definidos en ningun contrato del repo (el agente los escribe), asi que se exige la cantidad.
 * La RPC `aprobar_parametros_plan` repite este 10 (constante comentada en la 0158).
 */
export const CANTIDAD_DE_PARAMETROS = 10

const CLAVE_SECCION = 'parametros_para_decidir'
const CLAVE_APROBACION_DEL_CONTENIDO = 'aprobacion'

function canonizar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map((x) => (x === undefined ? null : canonizar(x)))
  if (typeof valor === 'object' && valor !== null) {
    const salida: Record<string, unknown> = {}
    for (const clave of Object.keys(valor).sort()) {
      const v = (valor as Record<string, unknown>)[clave]
      if (v !== undefined) salida[clave] = canonizar(v)
    }
    return salida
  }
  return valor
}

/** Claves ordenadas (tambien en lo anidado) y sin `undefined`. El orden de las listas se respeta. */
export function canonizarParametros(parametros: Record<string, unknown>): ParametrosCanonicos {
  return canonizar(parametros) as ParametrosCanonicos
}

/** Igualdad de dos conjuntos de parametros, sin importar el orden de las claves. */
export function parametrosIguales(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return JSON.stringify(canonizarParametros(a)) === JSON.stringify(canonizarParametros(b))
}

/**
 * Los parametros que se aprueban: `contenido.parametros_para_decidir` SIN la clave
 * `aprobacion` (esa es el estado que escribe el agente, no un valor a decidir).
 * `undefined` si el contenido no trae la seccion.
 */
export function parametrosDeContenido(contenido: unknown): ParametrosCanonicos | undefined {
  if (typeof contenido !== 'object' || contenido === null) return undefined
  const seccion = (contenido as Record<string, unknown>)[CLAVE_SECCION]
  if (typeof seccion !== 'object' || seccion === null || Array.isArray(seccion)) return undefined
  const valores: Record<string, unknown> = { ...(seccion as Record<string, unknown>) }
  delete valores[CLAVE_APROBACION_DEL_CONTENIDO]
  return canonizarParametros(valores)
}

/**
 * `sin_aprobar`: nadie aprobo estos parametros. `vigente`: lo aprobado es igual a lo que trae
 * el plan ahora. `vencida`: hubo aprobacion y el plan ya trae otra cosa (o ya no trae la seccion).
 */
export function estadoDeAprobacionDeParametros(
  aprobado: Record<string, unknown> | null | undefined,
  vigente: Record<string, unknown> | null | undefined,
): EstadoAprobacionParametros {
  if (!aprobado) return 'sin_aprobar'
  if (!vigente) return 'vencida'
  return parametrosIguales(aprobado, vigente) ? 'vigente' : 'vencida'
}

/** ¿La seccion trae exactamente los diez parametros? `{}`, nueve u once no se aprueban. */
export function traeLosDiezParametros(parametros: Record<string, unknown> | undefined): boolean {
  if (!parametros) return false
  return Object.keys(canonizarParametros(parametros)).length === CANTIDAD_DE_PARAMETROS
}
