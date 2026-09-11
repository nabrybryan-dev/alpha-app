/**
 * El dolor del día, de 0 a 10 (escala visual analógica, EVA).
 *
 * POR QUÉ EXISTE. El check-in preguntaba pasos, sueño, estrés, cansancio,
 * ánimo, hambre y peso — y ni una casilla de dolor. Y el ajuste clínico de una
 * asesorada tenía escrita su condición de reingreso como «EVA ≤2 en todas las
 * sesiones»: una puerta bien redactada que se iba a abrir sin ningún dato
 * detrás, porque la app no tenía dónde apuntarlo.
 *
 * POR QUÉ EL CERO ES UNA RESPUESTA. «Sin dolor» es una medición, no un hueco.
 * Ausente y cero no valen lo mismo —mismo principio que el peso que nadie
 * tocó—, así que el cero se marca a propósito y el campo cuenta como pendiente
 * hasta que se marque.
 *
 * ESTO NO DECIDE QUÉ HACER. Cambiar un ejercicio, frenar una progresión o
 * derivar es decisión del coach. Aquí solo se pone nombre al número, para que
 * dos personas calibren parecido ante lo mismo.
 */

export interface TramoDolor {
  bajo: number
  alto: number
  etiqueta: 'ninguno' | 'leve' | 'moderado' | 'intenso'
  /** Cómo se vive, en palabras del asesorado. */
  descripcion: string
}

export const TRAMOS_DOLOR: readonly TramoDolor[] = [
  { bajo: 0, alto: 0, etiqueta: 'ninguno', descripcion: 'Sin dolor.' },
  { bajo: 1, alto: 3, etiqueta: 'leve', descripcion: 'Lo notas, pero no cambia lo que haces.' },
  { bajo: 4, alto: 6, etiqueta: 'moderado', descripcion: 'Te obliga a cambiar el ejercicio o el ritmo.' },
  { bajo: 7, alto: 10, etiqueta: 'intenso', descripcion: 'Te impide hacer el ejercicio.' },
]

/** El tramo al que pertenece un valor, para poder nombrarlo en pantalla. */
export function tramoDeDolor(dolor: number): TramoDolor {
  if (!Number.isInteger(dolor)) {
    throw new Error(`el dolor se registra en enteros del 0 al 10: ${dolor}`)
  }
  const tramo = TRAMOS_DOLOR.find((t) => dolor >= t.bajo && dolor <= t.alto)
  if (!tramo) throw new Error(`el dolor tiene que estar entre 0 y 10: ${dolor}`)
  return tramo
}

/**
 * A partir de aquí el dolor deja de ser una molestia y pasa a ser una señal
 * para el coach: en el tramo «moderado» ya cambia lo que la persona hace.
 */
export const UMBRAL_DOLOR_QUE_AVISA = 4
