// El tope por persona y hora de praxis-registro (sacado de index.ts el 7-nov-2026 para que no creciera al sumar la 0166).
/** Mensajes por persona y hora. 30 → 60 (Bryan, 3-oct-2026): la charla ahora pasa por el modelo y gasta cupo. */
export const MAX_POR_HORA = 60

// Tope por persona y hora. En memoria: se reinicia con la instancia, así que es
// una red contra el abuso y no una cuota exacta (la cuota exacta vive en
// `praxis_extracciones`, que llega con su migración). El ingreso lleva su propia cuenta:
// una prueba completa no se come el cupo del registro.
export const visto = new Map<string, number[]>()
export const vistoIngreso = new Map<string, number[]>()
export function excedeLimite(usuario: string, ahoraMs: number, mapa: Map<string, number[]> = visto, maximo: number = MAX_POR_HORA): boolean {
  const recientes = (mapa.get(usuario) ?? []).filter((t) => ahoraMs - t < 3_600_000)
  if (recientes.length >= maximo) {
    mapa.set(usuario, recientes)
    return true
  }
  recientes.push(ahoraMs)
  mapa.set(usuario, recientes)
  return false
}

