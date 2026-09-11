/**
 * El embudo del permiso de avisos: quién vio la petición, quién dijo que sí, y
 * quién sigue vivo a los siete días.
 *
 * **Los tres números, no uno.** El que todo el mundo mira es «cuántos
 * aceptaron», y es el que menos dice: lo que se rompe de verdad en los avisos
 * no es el primero, es el de la tercera semana, cuando el navegador rotó la
 * suscripción por su cuenta o la persona revocó el permiso sin acordarse. Por
 * eso el tercer número existe y es el que manda.
 *
 * Y **la línea está escrita antes de ver el resultado**, a propósito: si
 * esperamos a tener el número y luego opinamos, siempre encontraremos la manera
 * de que nos parezca bien.
 */

/** Lo que decidió una persona, tal como quedó guardado. */
export interface DecisionDeAviso {
  usuarioId: string
  /** Cuándo se le enseñó la pantalla que explica para qué es. */
  vioEn: string
  /** `true` dijo que sí en NUESTRA pantalla; `false` dijo que ahora no. */
  dijoSi: boolean
  /**
   * Última vez que su teléfono dio señales de vida (recibió un aviso o revalidó
   * su suscripción). Sin esto, «aceptó» y «sigue llegándole» se ven igual.
   */
  vivoEn?: string
}

export interface EmbudoDeAvisos {
  vieron: number
  dijeronSi: number
  vivosALosSieteDias: number
  /** Cuántas personas hay en la cartera, para leer los tres números. */
  cartera: number
}

/** Días que tienen que pasar para que «sigue vivo» signifique algo. */
export const DIAS_PARA_SEGUIR_VIVO = 7

/**
 * Cuántos de los que dijeron que sí siguen vivos **a los siete días de haberlo
 * dicho**. Alguien que aceptó ayer no cuenta ni a favor ni en contra: todavía
 * no ha llegado su séptimo día, y contarlo como muerto hundiría el número por
 * el simple hecho de ser reciente.
 */
function siguenVivos(decisiones: DecisionDeAviso[], ahora: number): number {
  const siete = DIAS_PARA_SEGUIR_VIVO * 86_400_000
  return decisiones.filter((d) => {
    if (!d.dijoSi) return false
    const decidido = Date.parse(d.vioEn)
    if (Number.isNaN(decidido) || ahora - decidido < siete) return false
    const vivo = d.vivoEn ? Date.parse(d.vivoEn) : NaN
    return !Number.isNaN(vivo) && ahora - vivo < siete
  }).length
}

export function embudoDeAvisos(
  decisiones: DecisionDeAviso[],
  cartera: number,
  ahora: number = Date.now(),
): EmbudoDeAvisos {
  // Una persona, una decisión: si la pantalla se le enseñó dos veces, cuenta
  // una. Contar filas en vez de personas inflaría el embudo entero.
  const porPersona = new Map<string, DecisionDeAviso>()
  for (const d of decisiones) {
    const previa = porPersona.get(d.usuarioId)
    if (!previa || Date.parse(d.vioEn) > Date.parse(previa.vioEn)) porPersona.set(d.usuarioId, d)
  }
  const unicas = [...porPersona.values()]

  return {
    vieron: unicas.length,
    dijeronSi: unicas.filter((d) => d.dijoSi).length,
    vivosALosSieteDias: siguenVivos(unicas, ahora),
    cartera,
  }
}

/**
 * La línea, escrita el 2026-09-10 y ANTES de ver ningún número: si al séptimo
 * día han dicho que sí **menos de doce de veintitrés**, la fontanería del
 * empuje se aparca y los recados buscan otra puerta.
 */
export const MINIMO_PARA_CONSTRUIR_EL_EMPUJE = 12

export type Veredicto = 'construir' | 'aparcar' | 'todavia-no-toca'

/**
 * `todavia-no-toca` es de primera clase: mientras no haya pasado una semana
 * desde que se empezó a preguntar, el número no significa nada y decidir con él
 * es decidir a cara o cruz.
 */
export function veredictoDelEmbudo(
  e: EmbudoDeAvisos,
  diasPreguntando: number,
): Veredicto {
  if (diasPreguntando < DIAS_PARA_SEGUIR_VIVO) return 'todavia-no-toca'
  return e.dijeronSi >= MINIMO_PARA_CONSTRUIR_EL_EMPUJE ? 'construir' : 'aparcar'
}
