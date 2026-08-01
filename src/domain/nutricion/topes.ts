/**
 * Chequeos de cordura sobre lo que se registra (spec §4).
 *
 * CASI NINGUNO BLOQUEA. Registrar no se impide nunca (R2): si el diario
 * discute con quien lo escribe, deja de llenarse. Se avisa, y el coach
 * decide.
 *
 * La única excepción es la energía físicamente imposible. La grasa pura son
 * 9 kcal por gramo, es decir 900 kcal/100 g es el techo TEÓRICO de cualquier
 * alimento. Lo medido puede pasarlo un poco por método y redondeo: el omega
 * 3 en cápsula (aceite de pescado) del catálogo da 902, y una docena de
 * aceites vegetales puros de la TCAC dan 900,0 exactos -con el techo clavado
 * en 900 y la comparación estricta, esos aceites reales bloqueaban-. El tope
 * se pone en 950: deja margen honesto para esos casos reales y sigue cazando
 * lo que de verdad importa, que son errores de orden de magnitud -un decimal
 * corrido da 1.300 o 9.000 kcal, no 910-.
 *
 * EL TOPE DEL REGISTRO VA EN CALORÍAS, NO EN GRAMOS. Un tope de 1.500 g
 * marcaría 1,5 L de agua (0 kcal) o 1.500 g de sandía (450 kcal), que son
 * consumos normales; a base de alertas falsas se aprende a ignorarlas. En
 * calorías caza el error de verdad -1.500 g de arroz son 1.950 kcal- y deja
 * en paz al agua y a la fruta.
 *
 * ENTRADAS INVÁLIDAS REVIENTAN, NO SE REINTERPRETAN EN SILENCIO -principio
 * DEL MÓDULO: se aplica en `revisarItem` Y en `revisarDia`, a cada número
 * que entra. Mismo criterio que `escalar()` en porcion.ts: sin números
 * utilizables no hay con qué comparar los topes, y seguir en silencio
 * equivaldría a afirmar que el registro está bien -justo lo que este módulo
 * existe para no hacer-.
 *
 * Toda kcal (la del alimento, la de cada comida, la del día) y todo gramos
 * tienen que ser finitos y no negativos, o revienta: un NaN no supera ningún
 * tope (la comparación da `false`), así que sin esta validación el chequeo
 * se apagaría solo frente al dato más corrupto posible, y una falsa
 * tranquilidad es peor que no tener el chequeo. Un alimento `null` o sin
 * "kcal" también revienta -aquí SÍ, a diferencia de porcion.ts: allá `null`
 * revienta solo, por un TypeError natural contra `Object.entries(null)`,
 * porque ese módulo no promete otra cosa; aquí se valida a propósito porque
 * este módulo sí promete reventar de punta a punta.
 */

export const TOPE_KCAL_100G = 950.0 // techo teórico de grasa pura (900) + margen de medición real
export const TOPE_REGISTRO_KCAL = 1500.0 // el cero de más
export const TOPE_COMIDA_KCAL = 2500.0
export const TOPE_DIA_KCAL = 6000.0

export interface Aviso {
  mensaje: string
  bloquea: boolean
}

/**
 * Avisos de un solo alimento registrado.
 *
 * Revienta si el dato no permite juzgar el registro: sin kcal, o con kcal o
 * gramos inválidos, no hay nada que comparar contra los topes.
 */
export function revisarItem(
  por100g: Record<string, number | null> | null,
  gramos: number,
): Aviso[] {
  // Misma validación que gramos en porcion.escalar(), letra por letra -si el
  // criterio cambia allá, cambia aquí también (y en kcal100g más abajo, y en
  // revisarDia).
  if (!Number.isFinite(gramos) || gramos < 0) {
    throw new Error(`gramos debe ser finito y no negativo: ${gramos}`)
  }

  if (por100g === null) {
    throw new Error('no se puede revisar un alimento sin composición: por100g es null')
  }

  const kcal100g = por100g.kcal
  if (kcal100g === undefined || kcal100g === null) {
    throw new Error(`no se puede revisar un alimento sin kcal: ${JSON.stringify(por100g)}`)
  }
  // La otra mitad de "kcal100g > TOPE_KCAL_100G": un kcal100g corrupto apaga
  // ese chequeo tan en silencio como un gramos corrupto apagaba el del
  // registro.
  if (!Number.isFinite(kcal100g) || kcal100g < 0) {
    throw new Error(`kcal_100g debe ser finito y no negativo: ${kcal100g}`)
  }

  const avisos: Aviso[] = []
  if (kcal100g > TOPE_KCAL_100G) {
    avisos.push({
      mensaje: `${kcal100g.toFixed(0)} kcal por 100 g es imposible: revisa el alimento`,
      bloquea: true,
    })
  }

  const kcal = (kcal100g * gramos) / 100
  if (kcal > TOPE_REGISTRO_KCAL) {
    avisos.push({
      mensaje: `${gramos.toFixed(0)} g son ${kcal.toFixed(0)} kcal en un solo registro. ¿Seguro?`,
      bloquea: false,
    })
  }
  return avisos
}

/** Avisos del conjunto del día. Ninguno bloquea. */
export function revisarDia(kcalPorComida: number[], kcalDia: number): Aviso[] {
  // Mismo criterio que gramos y kcal100g en revisarItem: finito y no
  // negativo, o revienta. Sin esto, revisarDia([NaN], NaN) devolvía [] en
  // silencio -el aviso del día se apagaba solo frente al dato más corrupto
  // posible.
  for (const kcal of kcalPorComida) {
    if (!Number.isFinite(kcal) || kcal < 0) {
      throw new Error(`kcal_por_comida debe ser finito y no negativo: ${kcal}`)
    }
  }
  if (!Number.isFinite(kcalDia) || kcalDia < 0) {
    throw new Error(`kcal_dia debe ser finito y no negativo: ${kcalDia}`)
  }

  const avisos: Aviso[] = []
  for (const kcal of kcalPorComida) {
    if (kcal > TOPE_COMIDA_KCAL) {
      avisos.push({ mensaje: `una comida de ${kcal.toFixed(0)} kcal es mucho`, bloquea: false })
    }
  }
  if (kcalDia > TOPE_DIA_KCAL) {
    avisos.push({ mensaje: `el día suma ${kcalDia.toFixed(0)} kcal, es mucho`, bloquea: false })
  }
  return avisos
}
