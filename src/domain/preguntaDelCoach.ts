import type { Mensaje } from './types'

/**
 * La pregunta del coach que la persona todavía no ha contestado, o `undefined`.
 *
 * Se enseña debajo del vídeo de la revisión semanal (decisión de Bryan, 2026-09-12):
 * desde ese día, en riesgo medio el plan sigue y se le pregunta a la persona, y de esa
 * respuesta depende si continúa o se para. Recortada en una línea del cuadro del chat
 * no se veía.
 *
 * Se recorre el hilo desde el final hasta la última palabra de la persona —cualquier
 * mensaje suyo cuenta como respuesta— y, de lo que el coach escribió después, gana el
 * mensaje más reciente que:
 *   1. es humano — una respuesta automática del Centro (`origen: 'alpha'`) no es una
 *      pregunta del coach y no se presenta como tal;
 *   2. pregunta algo — un «buen trabajo» no se queda pegado debajo del vídeo.
 *
 * Lo que no pregunta NO tapa la pregunta: la primera versión solo miraba el último
 * mensaje, y un «buen trabajo» escrito detrás la borraba sin que nadie la contestara.
 *
 * Se ordena aquí por `fechaIso` en vez de fiarse del orden de llegada: el repositorio
 * ordena hoy, pero esta regla no puede depender de cómo lo haga mañana.
 */
export function preguntaPendienteDelCoach(
  hilo: readonly Mensaje[],
  coachId: string,
): Mensaje | undefined {
  const ordenado = [...hilo].sort((a, b) => b.fechaIso.localeCompare(a.fechaIso))
  for (const m of ordenado) {
    // Lo automático se salta antes de mirar quién lo firma: ni pregunta ni contesta.
    if (m.origen === 'alpha') continue
    if (m.deId !== coachId) return undefined
    if (m.texto.includes('?')) return m
  }
  return undefined
}
