/**
 * De una receta viral a una comida del registro.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SE REGISTRAN LOS INGREDIENTES, NO LA FICHA
 * ─────────────────────────────────────────────────────────────────────────────
 * Lo cómodo sería guardar un solo ítem con las kcal que trae la receta —180,
 * ya calculadas por el coach— y acabar antes. No sirve.
 *
 * El total del día lo deriva `resumenDelDia` desde el catálogo: recorre los
 * ítems, busca cada `alimentoId` y escala su `por100g` por los gramos. Un ítem
 * cuyo id no está en el catálogo **se salta** (`resumen.ts`), así que una
 * receta guardada como bloque sumaría exactamente cero. El asesorado tocaría
 * «Agregar», vería el aviso de que quedó registrada y sus kcal restantes no se
 * moverían. Es el peor fallo posible aquí: silencioso y creíble.
 *
 * Guardándola por ingredientes, la comida entra por la misma puerta que
 * cualquier otra: cuadra el día, cuadra la semana, aparece en «Recientes» y el
 * día que se corrija un valor del catálogo esta comida se corrige sola.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O ENTERA O NADA
 * ─────────────────────────────────────────────────────────────────────────────
 * Si algún ingrediente no tiene alimento y gramos, la receta NO se registra a
 * medias. Un brownie que suma la avena pero no la mantequilla de maní deja el
 * día corto sin que nadie lo note, y a partir de ahí la persona come de menos
 * creyendo que va bien. Preferimos un botón que explique por qué no puede.
 */

import type { Receta } from '../../data/recetas'
import type { EstadoAlimento, RegistroComida, RegistroItem, TipoComida } from '../types'

/** Dónde cae cada categoría dentro de las cuatro comidas del día. */
const COMIDA_DE_CATEGORIA: Record<Receta['categoria'], TipoComida> = {
  Desayuno: 'desayuno',
  Almuerzo: 'almuerzo',
  Cena: 'cena',
  Snack: 'snack',
  // Un postre no es una quinta comida: se cuenta como snack, que es la ranura
  // que el registro ya tiene para lo que entra fuera de las tres principales.
  Postre: 'snack',
}

export type RecetaAlRegistro =
  | {
      puede: true
      comida: Omit<RegistroComida, 'id' | 'items' | 'usuarioId'>
      items: Omit<RegistroItem, 'id'>[]
    }
  | { puede: false; motivo: string }

/**
 * @param momentoIso Cuándo se agrega. La hora ordena el día, así que la pone
 *   quien llama —no este módulo—: la lógica pura no lee el reloj.
 */
/**
 * Por qué esta receta no se puede registrar, o `null` si sí se puede.
 *
 * Existe aparte para que la hoja pueda decirlo ANTES de que nadie toque el
 * botón. Un botón que se pulsa y no hace nada se lee como una app rota.
 */
export function motivoParaNoRegistrar(receta: Receta): string | null {
  const lista = receta.ingredientes ?? []
  if (lista.length === 0) return 'Esta receta todavía no trae sus ingredientes medidos.'

  const sinMedir = lista.filter((i) => !i.alimentoId || i.gramosParaTi === undefined)
  if (sinMedir.length > 0) return `Falta medir ${sinMedir.map((i) => i.nombre).join(', ')}.`

  return null
}

export function recetaAlRegistro(receta: Receta, momentoIso: string): RecetaAlRegistro {
  const motivo = motivoParaNoRegistrar(receta)
  if (motivo) return { puede: false, motivo }

  const lista = receta.ingredientes ?? []
  const items = lista.map((i) => ({
    alimentoId: i.alimentoId as string,
    gramos: i.gramosParaTi as number,
    // Una receta se sirve, no se pesa. Marcarlo como pesado le daría el margen
    // de la báscula (±5 %) a una cantidad que nadie puso en una báscula.
    fuePesado: false,
    estadoAsumido: (i.estado ?? 'crudo') as EstadoAlimento,
  }))

  return {
    puede: true,
    comida: {
      momentoIso,
      comida: COMIDA_DE_CATEGORIA[receta.categoria],
      // Cocinó él: la receta la hace en su cocina, con sus cantidades.
      cocinadoPorEl: true,
      // `null` = no se preguntó, distinto de cero. Quien sigue una receta ajena
      // no sabe cuánto aceite llevaba.
      aceiteG: null,
      salG: null,
      confianza: 'estimado',
    },
    items,
  }
}
