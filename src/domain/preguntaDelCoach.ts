import type { Mensaje } from './types'

/**
 * La pregunta del coach que la persona todavía no ha contestado, o `undefined`.
 *
 * Se enseña debajo del vídeo de la revisión semanal (decisión de Bryan, 2026-09-12):
 * desde ese día, en riesgo medio el plan sigue y se le pregunta a la persona, y de esa
 * respuesta depende si continúa o se para. Recortada en una línea del cuadro del chat
 * no se veía.
 *
 * Solo cuenta el ÚLTIMO mensaje del hilo, y solo si:
 *   1. es del coach — si lo último es de la persona, ya contestó;
 *   2. es humano — una respuesta automática del Centro (`origen: 'alpha'`) no es una
 *      pregunta del coach y no se presenta como tal;
 *   3. pregunta algo — un «buen trabajo» no se queda pegado debajo del vídeo.
 *
 * Se ordena aquí por `fechaIso` en vez de fiarse del orden de llegada: el repositorio
 * ordena hoy, pero esta regla no puede depender de cómo lo haga mañana.
 */
export function preguntaPendienteDelCoach(
  hilo: readonly Mensaje[],
  coachId: string,
): Mensaje | undefined {
  if (hilo.length === 0) return undefined
  const ordenado = [...hilo].sort((a, b) => a.fechaIso.localeCompare(b.fechaIso))
  const ultimo = ordenado[ordenado.length - 1]
  if (ultimo.deId !== coachId) return undefined
  if (ultimo.origen === 'alpha') return undefined
  return ultimo.texto.includes('?') ? ultimo : undefined
}
