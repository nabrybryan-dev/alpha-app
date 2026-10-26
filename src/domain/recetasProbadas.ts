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
import type { RegistroComida, TipoComida } from './types'

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

/** Lo que deja en el diario una receta al cocinarse: la comida y sus ítems. */
export interface HuellaDeReceta {
  comida: TipoComida
  items: readonly { alimentoId: string; gramos: number }[]
}

/**
 * Pasa al formato nuevo las anotaciones anteriores a `comidas`.
 *
 * Las viejas solo traían receta y fecha, así que no salían en «cocinadas hoy»,
 * que lee lo REGISTRADO. Bryan decidió el 25-oct pasarlas. La comida no guarda
 * de qué receta salió, así que se reconoce por su huella: el mismo día, cocinada
 * por él, en la comida de la receta y con exactamente sus ítems y gramos. Una
 * comida ya reclamada por otra anotación no se vuelve a asignar.
 *
 * Si no aparece ninguna, la anotación se queda como estaba: sigue contando para
 * la racha, que es lo que contaba antes. Mejor eso que adivinar una comida.
 */
export function completarComidasViejas(
  probadas: readonly RecetaProbada[],
  huellaDe: (recetaId: string) => HuellaDeReceta | null,
  comidasDelDia: (fecha: string) => readonly RegistroComida[],
): RecetaProbada[] {
  const reclamadas = new Set(probadas.flatMap((p) => p.comidas ?? []))
  return probadas.map((p) => {
    if (p.comidas !== undefined) return p
    const huella = huellaDe(p.recetaId)
    if (!huella) return p
    const comidas = comidasDelDia(p.fecha)
      .filter((c) => !reclamadas.has(c.id) && encajaConLaHuella(c, huella))
      .map((c) => c.id)
    if (comidas.length === 0) return p
    for (const id of comidas) reclamadas.add(id)
    return { ...p, comidas }
  })
}

function encajaConLaHuella(comida: RegistroComida, huella: HuellaDeReceta): boolean {
  if (!comida.cocinadoPorEl || comida.comida !== huella.comida) return false
  if (comida.items.length !== huella.items.length) return false
  const clave = (i: { alimentoId: string; gramos: number }) => `${i.alimentoId}:${i.gramos}`
  const deLaComida = comida.items.map(clave).sort()
  const deLaReceta = huella.items.map(clave).sort()
  return deLaComida.every((k, i) => k === deLaReceta[i])
}
