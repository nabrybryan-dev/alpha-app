/**
 * Mide si el asesorado ya estima bien y decide cuándo soltar la báscula.
 *
 * LO QUE SE MIDE ES EL SESGO, NO EL ACIERTO. Es la parte contraintuitiva. Si
 * alguien se pasa un 20 % un día y se queda corto un 20 % al otro, en la semana
 * eso se cancela y su promedio es bueno. Pero si SIEMPRE se queda corto un 15 %,
 * eso no se cancela nunca: son unas 250 kcal diarias que no existen en el
 * registro, y el motor le recorta el déficit creyendo que come más de lo que
 * come.
 *
 * Por eso el criterio es la MEDIANA del error, no cuántas veces acertó. Y
 * mediana y no media, porque un solo día disparatado no debe decidir por los
 * otros catorce.
 *
 * Espejo de `herramientas/registro-comidas/calibracion.py`.
 */

/** Menos días no dan para ver si hay sesgo. */
export const DIAS_MINIMOS = 10
/** Con menos pruebas, el sesgo no se distingue del azar. */
export const PRUEBAS_MINIMAS = 15
/** ±10 %. Por encima de eso, sigue pesando. */
export const SESGO_MAXIMO = 10
/** Pasadas estas semanas sin calibrar, solo pesa sus peores alimentos. */
export const SEMANAS_TOPE = 4

export interface Prueba {
  alimentoId: string
  gramosEstimados: number
  gramosReales: number
  /** `YYYY-MM-DD`. Obligatoria: sin ella no se sabe cuáles son las últimas. */
  fecha: string
}

/**
 * Cuánto se desvió la estimación, en porcentaje. Positivo = se pasó.
 *
 * Revienta con datos corruptos en vez de dejarlos pasar: un `NaN` se cuela sin
 * ruido —`NaN <= 10` da `false` igual que `NaN > 10`—, contamina la mediana y
 * deja a la persona pesando para siempre sin que nadie sepa por qué.
 */
export function errorPct(estimados: number, reales: number): number | null {
  if (!Number.isFinite(estimados) || estimados < 0) {
    throw new Error(`gramos estimados debe ser finito y no negativo: ${estimados}`)
  }
  if (!Number.isFinite(reales) || reales < 0) {
    throw new Error(`gramos reales debe ser finito y no negativo: ${reales}`)
  }
  // Dividir por cero no da infinito: da que la pregunta no aplica.
  if (reales === 0) return null
  return ((estimados - reales) / reales) * 100
}

function mediana(valores: number[]): number {
  const orden = [...valores].sort((a, b) => a - b)
  const medio = Math.floor(orden.length / 2)
  return orden.length % 2 === 0 ? (orden[medio - 1] + orden[medio]) / 2 : orden[medio]
}

/**
 * Las N pruebas más recientes.
 *
 * El orden entre pruebas del mismo día se conserva tal como llegaron: quien
 * llama trae la lista en orden de registro, así que no hace falta inventar un
 * desempate artificial aquí.
 */
function ultimas(pruebas: readonly Prueba[], cuantas: number): Prueba[] {
  return [...pruebas]
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.fecha.localeCompare(a.p.fecha) || a.i - b.i)
    .slice(0, cuantas)
    .map(({ p }) => p)
}

const erroresDe = (pruebas: readonly Prueba[]): number[] =>
  pruebas
    .map((p) => errorPct(p.gramosEstimados, p.gramosReales))
    .filter((e): e is number => e !== null)

/**
 * La mediana del error de las últimas 15 pruebas. VENTANA, no histórico.
 *
 * Mide cómo estima AHORA. Sin la ventana, las primeras semanas malas de alguien
 * que ya aprendió a estimar bien nunca salen del cálculo, y esa persona no
 * calibra jamás — exactamente lo contrario de lo que se busca.
 */
export function sesgo(pruebas: readonly Prueba[]): number | null {
  const errores = erroresDe(ultimas(pruebas, PRUEBAS_MINIMAS))
  return errores.length > 0 ? mediana(errores) : null
}

