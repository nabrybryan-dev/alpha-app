import { sinTildes } from './busqueda'
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
  /** El límite baja cuando la persona declara embarazo o lactancia. */
  limites_por_condicion: Record<string, Record<string, number>>
  /** Alimentos que se manejan por cada cuánto, no por cuánto en un día. */
  frecuencia: {
    dias: number
    por_nutriente: Record<string, string[]>
    motivo: Record<string, string>
  }
  origen_animal: { grupos: string[]; ids: string[] }
}

const TABLA = tabla as TablaTechos

const GRUPOS_ANIMALES = new Set(TABLA.origen_animal.grupos)
const IDS_ANIMALES = new Set(TABLA.origen_animal.ids)

/**
 * Las condiciones declaradas que bajan un límite. Hoy: embarazo y lactancia.
 *
 * Es un tipo suelto y no un enum porque la lista vive en el Cerebro: si mañana
 * Manuela añade una, llega por `techos.json` y aquí no hay nada que tocar.
 */
export type Condicion = string

/**
 * El límite que le toca a esta persona, no el del adulto genérico.
 *
 * EL MÁS BAJO CUANDO DECLARA VARIAS, y nunca «la última que se leyó»: el orden
 * de un `Set` es el de inserción y eso convertiría el resultado en algo que
 * depende de cómo se armó la lista.
 *
 * Manuela, 2026-08-09: en embarazo y en lactancia se maneja el umbral mínimo
 * mientras no haya una indicación médica propia. Son 2.800 µg contra los 3.000
 * generales — el límite del IOM para embarazadas y lactantes de hasta 18 años,
 * el más bajo de la tabla.
 */
export function limiteDe(nutriente: string, condiciones: Iterable<Condicion> = []): number | null {
  const candidatos: number[] = []
  const general = TABLA.limites[nutriente]?.limite
  if (general != null) candidatos.push(general)
  for (const condicion of condiciones) {
    const propio = TABLA.limites_por_condicion[condicion]?.[nutriente]
    if (propio != null) candidatos.push(propio)
  }
  return candidatos.length > 0 ? Math.min(...candidatos) : null
}

/**
 * Si este alimento se maneja por frecuencia en vez de por techo diario.
 *
 * EL AVISO DIARIO NO SERVÍA PARA EL HÍGADO, Y ESE ES TODO EL MOTIVO. Una sola
 * ración lo pasa siempre —de 1,3× el de pollo a 3,8× el de res asado—, así que
 * el aviso salía cada vez que alguien registraba hígado y a la tercera nadie lo
 * lee. Manuela lo cambió por una frecuencia el 2026-08-09: cada dos semanas.
 *
 * SE COMPARA POR PALABRA ENTERA, como todo lo que aquí mira un nombre. Es la
 * cicatriz de este repo: «lengua» dentro del nombre casaba con «Lenguado».
 */
export function seManejaPorFrecuencia(nombre: string, nutriente: string): boolean {
  const marcadas = TABLA.frecuencia.por_nutriente[nutriente]
  if (!marcadas) return false
  // Las dos listas se normalizan igual. El Cerebro exporta «higado» y «hígado»
  // porque allá compara contra el nombre crudo; aquí las dos llegan a lo mismo.
  const marcadasSinTildes = marcadas.map((palabra) => sinTildes(palabra))
  const palabras = sinTildes(nombre).split(/[^a-z0-9]+/)
  return palabras.some((palabra) => marcadasSinTildes.includes(palabra))
}

/**
 * Qué nutrientes del día vienen de un alimento que va por frecuencia.
 *
 * Su aviso diario NO se pinta: es exactamente el ruido que Manuela vino a
 * quitar. Que hoy se comió hígado no es noticia; la noticia sería que se
 * repitiera antes de dos semanas, y eso necesita el historial.
 */
export function nutrientesPorFrecuencia(nombres: readonly string[]): Set<string> {
  const salida = new Set<string>()
  for (const nutriente of Object.keys(TABLA.frecuencia.por_nutriente)) {
    if (nombres.some((nombre) => seManejaPorFrecuencia(nombre, nutriente))) {
      salida.add(nutriente)
    }
  }
  return salida
}

/** Cada cuántos días puede repetirse un alimento de los de frecuencia. */
export const DIAS_ENTRE_RACIONES = TABLA.frecuencia.dias

/** Por qué ese alimento va por frecuencia, para poder explicarlo sin inventarlo. */
export const motivoDeLaFrecuencia = (nutriente: string): string =>
  TABLA.frecuencia.motivo[nutriente] ?? ''

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

export interface OpcionesDeTecho {
  /** Lo que la asesorada declaró: baja el límite. Ver `limiteDe`. */
  condiciones?: Iterable<Condicion>
  /** Nombres de lo que registró hoy, para callar el aviso de los de frecuencia. */
  nombresDelDia?: readonly string[]
}

/**
 * Los techos que el día ya pasó, del más excedido al que menos.
 *
 * Vacío es lo normal y es lo que se espera casi siempre: solo el hígado, la
 * ostra y poco más llegan a pasar uno con comida corriente.
 *
 * DOS COSAS CAMBIARON EL 2026-08-09, LAS DOS POR RESPUESTA DE MANUELA:
 *
 *   - El límite es el de ELLA. Quien declaró embarazo o lactancia tiene 2.800
 *     de vitamina A, no 3.000. Compararla contra el general le callaría un
 *     aviso que le toca.
 *   - El hígado ya no sale por aquí. Su ración pasa el techo siempre, así que
 *     el aviso salía cada vez y dejó de leerse. Va por frecuencia.
 */
export function techosPasados(total: TotalDia, opciones: OpcionesDeTecho = {}): TechoPasado[] {
  const porFrecuencia = nutrientesPorFrecuencia(opciones.nombresDelDia ?? [])
  const pasados: TechoPasado[] = []
  for (const [nutriente, limite] of Object.entries(TABLA.limites)) {
    if (limite.informativo) continue
    if (porFrecuencia.has(nutriente)) continue
    const clave = claveDelDia(nutriente, limite)
    if (clave === null) continue
    // `limiteDe` nunca da null aquí —el nutriente viene de la propia tabla—,
    // pero se resuelve sin `!` para que un día que la tabla cambie de forma
    // esto no compare contra `undefined` en silencio.
    const suyo = limiteDe(nutriente, opciones.condiciones ?? []) ?? limite.limite
    const valor = total.porDia[clave]
    if (valor == null || valor <= suyo) continue
    pasados.push({
      nutriente,
      valor,
      limite: suyo,
      veces: valor / suyo,
      parcial: total.parciales.has(clave),
    })
  }
  return pasados.sort((a, b) => b.veces - a.veces)
}

/** Por qué existe ese límite, para poder explicarlo sin inventarlo. */
export const fuenteDelLimite = (nutriente: string): string =>
  TABLA.limites[nutriente]?.fuente ?? ''
