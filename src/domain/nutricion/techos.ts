import type { AlimentoIndice } from './busqueda'
import type { TotalDia } from './dia'
import tabla from './techos.json'

/**
 * Cuándo el día ya pasó el límite superior tolerable de un nutriente.
 *
 * NO ES UNA META MÁS. `PanelMicros` dibuja tres barras hacia un objetivo:
 * llegar a los 18 mg de hierro es bueno. Esto es lo contrario —un máximo— y
 * mezclarlos haría que una barra al 120 % pareciera un logro. Por eso va aparte
 * y solo aparece cuando hay algo que decir.
 *
 * UN LÍMITE ES DE INGESTA DIARIA TOTAL, no de un alimento. Por eso se compara
 * contra el total del día y no contra lo que acaba de registrarse: comerse un
 * hígado un martes no es comérselo a diario.
 *
 * EL CASO QUE LO MOTIVA. Una porción de hígado de res asado aporta 11.389 ER de
 * vitamina A contra un límite de 3.000: casi cuatro veces, en un plato. En
 * embarazo además es contraindicación —el retinol preformado es teratógeno— y
 * eso lo resuelve el perfil, no esta tabla.
 *
 * NO ESTÁ TECLEADA AQUÍ. `techos.json` lo exporta
 * `herramientas/base-alimentos/topes_nutrientes.py` (`py topes_nutrientes.py`) y
 * un test de allá compara el archivo con el módulo. No editar este JSON a mano.
 */

interface Limite {
  limite: number
  fuente: string
  /** Se calcula y se puede mirar, pero nunca produce un aviso. */
  informativo: boolean
  /** Solo cuenta lo que venga de alimento animal. Ver `esDeOrigenAnimal`. */
  solo_origen_animal: boolean
}

interface TablaTechos {
  limites: Record<string, Limite>
  origen_animal: { grupos: string[]; ids: string[] }
}

const TABLA = tabla as TablaTechos

const GRUPOS_ANIMALES = new Set(TABLA.origen_animal.grupos)
const IDS_ANIMALES = new Set(TABLA.origen_animal.ids)

/**
 * La clave derivada donde vive la vitamina A que SÍ cuenta para el techo.
 *
 * POR QUÉ HACE FALTA. La TCAC publica ER, que suma en una sola cifra el retinol
 * de la carne y los carotenoides de la planta, y el límite es de retinol: el
 * β-caroteno de la zanahoria no causa hipervitaminosis. Un día de 3.500 ER puede
 * ser todo ahuyama y no tener nada de malo.
 *
 * Sumar `vitamina_a_er` del día y compararlo con 3.000 daría una alarma falsa a
 * quien come verdura, que es exactamente a quien no hay que asustar. Se separa
 * en el mismo sitio donde un id se convierte en composición —`catalogoRepo`— y
 * el día la suma como una clave más.
 */
export const VITAMINA_A_ANIMAL = 'vitamina_a_animal_er'

export function esDeOrigenAnimal(alimento: Pick<AlimentoIndice, 'id' | 'grupo'>): boolean {
  return GRUPOS_ANIMALES.has(alimento.grupo) || IDS_ANIMALES.has(alimento.id)
}

/**
 * Añade la vitamina A de origen animal como clave propia. No toca el resto.
 *
 * Se llama al ENTRAR el alimento al repositorio, no en cada pantalla: es la
 * misma costura por la que ya pasan los datos apartados, y filtrar más adelante
 * dejaría fuera a quien no se acuerde de llamarla.
 */
export function conVitaminaAAnimal<T extends AlimentoIndice>(alimento: T): T {
  if (!esDeOrigenAnimal(alimento)) return alimento
  const er = alimento.por100g?.vitamina_a_er
  // `null` NO se descarta: viaja como null. Un alimento animal al que nadie le
  // midió la vitamina A es un HUECO, y `nutrientesAusentes` solo marca el día
  // como parcial cuando ve un null explícito. Saltárselo dejaría el total corto
  // y sin el "≥" que avisa de que falta medición. En una planta ni siquiera se
  // crea la clave: ahí no falta nada, es que no aplica.
  return { ...alimento, por100g: { ...alimento.por100g, vitamina_a_animal_er: er ?? null } }
}

/**
 * Qué clave del día mirar para el techo de un nutriente.
 *
 * Solo la vitamina A tiene clave derivada, y por eso el mapa es explícito: si
 * mañana otro nutriente se marcara `solo_origen_animal` sin darle su clave, caer
 * al nombre original compararía el total mezclado contra el límite y volvería el
 * fallo de la ahuyama. Sin clave, no se compara.
 */
const CLAVE_ANIMAL: Record<string, string> = { vitamina_a_er: VITAMINA_A_ANIMAL }

const claveDelDia = (nutriente: string, limite: Limite): string | null =>
  limite.solo_origen_animal ? (CLAVE_ANIMAL[nutriente] ?? null) : nutriente

export interface TechoPasado {
  nutriente: string
  valor: number
  limite: number
  veces: number
  /** El total del día es un suelo: a algún alimento le falta ese dato. */
  parcial: boolean
}

/**
 * Los techos que el día ya pasó, del más excedido al que menos.
 *
 * Vacío es lo normal y es lo que se espera casi siempre: solo el hígado, la
 * ostra y poco más llegan a pasar uno con comida corriente.
 */
export function techosPasados(total: TotalDia): TechoPasado[] {
  const pasados: TechoPasado[] = []
  for (const [nutriente, limite] of Object.entries(TABLA.limites)) {
    if (limite.informativo) continue
    const clave = claveDelDia(nutriente, limite)
    if (clave === null) continue
    const valor = total.porDia[clave]
    if (valor == null || valor <= limite.limite) continue
    pasados.push({
      nutriente,
      valor,
      limite: limite.limite,
      veces: valor / limite.limite,
      parcial: total.parciales.has(clave),
    })
  }
  return pasados.sort((a, b) => b.veces - a.veces)
}

/** Por qué existe ese límite, para poder explicarlo sin inventarlo. */
export const fuenteDelLimite = (nutriente: string): string =>
  TABLA.limites[nutriente]?.fuente ?? ''
