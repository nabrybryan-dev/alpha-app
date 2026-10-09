import type { Microciclo } from './types'

/**
 * El microciclo anterior a `actual` dentro del historial de una persona: el que
 * EMPEZÓ justo antes. Ordena por `fechaInicio` y desempata por `numero`.
 *
 * Lo necesitan la Ruta del asesorado (`calculosDeLaRuta`) y el panel del coach
 * (`datosRutaDe`) para comparar la fuerza, y vivía copiado en los dos.
 *
 * POR QUÉ NO POR `numero`. La numeración se reinicia cuando empieza un bloque
 * nuevo, y el 2026-09-15 ya lo habían hecho tres personas de la cartera: con
 * `numero` a secas, el M3 del bloque nuevo se comparaba con el M2 del bloque viejo
 * y el M1 nuevo se quedaba sin anterior. La fecha no se reinicia. Es la misma
 * regla que ya sigue `mesa_del_sabado` en la base (0055). Decisión de Bryan.
 *
 * Las fechas son ISO (`YYYY-MM-DD`), así que compararlas como texto ordena bien.
 */
export function microcicloAnterior(
  microciclos: readonly Microciclo[],
  actual: Microciclo,
): Microciclo | undefined {
  let anterior: Microciclo | undefined
  for (const m of microciclos) {
    if (m.id === actual.id || !empiezaAntes(m, actual)) continue
    if (!anterior || empiezaAntes(anterior, m)) anterior = m
  }
  return anterior
}

function empiezaAntes(a: Microciclo, b: Microciclo): boolean {
  if (a.fechaInicio !== b.fechaInicio) return a.fechaInicio < b.fechaInicio
  return a.numero < b.numero
}
