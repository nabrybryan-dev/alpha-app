import type { AlimentoIndice } from './busqueda'
import tabla from './datos-sospechosos.json'

/**
 * Alimentos cuyo dato no se sostiene, y que por eso no suman.
 *
 * EL CASO QUE LO MOTIVA. La "Piña india" de la TCAC declara 2.445 mg de potasio
 * por 100 g; la piña corriente tiene 159. Quien registraba una tajada de 150 g
 * se llevaba 3.667 mg al total del día -más que la ingesta diaria recomendada
 * entera- y el panel de micros se lo pintaba como si fuera cierto.
 *
 * DE DÓNDE SALE LA LISTA. Del Cerebro: las cenizas son el residuo mineral del
 * alimento, medido aparte en la misma tabla, así que la suma de los minerales
 * declarados no puede superarlas. Cuando la supera, una de las dos columnas
 * está mal, y se sabe sin salir de la tabla. Son 22 filas, más la oca, que
 * declara 382 mg de vitamina C sin cáscara y 31 con cáscara.
 *
 * NO ESTÁ TECLEADA AQUÍ. `datos-sospechosos.json` lo exporta
 * `herramientas/base-alimentos/datos_sospechosos.py` (`py datos_sospechosos.py`)
 * y un test de allá compara el archivo con la tabla. Copiar los 23 ids a mano
 * habría bastado hoy y se habría desincronizado en silencio en cuanto alguien
 * verificara un dato y borrara su fila: la app seguiría apartándolo para
 * siempre. No editar este JSON a mano.
 *
 * NO SE CORRIGE NINGÚN NÚMERO. El catálogo sigue declarando lo que declara la
 * fuente oficial: el dato se aparta al usarlo, no se reescribe. En cuanto
 * alguien lo verifique contra otra fuente, desaparece de la tabla y el alimento
 * vuelve a sumar.
 */

interface CasoSospechoso {
  nutrientes: string[]
  motivo: string
}

const TABLA = tabla as Record<string, CasoSospechoso>

const EN_DUDA = new Map<string, ReadonlySet<string>>(
  Object.entries(TABLA).map(([id, caso]) => [id, new Set(caso.nutrientes)]),
)

const NINGUNO: ReadonlySet<string> = new Set()

/** Los nutrientes de este alimento que no se pueden dar por buenos. */
export function nutrientesEnDuda(id: string): ReadonlySet<string> {
  return EN_DUDA.get(id) ?? NINGUNO
}

/** Por qué está apartado, para cuando haya que explicárselo a alguien. */
export function motivoDeLaDuda(id: string): string | undefined {
  return TABLA[id]?.motivo
}

/**
 * El alimento con sus datos cuestionados en `null`.
 *
 * `null` es "no se midió", nunca "no contiene" (ver `porcion.ts`): un cero
 * afirmaría que la piña india no tiene potasio, que es tan falso como los
 * 2.445 mg. Con `null`, `nutrientesAusentes()` lo recoge solo y el día se
 * declara PARCIAL en ese nutriente -el "≥" del panel-, que es decir lo que
 * pasa en vez de inventar una cifra.
 *
 * Solo se apartan los nutrientes cuestionados: las kcal de la piña india no
 * están en duda y siguen contando.
 *
 * Devuelve un objeto nuevo. El catálogo es el mismo objeto para toda la app y
 * los fallos de pérdida de datos de este repo vinieron de mutar compartido.
 * Cuando no hay nada en duda -1.172 de los 1.195- devuelve el mismo alimento
 * sin copiar nada.
 */
export function sinDatosEnDuda(alimento: AlimentoIndice): AlimentoIndice {
  const enDuda = nutrientesEnDuda(alimento.id)
  if (enDuda.size === 0) return alimento

  const por100g = { ...alimento.por100g }
  for (const clave of Object.keys(por100g) as (keyof typeof por100g)[]) {
    // Del catálogo del Cerebro solo viajan siete nutrientes al índice: el
    // calcio o el zinc de esas mismas filas ni siquiera están aquí, y no hay
    // nada que apartar.
    if (enDuda.has(clave)) por100g[clave] = null
  }
  return { ...alimento, por100g }
}
