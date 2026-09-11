import type { Db } from '../../data/repos'
import type { Cuestionario } from '../../domain/types'

/**
 * Las preguntas que la cadena de agentes dejó abiertas para una persona.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE
 * ────────────────────────────────────────────────────────────────────────────
 * Hoy la cadena no puede preguntar. Cuando a un agente le falta un dato que solo
 * el asesorado tiene —qué días entrena, qué es esa condición médica que marcó y
 * dejó en blanco— pasa una de dos cosas, y las dos son malas: o el plan se queda
 * parado hasta que alguien se acuerde, o el agente se inventa un supuesto.
 *
 * El 2026-09-06 pasaron las dos. Una persona estuvo días sin plan por una línea que
 * solo ella podía contestar, y a otra se le asignaron días de entrenamiento
 * inventados porque no había forma de preguntárselos: sus cuatro sesiones no tenían
 * ni una marca de la que deducirlos.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * NO HAY TABLA NUEVA, Y ES A PROPÓSITO
 * ────────────────────────────────────────────────────────────────────────────
 * Un cuestionario ya es exactamente esto: un título, unas preguntas y a quién van.
 * La app lo sabe pintar, guardar y sincronizar desde la migración 0001. Lo único
 * que faltaba era distinguir el que manda una persona del que manda la cadena, y
 * eso son dos campos opcionales en `Cuestionario` (`origen` y `ref`), no una tabla.
 *
 * Duplicar la estructura habría traído su propia hidratación, su propia cola y su
 * propio conjunto de fallos, para acabar guardando lo mismo.
 */

/** Un cuestionario que escribió la cadena, no una persona. */
export function esDeLaCadena(cuestionario: Cuestionario): boolean {
  return cuestionario.origen === 'cadena'
}

/**
 * Lo que la cadena le pregunta y todavía no ha contestado.
 *
 * Se filtra por respuesta y no por una marca de «respondido» en el propio
 * cuestionario: la respuesta ES el registro de que contestó, y un segundo campo
 * diciendo lo mismo se puede desincronizar del primero. Es la misma razón por la
 * que el estado del microciclo vive en un sitio y no en dos.
 */
export function preguntasPendientes(db: Db, usuarioId: string): Cuestionario[] {
  const contestados = new Set(
    db.cuestionarios.respuestasDe(usuarioId).map((r) => r.cuestionarioId),
  )
  return db.cuestionarios
    .asignadosA(usuarioId)
    .filter(esDeLaCadena)
    .filter((q) => !contestados.has(q.id))
}

/**
 * La que se le enseña: la primera pendiente, o nada.
 *
 * **Una cada vez, y esa es una decisión de producto, no una limitación.** Quien abre
 * la app en el gimnasio con tres preguntas encima cierra la app. Con una, contesta.
 * Cuando conteste esa, la siguiente aparece sola en la próxima carga.
 */
export function preguntaDelDia(db: Db, usuarioId: string): Cuestionario | undefined {
  return preguntasPendientes(db, usuarioId)[0]
}

/**
 * A qué microciclo vuelve la respuesta.
 *
 * Es el `pregunta_ref` del contrato de los agentes, y sin él la respuesta se queda
 * en la base sin nadie que la recoja. Devuelve `undefined` para los cuestionarios
 * del coach, que no vuelven a ninguna cadena.
 */
export function referenciaDeLaCadena(cuestionario: Cuestionario): string | undefined {
  return esDeLaCadena(cuestionario) ? cuestionario.ref : undefined
}
