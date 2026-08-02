import type { NivelVolumen } from './types'

/**
 * Qué grupos manda el bloque, según lo que el coach pautó en la hoja PERFIL.
 *
 * Ojo: esto NO es la fatiga. La fatiga es el volumen que la persona ya
 * ejecutó (`domain/fatiga.ts`); esto es la intención del programa. Se parecen
 * en pantalla y significan cosas distintas.
 */

const ORDEN: Record<NivelVolumen, number> = {
  'Muy Alto': 4,
  Alto: 3,
  Normal: 2,
  Bajo: 1,
  'Muy Bajo': 0,
}

export interface GrupoPrioritario {
  grupo: string
  nivel: NivelVolumen
}

/**
 * Los dos grupos con más volumen pautado y el que menos, que es lo que hace
 * legible el sesgo del bloque: sin el más bajo, tres chips altos no dicen que
 * algo se dejó a propósito en mantenimiento.
 *
 * Se ignoran los 'Normal': no aportan contraste. Si todos son normales, no hay
 * nada que destacar y devuelve vacío.
 */
export function prioridadDeVolumen(
  volumenSemanal: Readonly<Record<string, NivelVolumen>>,
): GrupoPrioritario[] {
  const grupos = Object.entries(volumenSemanal).map(([grupo, nivel]) => ({ grupo, nivel }))
  const altos = grupos
    .filter((g) => ORDEN[g.nivel] >= ORDEN.Alto)
    .sort((a, b) => ORDEN[b.nivel] - ORDEN[a.nivel])
    .slice(0, 2)
  const bajo = grupos
    .filter((g) => ORDEN[g.nivel] <= ORDEN.Bajo)
    .sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel])[0]

  return bajo ? [...altos, bajo] : altos
}
