/**
 * Cómo una pantalla obedece la organización guardada de la persona (0179): esconde lo que escondió y corre de lugar lo
 * que movió. Puro: recibe la lista en el orden de fábrica y devuelve la que se pinta.
 *
 * Mover N lugares: la pieza salta N vecinos (negativo = hacia arriba) y no sale de la lista. Lo que la persona no tocó
 * conserva su orden de fábrica. Lo que no está en la lista (otra pantalla) no influye.
 */
export interface OrganizacionVisible {
  ocultas: ReadonlySet<string>
  movidas: Readonly<Record<string, number>>
}

export const SIN_ORGANIZACION: OrganizacionVisible = { ocultas: new Set(), movidas: {} }

export function aplicarOrganizacion<T extends { id: string }>(items: readonly T[], org: OrganizacionVisible): T[] {
  const visibles = items.filter((x) => !org.ocultas.has(x.id))
  const clave = (x: T, i: number): number => {
    const k = Math.trunc(org.movidas[x.id] ?? 0)
    return k === 0 ? i : i + k + (k < 0 ? -0.5 : 0.5)
  }
  return visibles
    .map((x, i) => ({ x, c: clave(x, i), i }))
    .sort((a, b) => a.c - b.c || a.i - b.i)
    .map((e) => e.x)
}
