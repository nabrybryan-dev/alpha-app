import { db } from '../../data/dbInstance'
import type { Respuestas } from '../../domain/nutricion/encuesta'
import { senalesDeLaEncuesta } from '../../domain/nutricion/perfilCalculado'
import { visibilidadDe, type Visibilidad } from '../../domain/nutricion/visibilidad'

/**
 * Qué cifras le toca ver a este asesorado, resuelto en UN solo sitio.
 *
 * Vive aquí y no en cada pantalla a propósito. Antes cada una lo resolvía por su
 * cuenta —y «Mi plan» lo resolvía mal, con un `visibilidadDe(undefined)` escrito
 * a pelo que devolvía siempre los tres interruptores encendidos—, así que la
 * decisión de la nutricionista no cambiaba nada en el móvil.
 *
 * Dos pantallas que responden por separado a la misma pregunta terminan
 * respondiendo distinto, y aquí «distinto» significa enseñarle un porcentaje de
 * grasa a quien pidió no verlo. Con una sola función, arreglar una es arreglar
 * las dos.
 *
 * DOS FUENTES, NO UNA. La decisión guardada por el staff manda; si no hay
 * ninguna, se miran las señales de la encuesta, porque el estado «en espera» no
 * está guardado en la base: se deriva. La app del asesorado no puede escribir
 * esa tabla —si pudiera, se encendería sus propios interruptores—, así que si
 * esta función no derivara la señal, nadie marcaría a nadie nunca.
 */
export function visibilidadDelAsesorado(usuarioId: string): Visibilidad {
  return visibilidadDe(db.visibilidad.byUsuario(usuarioId), senalesDeLaEncuesta(respuestasDe(usuarioId)))
}

/** Lo que respondió en la encuesta, o nada si todavía no la ha contestado. */
export function respuestasDe(usuarioId: string): Respuestas {
  return (db.perfilNutricion.byUsuario(usuarioId)?.respuestas ?? {}) as Respuestas
}
