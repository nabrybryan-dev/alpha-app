/**
 * EL PUNTO DE ENGANCHE de la charla con modelo (función de servidor `praxis-charla`, PR #479 y #480, en borrador).
 *
 * Este PR NO llama a ningún modelo externo ni a ninguna función de servidor: define la interfaz y deja el
 * enganche VACÍO. Quien conecte `praxis-charla` registra aquí una implementación con
 * `registrarEngancheDeCharla`, y la capa solo la usa con `PRAXIS_UN_TOQUE_CHARLA` encendida y DESPUÉS de que el
 * filtro de salud del teléfono haya dejado pasar la frase (la capa lo garantiza: una frase de salud nunca
 * llega hasta aquí).
 *
 * Lo que se le manda es SOLO la frase de esa vez (mitigación 1b: nunca nombre, id, perfil, plan ni historial).
 */

/** Una ficha de la respuesta: los dos bloques van SEPARADOS (estudios y criterio de práctica). */
export interface FichaDeCharla {
  id: string
  titulo: string
  /** «Lo que dicen los estudios». Vacío: la ficha no pinta ese bloque. */
  estudios: string
  /** «Criterio de práctica». */
  criterio: string
}

export interface RespuestaDeCharla {
  /** Lo que Praxis dice. */
  texto: string
  fichas: readonly FichaDeCharla[]
}

export interface EngancheDeCharla {
  /** Debe resolver o rechazar: la capa trata un rechazo, `null` o la demora como «sin respuesta». */
  responder(frase: string): Promise<RespuestaDeCharla | null>
}

let enganche: EngancheDeCharla | null = null

export function registrarEngancheDeCharla(e: EngancheDeCharla | null): void {
  enganche = e
}

export function engancheDeCharla(): EngancheDeCharla | null {
  return enganche
}
