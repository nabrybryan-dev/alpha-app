/**
 * De las medidas de una persona a sus calorías y sus macros.
 *
 * Las fórmulas NO son genéricas de internet: son las que ya usa Alpha en sus
 * libros de Excel, para que lo que calcule la app y lo que calcule el coach den
 * lo mismo. Si dieran distinto, cada uno defendería su número y el asesorado
 * estaría en medio.
 *
 * Espejo de `herramientas/inventario-nutricion/parametros.py` (TMB, factor de
 * actividad, TDEE) y de `wiki/motor-decision/09` (el reparto de macros).
 */

import type { Genero } from './composicion'
import { HOMBRE, MUJER } from './composicion'

/**
 * Redondeo estilo Excel: la mitad SIEMPRE hacia arriba.
 *
 * `Math.round` de JavaScript hace lo mismo con positivos pero no con negativos,
 * y Python redondea al par. Los tres darían números distintos en los empates, y
 * aquí el empate no es teórico: una TMB de 1.352,5 se ve en el Excel del coach.
 */
export function redondearExcel(valor: number): number {
  return valor >= 0 ? Math.floor(valor + 0.5) : Math.ceil(valor - 0.5)
}

const AJUSTE_GENERO: Record<Genero, number> = { [HOMBRE]: 5, [MUJER]: -161 }

/**
 * Tasa metabólica basal por Mifflin-St Jeor, tal como está en el libro real.
 *
 * `null` si falta cualquier dato: una TMB a medias no es una TMB, y de ella
 * cuelga todo lo demás.
 */
export function tmb(
  pesoKg: number | null,
  alturaCm: number | null,
  edad: number | null,
  genero: Genero | null,
): number | null {
  if (!pesoKg || !alturaCm || !edad || !genero) return null
  const ajuste = AJUSTE_GENERO[genero]
  if (ajuste === undefined) return null
  return redondearExcel(10 * pesoKg + 6.25 * alturaCm - 5 * edad + ajuste)
}

/**
 * Factor de actividad. Tabla real de Alpha: pasos diarios × días de entreno.
 *
 * Los DOS criterios tienen que cumplirse para subir de escalón. Alguien que
 * entrena seis días pero camina 3.000 pasos no gasta como quien entrena seis y
 * camina 15.000: el NEAT es la mayor parte de la diferencia entre dos personas
 * con el mismo entrenamiento, y por eso los pasos entran en la tabla.
 */
export function factorActividad(pasos: number | null, diasEntreno: number | null): number | null {
  if (pasos === null || diasEntreno === null) return null
  if (pasos > 20000 && diasEntreno >= 10) return 1.9
  if (pasos >= 15000 && diasEntreno >= 6) return 1.73
  if (pasos >= 11000 && diasEntreno >= 3) return 1.55
  if (pasos >= 8000 && diasEntreno >= 1) return 1.38
  return 1.2
}

/** Gasto total diario. */
export function tdee(tasaBasal: number | null, fa: number | null): number | null {
  if (tasaBasal === null || fa === null) return null
  return redondearExcel(tasaBasal * fa)
}

// ── Reparto de macros ────────────────────────────────────────────────────────

/**
 * Proteína y grasa se FIJAN; el carbohidrato es el resto.
 *
 * Es la conclusión donde convergen las fuentes del Cerebro: blindar los mínimos
 * de proteína y grasa —que son los que protegen la masa magra y el eje
 * hormonal— y dejar el carbohidrato como la palanca que se mueve entre el día
 * que se entrena fuerte y el que se descansa.
 */
export const PROTEINA_G_KG = 1.6
/** En definición y en mujeres se sube: es donde más masa magra hay que proteger. */
export const PROTEINA_G_KG_ALTA = 1.9
/** Piso hormonal. Por debajo de aquí no se baja aunque el déficit lo pida. */
export const GRASA_G_KG_MINIMA = 0.8

export const KCAL_POR_G = { proteina: 4, carbos: 4, grasa: 9 } as const

export interface Macros {
  kcal: number
  proteinaG: number
  carbosG: number
  grasaG: number
}

export interface OpcionesReparto {
  /** Sube la proteína a 1,9 g/kg. Para definición y para mujeres. */
  proteinaAlta?: boolean
  /** Gramos de grasa por kilo. Nunca por debajo del piso. */
  grasaGKg?: number
}

/**
 * Reparte unas calorías objetivo en proteína, grasa y carbohidrato.
 *
 * Los carbohidratos pueden salir a CERO si las calorías no dan para más después
 * de blindar proteína y grasa. No se recorta ninguno de los dos para dejarle
 * sitio: si el objetivo calórico no alcanza, el que sobra es el objetivo, y eso
 * lo tiene que ver el coach en vez de que la app lo disimule bajando la
 * proteína por su cuenta.
 */
export function repartirMacros(
  kcalObjetivo: number,
  pesoKg: number,
  opciones: OpcionesReparto = {},
): Macros | null {
  if (!Number.isFinite(kcalObjetivo) || kcalObjetivo <= 0) return null
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null

  const proteinaG = Math.round(
    pesoKg * (opciones.proteinaAlta ? PROTEINA_G_KG_ALTA : PROTEINA_G_KG),
  )
  const grasaG = Math.round(pesoKg * Math.max(GRASA_G_KG_MINIMA, opciones.grasaGKg ?? 1))

  const kcalFijas = proteinaG * KCAL_POR_G.proteina + grasaG * KCAL_POR_G.grasa
  const carbosG = Math.max(0, Math.round((kcalObjetivo - kcalFijas) / KCAL_POR_G.carbos))

  return {
    kcal: Math.round(kcalObjetivo),
    proteinaG,
    carbosG,
    grasaG,
  }
}

/**
 * Si el objetivo calórico no da ni para la proteína y la grasa mínimas.
 *
 * Mira SOLO proteína y grasa a propósito. Sumar también el carbohidrato daría
 * falsos positivos: los gramos se redondean al entero, así que un reparto normal
 * se pasa un par de kcal del objetivo y eso no es un plan imposible, es
 * aritmética. Lo que de verdad importa es si los dos macros blindados ya se
 * comen el objetivo entero -ahí el carbo cae a cero y el plan no se sostiene-.
 */
export function objetivoInsuficiente(macros: Macros): boolean {
  const blindadas = macros.proteinaG * KCAL_POR_G.proteina + macros.grasaG * KCAL_POR_G.grasa
  return blindadas > macros.kcal
}

/** Los años cumplidos a una fecha. La edad entra en la TMB. */
export function edadA(nacimientoIso: string, hoyIso: string): number | null {
  const [an, mn, dn] = nacimientoIso.split('-').map(Number)
  const [ah, mh, dh] = hoyIso.split('-').map(Number)
  if (!an || !ah) return null
  let edad = ah - an
  if (mh < mn || (mh === mn && dh < dn)) edad -= 1
  return edad >= 0 && edad < 130 ? edad : null
}
