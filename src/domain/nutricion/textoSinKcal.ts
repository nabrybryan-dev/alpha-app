/**
 * QUITAR LAS CALORÍAS DE UN TEXTO LIBRE SIN INVENTAR NADA.
 *
 * El interruptor `verContadorKcal` es clínico: apagado, la persona no debe ver
 * cifras de energía. En los campos estructurados se resuelve no pintando el
 * número, pero hay tres sitios donde la cifra vive dentro de la prosa del coach
 * —el análisis del plan y las notas de una receta— y ahí no hay campo que
 * esconder.
 *
 * LA REGLA ES BORRAR LA FRASE QUE HABLA DE KCAL, no reescribirla. Reescribir
 * («son 148 de las 445 kcal» → «es buena parte de la energía») mete palabras que
 * el coach no firmó y puede cambiar el consejo. Quitar la frase entera deja el
 * resto de la nota intacto y no afirma nada nuevo; si la nota se quedaba sin
 * nada que decir, devuelve vacío y quien la pinta la omite.
 *
 * No toca gramos, porciones ni porcentajes: esos no son calorías.
 */
const MENCIONA_KCAL = /\bkcal\b|\bkilocalor[ií]as?\b/i

/**
 * Corta en frases SOLO cuando hay un signo y un espacio detrás. Partir por
 * `[.!?]` a secas rompía los decimales: «30.5 g» se convertía en dos frases y
 * se podía perder la segunda. El punto y coma no separa: la frase sigue.
 */
function frases(texto: string): string[] {
  return texto.split(/(?<=[.!?])\s+/)
}

export function sinCifrasDeKcal(texto: string): string {
  return frases(texto)
    .filter((frase) => !MENCIONA_KCAL.test(frase))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}
