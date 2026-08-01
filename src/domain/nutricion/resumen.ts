import type { RegistroComida } from '../types'
import type { AlimentoIndice } from './busqueda'
import { escalar } from './porcion'
import type { Item, TotalDia } from './dia'
import { totalDelDia } from './dia'

/**
 * De lo que el asesorado registró a lo que la pantalla enseña.
 *
 * La composición de una comida NO se guarda: en la base solo viven el
 * `alimento_id` y los gramos. Todo lo demás se deriva aquí cada vez. Es a
 * propósito — el día que se corrija un valor del catálogo, los registros viejos
 * se corrigen solos en vez de arrastrar para siempre una cifra equivocada.
 *
 * El catálogo entra como función y no como import para que esto siga siendo
 * lógica pura: se puede probar con tres alimentos inventados sin cargar los
 * 1.195 ni depender de dónde estén guardados.
 */

type BuscarAlimento = (id: string) => AlimentoIndice | undefined

/**
 * Los ítems del día en la forma que espera `totalDelDia`.
 *
 * Un alimento que ya no está en el catálogo se salta. Pasa cuando el coach
 * borra uno que él mismo declaró: el registro viejo sigue en la base -no se
 * pierde- pero no hay con qué calcularlo, y eso es distinto de un cero.
 */
export function itemsDelDia(comidas: RegistroComida[], porId: BuscarAlimento): Item[] {
  const items: Item[] = []
  for (const comida of comidas) {
    for (const item of comida.items) {
      const alimento = porId(item.alimentoId)
      if (!alimento) continue
      items.push({
        por100g: alimento.por100g,
        gramos: item.gramos,
        // El ítem manda sobre la comida: dentro de un almuerzo estimado puede
        // haber un alimento que sí se pesó, y su margen es el suyo.
        // Un ítem estimado NUNCA puede acabar en 'pesado'. La comida nace con
        // esa confianza -es la fase de báscula- y sin este tope, marcar "lo
        // estimé" heredaba ±5 %: la app afirmaba saber con precisión de
        // báscula algo que la persona calculó a ojo.
        confianza: item.fuePesado
          ? 'pesado'
          : comida.confianza === 'pesado'
            ? 'estimado'
            : comida.confianza,
      })
    }
  }
  return items
}

/** Lo que suma el día entero, con su margen ponderado. */
export function resumenDelDia(comidas: RegistroComida[], porId: BuscarAlimento): TotalDia {
  return totalDelDia(itemsDelDia(comidas, porId))
}

/** Lo que suma UNA comida. La fila de cada comida enseña sus propias kcal. */
export function kcalDeComida(comida: RegistroComida, porId: BuscarAlimento): number {
  let kcal = 0
  for (const item of comida.items) {
    const alimento = porId(item.alimentoId)
    if (!alimento) continue
    kcal += escalar(alimento.por100g, item.gramos).kcal ?? 0
  }
  return Math.round(kcal)
}

/**
 * Los alimentos que registró antes, del más reciente al más viejo y sin repetir.
 *
 * Alimenta el chip "Recientes" del buscador. Se ordena por CUÁNDO se comió y no
 * por cuántas veces: quien desayuna lo mismo cada día lo quiere arriba, y quien
 * cambió de dieta la semana pasada no quiere ver lo de antes.
 */
export function alimentosRecientes(comidas: RegistroComida[], tope = 20): string[] {
  const vistos = new Set<string>()
  const ordenadas = [...comidas].sort((a, b) => b.momentoIso.localeCompare(a.momentoIso))
  for (const comida of ordenadas) {
    for (const item of comida.items) {
      if (vistos.size >= tope) return [...vistos]
      vistos.add(item.alimentoId)
    }
  }
  return [...vistos]
}
