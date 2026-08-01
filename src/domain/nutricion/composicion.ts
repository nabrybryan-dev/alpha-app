/**
 * Composición corporal a partir de perímetros: grasa, masa magra y energía.
 *
 * POR QUÉ US NAVY Y NO DEURENBERG. Deurenberg solo mira peso, altura y edad: no
 * mide el cuerpo, así que a dos personas del mismo peso y altura les da el mismo
 * porcentaje aunque una sea musculada y la otra no. La US Navy (Hodgdon &
 * Beckett, 1984) usa cuello, cintura y cadera, que es justo lo que la encuesta
 * ya pregunta.
 *
 * LO QUE ESTA FÓRMULA NO ES. Es una estimación, no una medición. Frente a DEXA
 * tiene un error típico de 3-4 puntos porcentuales, y en personas muy musculadas
 * o muy delgadas se desvía más. Sirve para dar un punto de partida y —sobre
 * todo— para seguir la TENDENCIA de una misma persona, que es lo que importa.
 *
 * Espejo de `herramientas/composicion/composicion.py`. Si una regla cambia
 * allá, cambia aquí, y al revés.
 */

export const MUJER = 'M'
export const HOMBRE = 'H'
export type Genero = typeof MUJER | typeof HOMBRE

export interface Medidas {
  pesoKg: number
  alturaCm: number
  cuelloCm: number
  cinturaCm: number
  genero: Genero
  /** Solo entra en la fórmula femenina. A un hombre sin este dato no le falta nada. */
  caderaCm?: number
}

const log10 = (valor: number) => Math.log10(valor)

/** Qué medidas faltan para poder calcular. Lista vacía si no falta ninguna. */
export function faltantes(medidas: Partial<Medidas>): string[] {
  const falta: string[] = []
  for (const campo of ['pesoKg', 'alturaCm', 'cuelloCm', 'cinturaCm'] as const) {
    if (!medidas[campo]) falta.push(campo)
  }
  // Sin género no hay fórmula: la masculina y la femenina no son intercambiables.
  if (medidas.genero !== MUJER && medidas.genero !== HOMBRE) falta.push('genero')
  else if (medidas.genero === MUJER && !medidas.caderaCm) falta.push('caderaCm')
  return falta
}

/**
 * Porcentaje de grasa por la fórmula US Navy. `null` si faltan medidas.
 *
 * Devuelve `null` —y no un número— cuando falta un dato, por la misma razón por
 * la que el catálogo guarda nulos en vez de ceros: un porcentaje inventado se
 * parece demasiado a uno medido.
 */
export function grasaPct(medidas: Partial<Medidas>): number | null {
  if (faltantes(medidas).length > 0) return null
  const m = medidas as Medidas

  let divisor: number
  if (m.genero === MUJER) {
    const interno = m.cinturaCm + (m.caderaCm ?? 0) - m.cuelloCm
    if (interno <= 0) return null
    divisor = 1.29579 - 0.35004 * log10(interno) + 0.221 * log10(m.alturaCm)
  } else {
    const interno = m.cinturaCm - m.cuelloCm
    // Cintura menor que el cuello: o es un error de medida o de columna. El
    // logaritmo de un negativo no existe, y devolver un número aquí sería
    // inventárselo.
    if (interno <= 0) return null
    divisor = 1.0324 - 0.19077 * log10(interno) + 0.15456 * log10(m.alturaCm)
  }

  if (divisor <= 0) return null
  const resultado = 495 / divisor - 450
  // Un porcentaje fuera de este rango no es una persona, es un error de entrada.
  // Es exactamente el fallo que tenía la plantilla vieja y que nadie vio en meses.
  return resultado >= 2 && resultado <= 70 ? Number(resultado.toFixed(1)) : null
}

/** Kilos de masa libre de grasa. Se calcula del PESO, no de un perímetro. */
export function masaMagraKg(medidas: Partial<Medidas>): number | null {
  const pct = grasaPct(medidas)
  if (pct === null) return null
  return Number(((medidas.pesoKg ?? 0) * (1 - pct / 100)).toFixed(2))
}

/** Índice de masa corporal. Se enseña con matices: ver `lecturaImc`. */
export function imc(pesoKg: number, alturaCm: number): number | null {
  if (!pesoKg || !alturaCm) return null
  return Number((pesoKg / (alturaCm / 100) ** 2).toFixed(1))
}

/**
 * kcal por kg de masa libre de grasa al día.
 *
 * Es la variable que de verdad importa y la que no se podía calcular sin el % de
 * grasa. Contra qué umbral se juzga cada género vive aparte, en
 * `evaluarDisponibilidad`, para no mezclar el cálculo con el criterio clínico.
 */
export function disponibilidadEnergetica(
  ingestaKcal: number,
  gastoEjercicioKcal: number,
  masaMagra: number | null,
): number | null {
  if (!masaMagra) return null
  return Number(((ingestaKcal - gastoEjercicioKcal) / masaMagra).toFixed(1))
}

// LA ASIMETRÍA ES A PROPÓSITO, NO UN DESCUIDO. En mujeres el umbral es un CORTE:
// la ACSM (Loucks) documenta disfunción menstrual y pérdida de densidad ósea por
// debajo de 30 kcal/kg MLG/día, y es un eje hormonal con una línea razonablemente
// clara. En hombres no hay un eje equivalente ni la misma evidencia, así que el
// umbral no es un número: es una BANDA. Reducirla a un solo corte inventaría una
// precisión que la evidencia en hombres no tiene.
export const UMBRAL_EA_MUJER = 30
export const UMBRAL_EA_HOMBRE_BAJO = 20
export const UMBRAL_EA_HOMBRE_ALTO = 25

export type EstadoEnergetico = 'problema' | 'vigilancia' | 'bien'

export interface VeredictoEnergetico {
  estado: EstadoEnergetico
  disponibilidad: number
  /** Contra qué se juzgó. Viaja con el veredicto porque el umbral no es el
   *  mismo para los dos géneros y la app tiene que poder decirlo. */
  criterio: string
}

/**
 * Compara una disponibilidad ya calculada contra su umbral.
 *
 * `null` entra, `null` sale: significa "no se pudo calcular" (faltó masa magra
 * río arriba), no "inválido". Un valor NEGATIVO sí se juzga —gastar más de lo
 * que se come es real, y es el caso más grave que esto tiene que poder marcar.
 */
export function evaluarDisponibilidad(
  disponibilidad: number | null,
  genero: Genero,
): VeredictoEnergetico | null {
  if (disponibilidad === null) return null
  if (!Number.isFinite(disponibilidad)) {
    throw new Error(`la disponibilidad debe ser finita: ${disponibilidad}`)
  }
  const valor = Number(disponibilidad.toFixed(1))

  if (genero === MUJER) {
    return {
      estado: valor < UMBRAL_EA_MUJER ? 'problema' : 'bien',
      disponibilidad: valor,
      criterio: `mujeres: corte en ${UMBRAL_EA_MUJER} kcal/kg MLG/día (ACSM/Loucks)`,
    }
  }

  const criterio = `hombres: banda ${UMBRAL_EA_HOMBRE_BAJO}-${UMBRAL_EA_HOMBRE_ALTO} kcal/kg MLG/día`
  if (valor < UMBRAL_EA_HOMBRE_BAJO) return { estado: 'problema', disponibilidad: valor, criterio }
  if (valor <= UMBRAL_EA_HOMBRE_ALTO)
    return { estado: 'vigilancia', disponibilidad: valor, criterio }
  return { estado: 'bien', disponibilidad: valor, criterio }
}
