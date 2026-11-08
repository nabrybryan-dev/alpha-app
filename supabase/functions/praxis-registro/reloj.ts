/* ——— Cronómetro por paso: dónde se van los segundos de cada mensaje ——— */
export interface Reloj { inicio: number; tiempos: Record<string, number>; anotar: (paso: string) => void }
export function cronometro(): Reloj {
  const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
  const inicio = ahora()
  const r: Reloj = { inicio, tiempos: {}, anotar: (paso) => { r.tiempos[paso] = Math.round(ahora() - inicio) } }
  return r
}
/** Anota cuándo terminó la promesa, contando desde el inicio del reloj. */
export function medir<T>(reloj: Reloj, paso: string, p: Promise<T>): Promise<T> {
  return p.finally(() => reloj.anotar(paso))
}