/** Si ya puede dejar la báscula. */
export function estaCalibrado(pruebas: readonly Prueba[], diasPesando: number): boolean {
  if (diasPesando < DIAS_MINIMOS || pruebas.length < PRUEBAS_MINIMAS) return false
  const actual = sesgo(pruebas)
  return actual !== null && Math.abs(actual) <= SESGO_MAXIMO
}

/**
 * Los alimentos que peor estima, por error absoluto mediano.
 *
 * A quien no calibra en cuatro semanas no se le deja pesando todo: se le acota a
 * estos. Castigarle con la báscula entera es como se pierde la adherencia.
 *
 * Usa el HISTÓRICO completo, no la ventana de `sesgo`, a propósito. Son dos
 * preguntas distintas: el sesgo pregunta «cuánto se desvía AHORA» y su respuesta
 * caduca; esto pregunta «qué alimento estima peor», y esa no caduca igual —la
 * dificultad de un alimento es del alimento, no de cuánto haya mejorado la
 * persona—. Además, con solo quince pruebas repartidas entre varios alimentos,
 * la mayoría quedaría con una o dos muestras, y ahí la mediana deja de proteger
 * justo donde más hace falta.
 */
export function peoresAlimentos(pruebas: readonly Prueba[], cuantos = 5): string[] {
  const porAlimento = new Map<string, number[]>()
  for (const prueba of pruebas) {
    const valor = errorPct(prueba.gramosEstimados, prueba.gramosReales)
    if (valor === null) continue
    const lista = porAlimento.get(prueba.alimentoId) ?? []
    lista.push(Math.abs(valor))
    porAlimento.set(prueba.alimentoId, lista)
  }

  return [...porAlimento.entries()]
    .sort((a, b) => mediana(b[1]) - mediana(a[1]))
    .slice(0, cuantos)
    .map(([alimento]) => alimento)
}

export type QueDebePesar = 'nada' | 'todo' | { peores: string[] }

/**
 * Qué tiene que pesar hoy esta persona.
 *
 * Existe porque sin ella `SEMANAS_TOPE` era un número declarado que ninguna
 * función miraba: la regla estaba escrita y no la aplicaba nadie. Un límite que
 * no se comprueba no es un límite.
 */
export function queDebePesar(
  pruebas: readonly Prueba[],
  diasPesando: number,
): QueDebePesar {
  if (estaCalibrado(pruebas, diasPesando)) return 'nada'
  if (diasPesando > SEMANAS_TOPE * 7) return { peores: peoresAlimentos(pruebas) }
  return 'todo'
}

/** Cuántas pruebas y días le faltan. Para poder decírselo en pantalla. */
export interface Avance {
  pruebas: number
  pruebasQueFaltan: number
  diasPesando: number
  diasQueFaltan: number
  sesgoPct: number | null
  calibrado: boolean
}

export function avanceDeCalibracion(
  pruebas: readonly Prueba[],
  diasPesando: number,
): Avance {
  return {
    pruebas: pruebas.length,
    pruebasQueFaltan: Math.max(0, PRUEBAS_MINIMAS - pruebas.length),
    diasPesando,
    diasQueFaltan: Math.max(0, DIAS_MINIMOS - diasPesando),
    sesgoPct: sesgo(pruebas),
    calibrado: estaCalibrado(pruebas, diasPesando),
  }
}

/**
 * Si el peso no se movió ni la mitad de lo previsto en tres semanas.
 *
 * Dice que HAY un error, no cuál: puede estar mal el registro o puede estar mal
 * el gasto estimado.
 *
 * Bajar MÁS de lo previsto no dispara esta señal: eso es un déficit excesivo, y
 * lo vigila la disponibilidad energética, no el registro.
 */
export function debeVolverAPesar(previstoKg: number, realKg: number): boolean {
  // Aquí un negativo es normal —perder peso es un cambio negativo—, a
  // diferencia de los gramos, que nunca pueden serlo.
  if (!Number.isFinite(previstoKg) || !Number.isFinite(realKg)) {
    throw new Error(`previsto y real deben ser finitos: ${previstoKg}, ${realKg}`)
  }
  if (!previstoKg) return false
  return Math.abs(realKg) < Math.abs(previstoKg) / 2 || realKg * previstoKg < 0
}
