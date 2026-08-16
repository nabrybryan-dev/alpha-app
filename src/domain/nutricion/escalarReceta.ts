/**
 * De la lista de ingredientes de un reel a la ficha que ve el asesorado.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PARA QUE EL COACH NO TENGA QUE CALCULAR NADA
 * ─────────────────────────────────────────────────────────────────────────────
 * Meter una receta a mano pedía hacer tres veces el mismo trabajo aritmético:
 * dividir cada cantidad entre las porciones, sumar los macros de la porción, y
 * escribirlos en la ficha. Tres oportunidades de equivocarse, y ninguna
 * verificable después.
 *
 * Aquí el coach declara solo lo que sabe de verdad —qué lleva el reel, cuánto
 * de cada cosa y cuántas porciones salen— y el resto sale del catálogo. Las
 * kcal de la ficha DEJAN de ser un número escrito a mano: son las mismas que
 * luego suma el día, calculadas de la misma tabla.
 *
 * Eso cierra un hueco real: si la ficha decía 180 y los ingredientes daban 240,
 * el asesorado veía una cifra al abrir y otra distinta al registrar, sin que
 * nadie pudiera decir cuál era la buena.
 *
 * Lo que este módulo NO hace: escribir las notas del coach. El «dónde encaja»,
 * el canje y el «ojo con» son criterio clínico sobre una persona concreta y no
 * se derivan de una tabla de composición.
 */

import type { RecetaIngrediente } from '../../data/recetas'
import type { AlimentoIndice } from './busqueda'
import { escalar } from './porcion'
import type { EstadoAlimento } from '../types'

/** Lo que el coach copia del reel, sin dividir nada. */
export interface IngredienteDelReel {
  nombre: string
  /** Tal como lo dice el reel: «200 g», «3 huevos», «1 taza». */
  enElReel: string
  alimentoId: string
  /** Gramos de TODA la receta, no de una porción. */
  gramosTotales: number
  estado?: EstadoAlimento
  /** El coach lo sustituyó por otra cosa. */
  cambiado?: boolean
}

export interface RecetaEscalada {
  ingredientes: RecetaIngrediente[]
  kcal: number
  prot: number
  carb: number
  grasa: number
  /** Los que no están en el catálogo: sin ellos la cuenta quedaría corta. */
  sinCatalogo: string[]
}

type BuscarAlimento = (id: string) => AlimentoIndice | undefined

/**
 * @param porciones Cuántas salen con las cantidades del reel. Tiene que ser
 *   mayor que cero: dividir entre cero daría infinitos que se pintarían como
 *   una cantidad cualquiera.
 */
export function escalarReceta(
  delReel: readonly IngredienteDelReel[],
  porciones: number,
  porId: BuscarAlimento,
): RecetaEscalada {
  if (!Number.isFinite(porciones) || porciones <= 0) {
    throw new Error(`porciones debe ser un número mayor que cero: ${porciones}`)
  }

  const ingredientes: RecetaIngrediente[] = []
  const sinCatalogo: string[] = []
  let kcal = 0
  let prot = 0
  let carb = 0
  let grasa = 0

  for (const i of delReel) {
    // Se redondea a gramo entero: nadie pesa 4,7 g de cacao, y una ficha con
    // decimales finge una precisión que la cocina no tiene.
    const gramosParaTi = Math.round(i.gramosTotales / porciones)

    ingredientes.push({
      nombre: i.nombre,
      enElReel: i.enElReel,
      paraTi: `${gramosParaTi} g`,
      alimentoId: i.alimentoId,
      gramosParaTi,
      ...(i.estado ? { estado: i.estado } : {}),
      ...(i.cambiado ? { cambiado: true } : {}),
    })

    const alimento = porId(i.alimentoId)
    if (!alimento) {
      // Se anota y NO se suma. Sumar cero por lo que falta daría una ficha con
      // pinta de completa que se queda corta, que es el peor de los dos males.
      sinCatalogo.push(i.nombre)
      continue
    }

    const c = escalar(alimento.por100g, gramosParaTi)
    kcal += c.kcal ?? 0
    prot += c.proteina_g ?? 0
    carb += c.carbos_g ?? 0
    grasa += c.grasa_g ?? 0
  }

  return {
    ingredientes,
    kcal: Math.round(kcal),
    prot: Math.round(prot),
    carb: Math.round(carb),
    grasa: Math.round(grasa),
    sinCatalogo,
  }
}
