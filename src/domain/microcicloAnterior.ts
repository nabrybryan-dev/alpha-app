import type { Microciclo } from './types'

/**
 * El microciclo anterior a `actual` dentro del historial de una persona.
 *
 * Lo necesitan la Ruta del asesorado (`calculosDeLaRuta`) y el panel del coach
 * (`datosRutaDe`) para comparar la fuerza, y vivía copiado en los dos.
 */
export function microcicloAnterior(
  microciclos: readonly Microciclo[],
  actual: Microciclo,
): Microciclo | undefined {
  return microciclos
    .filter((m) => m.id !== actual.id && m.numero < actual.numero)
    .sort((a, b) => b.numero - a.numero)[0]
}
