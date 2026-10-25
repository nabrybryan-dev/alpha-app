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
  /**
   * Los ids de las comidas que se registraron con esta receta ese día, en orden.
   *
   * Se guardan para poder leer de vuelta lo REGISTRADO —gramos y kcal reales— y
   * para que cocinar dos veces la misma receta se vea dos veces. Es opcional
   * porque las anotaciones anteriores a este campo solo traían receta y fecha.
   */
  comidas?: string[]
}

/**
 * Anota una receta cocinada.
 *
 * Sin `comidaId` mantiene la regla de siempre: la misma receta el mismo día no
 * cuenta dos veces. Con `comidaId` guarda cada comida registrada, porque dos
 * veces cocinada son dos comidas aunque la racha siga contando un solo día.
 */
export function anotar(
  probadas: readonly RecetaProbada[],
  recetaId: string,
  fecha: string,
  comidaId?: string,
): RecetaProbada[] {
  if (comidaId === undefined) {
    const yaEsta = probadas.some((p) => p.recetaId === recetaId && p.fecha === fecha)
    if (yaEsta) return [...probadas]
    return [...probadas, { recetaId, fecha }]
  }

  const indice = probadas.findIndex((p) => p.recetaId === recetaId && p.fecha === fecha)
  if (indice === -1) return [...probadas, { recetaId, fecha, comidas: [comidaId] }]

  const actual = probadas[indice]
  const comidas = actual.comidas ?? []
  if (comidas.includes(comidaId)) return [...probadas]
  return probadas.map((p, i) => (i === indice ? { ...actual, comidas: [...comidas, comidaId] } : p))
}

/**
 * Quita la anotación de una receta.
 *
 * Es la mitad que suele faltar. Sin esto, deshacer devolvería las kcal al día
 * pero dejaría la racha subida: el número se quedaría diciendo que cocinó algo
 * que ya no está registrado en ninguna parte.
 *
 * Con `comidaId` quita SOLO esa comida registrada; sin él, la receta entera de
 * ese día —el comportamiento de las anotaciones antiguas—.
 */
export function desanotar(
  probadas: readonly RecetaProbada[],
  recetaId: string,
  fecha: string,
  comidaId?: string,
): RecetaProbada[] {
  if (comidaId === undefined) {
    return probadas.filter((p) => !(p.recetaId === recetaId && p.fecha === fecha))
  }

  const indice = probadas.findIndex((p) => p.recetaId === recetaId && p.fecha === fecha)
  if (indice === -1) return [...probadas]

  const actual = probadas[indice]
  const comidas = (actual.comidas ?? []).filter((id) => id !== comidaId)
  if (comidas.length === 0) return probadas.filter((_, i) => i !== indice)
  return probadas.map((p, i) => (i === indice ? { ...actual, comidas } : p))
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
