/**
 * El objetivo de intensidad de un ejercicio: un RIR, o el FALLO.
 *
 * ## La regla del método
 *
 * En Alpha las repeticiones son **completas y a rango completo, siempre**, salvo
 * excepción escrita en el propio ejercicio. La serie termina en la última
 * repetición completa.
 *
 * De ahí sale la distinción que este módulo existe para sostener:
 *
 * | Se pauta | Qué se pide |
 * |---|---|
 * | `RIR 0` | La última repetición **completa**. La parcial queda en reserva |
 * | `FALLO` | **Meterse en la parcial**. Trabajar la percepción de máxima intensidad |
 *
 * **No son sinónimos.** `RIR 0` es un techo alcanzado; `FALLO` es la instrucción
 * de sobrepasarlo. Confundirlos hace que el ajuste de carga lea un esfuerzo que
 * no hubo —o que no lea el que sí hubo—, que es el fallo del 24/08 con otra cara.
 *
 * ## Por qué es un campo y no una palabra que se busca en la frase
 *
 * Porque buscarla en la prosa **no funciona**, y está medido. El 2026-08-25 la
 * palabra «fallo» aparecía en 81 prescripciones de producción, y el recuento por
 * contexto dice esto:
 *
 * | Qué significa ahí | Ejemplos del corpus |
 * |---|---|
 * | **Lo contrario** — no te acerques | «CONTROL, SIN FALLO», «LEJOS DEL FALLO SIEMPRE», «SIN LLEGAR AL FALLO», «AQUÍ NO SE BUSCA EL FALLO» |
 * | **Narración de lo que pasó** | «EN M14 LLEGASTE AL FALLO CON 30», «LA SEMANA PASADA LO HICISTE AL FALLO» |
 * | **Ni siquiera es entrenamiento** | «ES UN FALLO MÍO, NO TUYO» |
 * | Una instrucción de verdad | «BAJAS A 85KG HASTA EL FALLO», «48KG X FALLO» |
 *
 * La mayoría son de las tres primeras filas. Un detector por expresión regular
 * habría leído «SIN LLEGAR AL FALLO» como una orden de llegar al fallo —y en una
 * isométrica terapéutica—. Rango 1 de la jerarquía: seguridad.
 *
 * Es la misma lección que `prescripcion.ts` ya aprendió con `cargaKg`: **lo que
 * es un dato se saca de la frase y se pone en un campo.** La frase se compone
 * desde el campo, no al revés.
 */

export const AL_FALLO = 'FALLO'

/** Un RIR objetivo, o el FALLO. Es lo que va en `EjercicioPrescrito.rirObjetivo`. */
export type ObjetivoDeIntensidad = number | typeof AL_FALLO

export function esAlFallo(objetivo: ObjetivoDeIntensidad): objetivo is typeof AL_FALLO {
  return objetivo === AL_FALLO
}

/**
 * El RIR con el que entrar en la tabla de coeficientes %1RM.
 *
 * **Para el FALLO son 0, y no es un apaño: es la lectura correcta.** La columna 0
 * de la tabla es «no queda otra repetición completa», que es exactamente donde
 * termina la parte contada de una serie al fallo. Lo que distingue al FALLO pasa
 * *después* de esa repetición, y son parciales — no entran en el conteo, así que
 * tampoco mueven la carga que hay que poner en la barra.
 *
 * Dicho de otro modo: un ejercicio a 10 reps al fallo lleva **la misma carga** que
 * uno a 10 reps a RIR 0. Lo que cambia es lo que se hace al acabar las 10.
 */
export function rirDeTabla(objetivo: ObjetivoDeIntensidad): number {
  return esAlFallo(objetivo) ? 0 : objetivo
}

/**
 * Aflojar el objetivo N escalones — lo que hace la ondulación cuando la
 * readiness está en rojo o en crítico.
 *
 * La escalera de intensidad tiene al FALLO **por encima de RIR 0**, no en su
 * sitio:
 *
 * ```
 *   FALLO  →  RIR 0  →  RIR 1  →  RIR 2  →  …
 *   (-1)       (0)       (1)       (2)
 * ```
 *
 * Así que aflojar un escalón desde FALLO devuelve `RIR 0` —que sigue siendo
 * durísimo, pero ya no pide la parcial— y no `RIR 1`. Antes de que este módulo
 * existiera, `rirObjetivo + 1` sobre un ejercicio al fallo era una suma sobre una
 * palabra: o reventaba, o —peor— convertía el fallo en `RIR 1` de un salto y
 * nadie lo veía.
 */
export function aflojar(objetivo: ObjetivoDeIntensidad, escalones: number): ObjetivoDeIntensidad {
  const pasos = Math.max(0, Math.round(escalones))
  if (!esAlFallo(objetivo)) return objetivo + pasos
  return pasos === 0 ? AL_FALLO : pasos - 1
}

/** Cómo se escribe en la prescripción y cómo se enseña en pantalla. */
export function textoDeObjetivo(objetivo: ObjetivoDeIntensidad): string {
  return esAlFallo(objetivo) ? AL_FALLO : `RIR ${objetivo}`
}

/**
 * Lee el objetivo de dentro del paréntesis de la cabecera canónica: `(RIR 2)`,
 * `(FALLO)`. Devuelve `undefined` para todo lo demás —`(RIR 2-3)`, `(ISOMETRÍA)`,
 * `(CONTROL)`—, que se transportan como texto y no son un objetivo de intensidad.
 *
 * **Solo mira dentro del paréntesis de la cabecera**, nunca la prosa del coach.
 * Esa es la salvaguarda que hace segura la palabra: dentro del paréntesis
 * «FALLO» solo puede ser una declaración, mientras que en la nota puede ser una
 * negación, un recuerdo o una disculpa.
 */
export function leerObjetivoDeIntensidad(bruto: string): ObjetivoDeIntensidad | undefined {
  const limpio = bruto.trim().toUpperCase()
  if (limpio === AL_FALLO || limpio === 'AL FALLO') return AL_FALLO
  const rir = limpio.match(/^RIR\s+(\d+)$/)
  return rir ? Number(rir[1]) : undefined
}
