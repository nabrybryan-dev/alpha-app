import { parsearPrescripcion } from './prescripcion'
import type { EjercicioPrescrito } from './types'

/**
 * ¿Dice la frase lo mismo que los campos?
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE
 * ────────────────────────────────────────────────────────────────────────────
 * Cada ejercicio guarda su prescripción **dos veces**: como frase que el
 * asesorado lee (`prescripcion`) y como campos que la app usa para operar
 * (`sets`, `repsDiana`, `rirObjetivo`, `cargaKg`). La duplicación viene del
 * Excel, cuya fila lleva las columnas SET · RANGO · REPETICIONES · RIR **y
 * además** la prescripción escrita dentro de NOTAS ASESORADO. La app heredó esa
 * forma. Dos copias del mismo dato que nadie compara acaban divergiendo.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * EL INCIDENTE (2026-08-12)
 * ────────────────────────────────────────────────────────────────────────────
 * En la semana del 11 de agosto, **128 ejercicios de 13 asesorados** tenían la
 * frase y los campos diciendo cosas distintas:
 *
 *   · 63 leían «3 SERIES» mientras `sets` valía 2.
 *   · 69 leían «(RIR 1)» o «(RIR 0)» mientras `rirObjetivo` valía 2.
 *   · 1 tenía una escalera de 3 series con `sets` en 2.
 *
 * No es cosmético. `sets` decide **cuándo se da el ejercicio por terminado**
 * (`cumplimiento.ts`), cuánto volumen se contabiliza y de cuántas series parte
 * la ondulación siguiente. `rirObjetivo` elige el coeficiente de %1RM, así que
 * un RIR 2 donde el coach pidió 1 hace que el motor proponga **casi un 5 % menos
 * de carga**. Y todo eso ocurría mientras la tarjeta enseñaba «Sets 2 · RIR 2»
 * tres centímetros encima de un texto que decía «3 SERIES (RIR 1)».
 *
 * La causa fue herencia: el clonador escribe `sets`, `rirObjetivo` y `repsDiana`
 * solo cuando el ajuste los trae. Si la carga pasa la frase nueva sin pasarlos,
 * la frase se actualiza y los campos se quedan con los de la semana anterior.
 * Se comprobó: en prácticamente todos los desalineados, el campo era idéntico al
 * del microciclo previo.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * QUÉ MANDA
 * ────────────────────────────────────────────────────────────────────────────
 * **La frase**, porque es lo que el coach escribe y lo que la persona lee. Los
 * campos se derivan de ella. La única excepción es `sets` en un ejercicio
 * ondulado: ahí manda `seriesPrescritas`, que lista las series una a una.
 *
 * Esto no arregla nada por sí solo: **detecta**. Es la red que faltaba, la misma
 * idea que `comprobar-fosiles.sql` para las marcas de ejecución heredadas.
 */

export type CampoAlineable = 'cargaKg' | 'repsDiana' | 'sets' | 'rirObjetivo'

export interface Desalineacion {
  campo: CampoAlineable
  /** Lo que dice la frase que lee el asesorado. */
  enLaFrase: number
  /** Lo que el ejercicio tiene guardado, y con lo que la app opera. */
  enElCampo: number | undefined
}

/**
 * Compara un campo con lo que anuncia la frase. `undefined` = nada que decir.
 *
 * Dos silencios deliberados:
 *
 * - **El valor de la frase no es un número.** El RIR se escribe también «2-3» o
 *   «ISOMETRÍA», y `repsDiana` llega a valer «Isometría». Ahí no hay nada que
 *   contrastar, y fingir que lo hay es lo que abortaba la carga entera.
 * - **El campo no existe todavía.** Un campo ausente no está desalineado: está
 *   sin rellenar, y de eso se ocupa `scripts/rellenar-carga.mjs`. Sin esta
 *   salvedad, `cargaKg` —que hoy está vacío en los 506 ejercicios activos—
 *   generaba 279 falsos positivos y tapaba los desajustes de verdad.
 */
function contrastar(
  campo: CampoAlineable,
  enLaFrase: number | string | undefined,
  enElCampo: number | undefined,
): Desalineacion | undefined {
  if (typeof enLaFrase !== 'number' || !Number.isFinite(enLaFrase)) return undefined
  if (enElCampo === undefined) return undefined
  if (enLaFrase === enElCampo) return undefined
  return { campo, enLaFrase, enElCampo }
}

/**
 * Los desajustes entre la frase y los campos. Vacío = alineado, o no hay forma
 * de saberlo (frases de porcentaje, de peso corporal o de tiempo, que no llevan
 * cabecera legible: ahí no hay nada que contrastar y no se inventa).
 */
export function revisarAlineacion(ejercicio: EjercicioPrescrito): Desalineacion[] {
  const escalera = ejercicio.seriesPrescritas
  if (escalera && escalera.length > 0) {
    // Ondulado: la escalera lista las series una a una, así que manda ella.
    // Con `sets` por debajo, la app cierra el ejercicio antes de la serie tope
    // —que en una ondulación ascendente es la más pesada— y la persona nunca
    // llega a hacerla. Pasó de verdad, en una carga real.
    return escalera.length === ejercicio.sets
      ? []
      : [{ campo: 'sets', enLaFrase: escalera.length, enElCampo: ejercicio.sets }]
  }

  const frase = parsearPrescripcion(ejercicio.prescripcion)
  if (!frase.reconocida) return []

  return [
    contrastar('cargaKg', frase.cargaKg, ejercicio.cargaKg),
    contrastar('repsDiana', frase.repsDiana, ejercicio.repsDiana),
    contrastar('sets', frase.sets, ejercicio.sets),
    contrastar('rirObjetivo', frase.rirObjetivo, ejercicio.rirObjetivo),
  ].filter((d): d is Desalineacion => d !== undefined)
}

// `alineado()` vivía aquí y era `revisarAlineacion(e).length === 0`. Solo lo
// usaban sus propios tests, así que se fue: una API que envuelve una línea y no
// tiene consumidor es peso muerto, y para eso está el detector de huérfanos.

/**
 * Los ejercicios de una sesión que no cuadran, con su id. Pensado para el barrido
 * posterior a una carga: lo que devuelva esto tiene que ser una lista vacía.
 */
export function desalineadosDe(
  ejercicios: readonly EjercicioPrescrito[],
): { id: string; nombre: string; desajustes: Desalineacion[] }[] {
  return ejercicios
    .map((e) => ({ id: e.id, nombre: e.nombre, desajustes: revisarAlineacion(e) }))
    .filter((r) => r.desajustes.length > 0)
}
