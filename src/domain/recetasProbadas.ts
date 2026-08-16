/**
 * Las recetas que el asesorado ha cocinado de verdad, y su racha.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SOLO CUENTA LO QUE QUEDÓ REGISTRADO
 * ─────────────────────────────────────────────────────────────────────────────
 * Una racha que sube por abrir una hoja no mide nada: mide curiosidad. Aquí
 * solo se anota cuando la receta entra en el registro del día con sus
 * ingredientes, y se desanota si la persona deshace. Así el número dice lo que
 * parece decir —«cociné esto»— y no se infla solo por navegar.
 *
 * Guarda FECHAS, no un contador. Un contador no se puede auditar ni corregir:
 * si alguien pregunta «¿de dónde salen mis 12?», con fechas se responde. Y la
 * racha se deriva con `calcularRacha`, la misma que usa el resto de la app, en
 * vez de inventar aquí una segunda definición de qué es una racha.
 */

import { calcularRacha, type Racha } from './gamification'

export interface RecetaProbada {
  recetaId: string
  /** `YYYY-MM-DD`. El día es la unidad: dos recetas el martes son un martes. */
  fecha: string
}

/** Anota una receta cocinada. Repetir la misma el mismo día no cuenta doble. */
export function anotar(
  probadas: readonly RecetaProbada[],
  recetaId: string,
  fecha: string,
): RecetaProbada[] {
  const yaEsta = probadas.some((p) => p.recetaId === recetaId && p.fecha === fecha)
  if (yaEsta) return [...probadas]
  return [...probadas, { recetaId, fecha }]
}

/**
 * Quita la anotación de una receta.
 *
 * Es la mitad que suele faltar. Sin esto, deshacer devolvería las kcal al día
 * pero dejaría la racha subida: el número se quedaría diciendo que cocinó algo
 * que ya no está registrado en ninguna parte.
 */
export function desanotar(
  probadas: readonly RecetaProbada[],
  recetaId: string,
  fecha: string,
): RecetaProbada[] {
  return probadas.filter((p) => !(p.recetaId === recetaId && p.fecha === fecha))
}

/** Cuántas recetas distintas ha cocinado en total. */
export function distintas(probadas: readonly RecetaProbada[]): number {
  return new Set(probadas.map((p) => p.recetaId)).size
}

/** Días seguidos cocinando alguna. */
export function rachaDeRecetas(probadas: readonly RecetaProbada[], hoy: string): Racha {
  return calcularRacha(
    probadas.map((p) => p.fecha),
    hoy,
  )
}
