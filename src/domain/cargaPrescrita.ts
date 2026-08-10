import type { EjercicioPrescrito } from './types'

/**
 * La carga pautada, separada del texto que la anuncia.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE ESTE MÓDULO
 * ────────────────────────────────────────────────────────────────────────────
 * `prescripcion` es **texto del coach**: se escribe a mano, se pega desde el
 * Excel y está para leerse ("85KG A 10 REPS; 3 SERIES (RIR 2). PROGRESA +5KG VS
 * M21"). Durante meses fue además la única fuente de la carga, así que la app le
 * sacaba el número con `Number.parseFloat`. Dos formatos reales lo rompían:
 *
 *   · «ASISTENCIA 15KG A 8 REPS» → no empieza por número: caía en los 20 kg por
 *     defecto, y el asesorado abría las dominadas asistidas con una carga
 *     inventada.
 *   · «40 SEG; 3 SERIES. +5KG EN ESPALDA» → empieza por la duración: proponía
 *     **40 kg de plancha** cuando lo pautado son 5.
 *
 * La cifra vive ahora en `EjercicioPrescrito.cargaPrescritaKg` y el texto se
 * queda para lo que sirve: contarle al asesorado qué hacer. Nadie vuelve a
 * deducir kilos leyendo prosa.
 */

/**
 * Kilos que anuncia un texto de prescripción, si es que anuncia alguno.
 *
 * **Es compatibilidad, no la vía normal.** Los microciclos ya guardados —los de
 * la nube y los que se cargan a mano por SQL— no traen `cargaPrescritaKg`, y
 * sacarles el número del texto es mejor que enseñarles 20 kg de relleno. Todo lo
 * que la app crea de cero debe traer el campo.
 *
 * Exige la unidad pegada al número (`15KG`, `52.5 kg`), que es lo que distingue
 * una carga de una duración o de un número de reps. Si el texto trae varias
 * cifras en kilos, manda la primera: en el formato canónico del coach la carga
 * va delante y lo que viene después es el salto contra el microciclo anterior
 * («PROGRESA +5KG VS M21»).
 */
export function cargaEnTexto(texto: string): number | undefined {
  const encontrado = texto.match(/(\d+(?:[.,]\d+)?)\s*KG/i)
  if (!encontrado) return undefined
  const kg = Number(encontrado[1].replace(',', '.'))
  return Number.isFinite(kg) && kg > 0 ? kg : undefined
}

/**
 * Carga pautada del ejercicio: el campo si lo trae y, si no, lo que se pueda
 * rescatar del texto. `undefined` cuando no hay ninguna de las dos cosas —que es
 * distinto de cero, y por eso no se devuelve un número de relleno desde aquí:
 * quien llame decide qué hacer sin carga pautada.
 */
export function cargaPrescritaDe(ejercicio: EjercicioPrescrito): number | undefined {
  if (ejercicio.cargaPrescritaKg !== undefined && ejercicio.cargaPrescritaKg > 0) {
    return ejercicio.cargaPrescritaKg
  }
  return cargaEnTexto(ejercicio.prescripcion)
}
