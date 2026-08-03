import type { ItemMarcable, Microciclo } from './types'

/**
 * Las notas de la semana: lo que el coach quiere que el asesorado LEA, no que
 * marque como hecho.
 *
 * POR QUÉ EXISTE. Estas notas viajan como un `ItemMarcable` más dentro de
 * `bloquesCardio`, así que se pintaban igual que un bloque de cardio: casilla
 * para marcar, título y una línea de texto gris. Un aviso que arranca un bloque
 * («LEE ESTO: los tres números que cambian») no es una tarea que se tacha, y
 * puesto entre tareas se lee como una más — o no se lee.
 *
 * CÓMO SE DETECTAN. Por el título, que es la convención con la que ya están
 * escritas las que existen. Es una heurística sobre datos vivos, no un campo:
 * cuando el generador de microciclos marque las notas de otra forma, esto se
 * sustituye por esa marca y los tests de abajo siguen valiendo.
 */

const ARRANQUES = ['LEE ESTO', 'LEER:', 'LEE:', 'LÉE', 'IMPORTANTE:', 'ANTES DE EMPEZAR']

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim()
    // Los títulos a veces abren con un emoji («📋 LEE ESTO…»).
    .replace(/^[^A-Z0-9]+/, '')
}

export function esNotaDeLaSemana(bloque: ItemMarcable): boolean {
  const t = normalizar(bloque.titulo)
  return ARRANQUES.some((a) => t.startsWith(normalizar(a)))
}

export interface BloquesSeparados {
  /** Para leer. Se pintan aparte y no llevan casilla. */
  notas: ItemMarcable[]
  /** Para hacer y marcar. Siguen igual que siempre. */
  marcables: ItemMarcable[]
}

export function separarNotas(bloques: readonly ItemMarcable[] = []): BloquesSeparados {
  return {
    notas: bloques.filter(esNotaDeLaSemana),
    marcables: bloques.filter((b) => !esNotaDeLaSemana(b)),
  }
}

/**
 * Todas las notas del microciclo, vengan de la sesión que vengan.
 *
 * La portada las junta porque hoy están escondidas dentro de UNA sesión: quien
 * empieza la semana por otra no las ve nunca.
 */
export function notasDelMicrociclo(microciclo: Microciclo | undefined): ItemMarcable[] {
  if (!microciclo) return []
  return microciclo.sesiones.flatMap((s) => [
    ...separarNotas(s.bloquesCardio).notas,
    ...separarNotas(s.preparacion).notas,
  ])
}
