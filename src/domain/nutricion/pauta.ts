/**
 * Lee una línea del menú del coach y saca lo que se pueda de ella.
 *
 * Las líneas del plan las escribe una persona, a mano, y no siguen ningún
 * formato: "70 g avena", "1 scoop proteína", "2 claras + 1 huevo". Se puede
 * sacar el peso de algunas y de otras no.
 *
 * LO QUE NO SE ENTIENDE SE DICE. Un "1 banano" no son 100 g ni 120: depende del
 * banano. Rellenar ese hueco con un número plausible sería el peor error
 * posible aquí, porque el resultado se ve igual de firme que un dato pesado y
 * nadie podría distinguirlos después. Cuando no hay peso, `gramos` es `null` y
 * la app le pregunta al asesorado en vez de decidir por él.
 */

export interface Pauta {
  /** El texto original, tal como lo escribió el coach. */
  linea: string
  /** Gramos, si la línea los dice. `null` si no se pueden saber. */
  gramos: number | null
  /** El nombre a buscar en el catálogo, sin la cantidad. */
  busqueda: string
}

/** `70 g avena`, `200 ml leche`, `1,5 g sal`. */
const CON_PESO = /^\s*(\d+(?:[.,]\d+)?)\s*(g|gr|gramos|ml)\b\s*(?:de\s+)?(.*)$/i

/** `2 claras + 1 huevo` — dos alimentos en una línea. */
const SEPARADOR = /\s+\+\s+/

/** Una cantidad sin unidad de peso: `1 banano`, `3 huevos`, `1 scoop proteína`. */
const SIN_PESO = /^\s*(?:\d+(?:[.,]\d+)?|[½¼¾])\s*(?:scoop|unidad(?:es)?|taza|cda|cdta)?\s*(.*)$/i

/**
 * Interpreta una línea. Devuelve una pauta por alimento: `2 claras + 1 huevo`
 * son dos cosas distintas y hay que poder pesarlas por separado.
 */
export function leerPauta(linea: string): Pauta[] {
  return linea
    .split(SEPARADOR)
    .map((trozo) => unaPauta(trozo, linea))
    .filter((p) => p.busqueda.length > 0)
}

function unaPauta(trozo: string, original: string): Pauta {
  const conPeso = CON_PESO.exec(trozo)
  if (conPeso) {
    const cantidad = Number(conPeso[1].replace(',', '.'))
    // Los mililitros se tratan como gramos. Es exacto para el agua y una
    // aproximación buena para leche y caldos, que es donde aparece la unidad;
    // no vale para el aceite, pero el aceite se pregunta aparte por la R3.
    return {
      linea: original,
      gramos: Number.isFinite(cantidad) ? cantidad : null,
      busqueda: conPeso[3].trim(),
    }
  }

  const sinPeso = SIN_PESO.exec(trozo)
  return {
    linea: original,
    gramos: null,
    busqueda: (sinPeso ? sinPeso[1] : trozo).trim(),
  }
}

/** Si la línea es una hora (`13:00`) y no un alimento. */
export function esHora(linea: string): boolean {
  return /^\s*\d{1,2}:\d{2}\s*$/.test(linea)
}
