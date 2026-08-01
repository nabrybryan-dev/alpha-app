import { escalar, nutrientesAusentes, type Composicion } from './porcion'

/**
 * Suma el día del asesorado y arrastra hasta arriba cuánto se puede confiar.
 *
 * DOS COSAS VIAJAN CON EL TOTAL, y sin ellas el número engaña:
 *
 *   1. **El margen.** No es lo mismo un día pesado en báscula (±5 %) que uno
 *      estimado por alguien sin calibrar (±25 %). El asesorado ve el
 *      número; el motor ve el margen, y con un ±25 % no debería tomar una
 *      decisión fina de déficit.
 *
 *   2. **Los parciales.** Si un alimento del día no tiene medido un
 *      nutriente, el total de ese nutriente está incompleto. Se suma lo que
 *      hay -tirarlo sería peor- pero se dice. Es el mismo patrón de
 *      `recetas.componer()`.
 *
 * El margen se pondera por las kcal de cada ítem: un ítem estimado que
 * aporta 20 kcal no debe ensuciar un día entero bien pesado.
 */

/** Las cuatro procedencias del dato que reconoce el spec (§5). */
export type Confianza = 'pesado' | 'estimado_calibrado' | 'estimado' | 'ajeno'

/** Margen según cómo se obtuvo el dato (spec §5). */
export const MARGENES: Record<Confianza, number> = {
  pesado: 0.05,
  estimado_calibrado: 0.15,
  estimado: 0.25,
  ajeno: 0.3,
}

/** Un alimento del día: su composición por 100 g, cuánto se comió y cómo se supo. */
export interface Item {
  por100g: Composicion
  gramos: number
  confianza: Confianza
}

// Igual que el redondeo de porcion.ts (duplicado a propósito: ver el porqué
// en el comentario de la validación de gramos más abajo). `toFixed` redondea
// sobre el valor exacto del double, como el `round()` de Python -no sobre
// `Math.round(valor * 10**decimales) / 10**decimales`, que multiplica antes
// y esa multiplicación puede empujar un valor real por debajo de la mitad a
// un empate que redondea para el lado contrario.
function redondear(valor: number, decimales: number): number {
  return Number(valor.toFixed(decimales))
}

/**
 * El margen que corresponde a una confianza. Revienta si no es una de las
 * cuatro del spec: `MARGENES[confianza] ?? MARGENES.estimado` convertiría en
 * silencio cualquier valor no reconocido -"pesados" con esa "s" de más, un
 * valor colado desde arriba- en un margen de ±25 %. El fallo iría hacia el
 * lado prudente (el margen se ensancha, nunca se estrecha), y por eso nunca
 * daría un resultado escandaloso: solo desconfiaría de datos buenos. Mismo
 * criterio que `unidades.opciones()`: revienta donde está el error, no más
 * adelante.
 */
function margenDe(confianza: Confianza): number {
  if (!Object.hasOwn(MARGENES, confianza)) {
    throw new Error(
      `confianza debe ser una de ${JSON.stringify(Object.keys(MARGENES).sort())}, no ${JSON.stringify(confianza)}`,
    )
  }
  return MARGENES[confianza]
}

export interface TotalDia {
  porDia: Record<string, number>
  parciales: Set<string>
  margenPct: number
}

/** Las kcal del día como rango, aplicando el margen. */
export function rangoKcal(total: TotalDia): [number, number] {
  const kcal = total.porDia.kcal ?? 0
  const holgura = (kcal * total.margenPct) / 100
  return [redondear(kcal - holgura, 1), redondear(kcal + holgura, 1)]
}

/** Suma los ítems del día con su margen ponderado y sus parciales. */
export function totalDelDia(items: Item[]): TotalDia {
  if (items.length === 0) {
    return { porDia: {}, parciales: new Set(), margenPct: 0 }
  }

  const sumas: Record<string, number> = {}
  const parciales = new Set<string>()
  let pesoMargen = 0
  let kcalTotal = 0

  for (const item of items) {
    // escalar() valida `gramos` (finito y no negativo) antes de devolver
    // nada: un NaN o un negativo revienta aquí mismo, en la primera línea
    // del cuerpo del bucle. totalDelDia no repite esa guarda a propósito.
    const escalado = escalar(item.por100g, item.gramos)
    for (const clave of nutrientesAusentes(item.por100g)) {
      parciales.add(clave)
    }

    for (const [clave, valor] of Object.entries(escalado)) {
      if (valor !== null) {
        sumas[clave] = (sumas[clave] ?? 0) + valor
      }
    }

    const kcal = escalado.kcal ?? 0
    kcalTotal += kcal
    pesoMargen += kcal * margenDe(item.confianza)
  }

  // Ponderado por kcal. Si el día no tiene kcal (solo agua), se promedia
  // plano para no dividir por cero.
  const margen =
    kcalTotal !== 0
      ? pesoMargen / kcalTotal
      : items.reduce((suma, i) => suma + margenDe(i.confianza), 0) / items.length

  const porDia: Record<string, number> = {}
  for (const [clave, valor] of Object.entries(sumas)) {
    porDia[clave] = redondear(valor, 2)
  }

  return {
    porDia,
    parciales,
    margenPct: redondear(margen * 100, 2),
  }
}
