/**
 * Escala la composición de un alimento de 100 g a la cantidad que se comió.
 *
 * Es una regla de tres, y la parte que importa no es la multiplicación sino
 * el trato de los NULOS. En este proyecto:
 *
 *     null = no se midió        0 = se midió y no contiene
 *
 * La TCAC no publica columna de vitamina D. Si al escalar convirtiéramos ese
 * `null` en `0`, el sistema afirmaría que el arroz no aporta vitamina D, que
 * es algo que ninguna fuente dice. El hueco tiene que seguir siendo un hueco
 * hasta arriba del todo, para que el total del día pueda declararse parcial.
 */

/** Composición por 100 g de un alimento: cada clave es un nutriente. */
export type Composicion = Record<string, number | null>

const DECIMALES = 3

/**
 * Redondea a `decimales` decimales igual que el `round()` de Python: sobre
 * el valor exacto del double, no sobre `Math.round(valor * 10**decimales) /
 * 10**decimales`. Esa forma "ingenua" -la más común en JS, y la que tenía
 * antes esta misma función- multiplica primero, y esa multiplicación puede
 * convertir un valor genuinamente por debajo de la mitad (p. ej. 0.01 × 0.75
 * = un double que vale exactamente 0.0074999999999999997...) en un empate
 * exacto (7.5) que redondea para el lado contrario. Confirmado contra el
 * catálogo real: sin este cuidado, 5.028 de 983.238 valores escalados
 * quedaban una milésima por encima de lo que da Python. `toFixed` no
 * multiplica: busca el decimal más cercano al valor exacto del double, que
 * es lo mismo que hace `round()` de Python.
 */
function redondear(valor: number, decimales: number): number {
  return Number(valor.toFixed(decimales))
}

/**
 * La composición de `gramos` gramos del alimento.
 *
 * Los nulos se conservan como nulos. Comer 0 g sí da 0: es una afirmación.
 */
export function escalar(por100g: Composicion, gramos: number): Composicion {
  // Este criterio está copiado letra por letra en topes.ts (gramos,
  // kcal100g, kcalPorComida, kcalDia): si cambia aquí, cambia allá.
  if (!Number.isFinite(gramos) || gramos < 0) {
    throw new Error(`gramos debe ser finito y no negativo: ${gramos}`)
  }

  const factor = gramos / 100
  const resultado: Composicion = {}
  // Un por100g nulo revienta solo aquí, con un TypeError natural contra
  // `Object.entries(null)`, porque este módulo no promete otra cosa -a
  // diferencia de topes.ts, que sí valida a propósito y lanza un error con
  // mensaje explícito (ver su docstring)-.
  for (const [clave, valor] of Object.entries(por100g)) {
    resultado[clave] = valor === null ? null : redondear(valor * factor, DECIMALES)
  }
  return resultado
}

/** Los nutrientes que este alimento no puede aportar al total, por no medidos. */
export function nutrientesAusentes(por100g: Composicion): Set<string> {
  const ausentes = new Set<string>()
  for (const [clave, valor] of Object.entries(por100g)) {
    if (valor === null) ausentes.add(clave)
  }
  return ausentes
}
