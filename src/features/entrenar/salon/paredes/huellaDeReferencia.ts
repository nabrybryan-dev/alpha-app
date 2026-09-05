import type { HuellaDeRepeticion } from '../../../../domain/patrones/huella'
import type { EjercicioPrescrito, Microciclo } from '../../../../domain/types'
import { normalizarNombre } from './cargaAnterior'

/**
 * QUÉ REPETICIÓN SE ENSEÑA COMO FANTASMA.
 *
 * Dos fuentes, en este orden:
 *
 * 1. **Hoy**: la última serie registrada de este ejercicio que traiga huella. Es lo que
 *    se acaba de hacer, y es lo que se compara con lo que había que hacer.
 * 2. **La semana pasada**: el mismo ejercicio en el microciclo anterior, por nombre —los
 *    id se generan por microciclo—, y de él su última serie con huella. Es lo que Bryan
 *    llamó «lo que hizo la semana pasada»: empezar el ejercicio viendo cómo se terminó la
 *    última vez.
 *
 * Y si no hay ninguna, no hay fantasma. No se inventa uno con la repetición ideal: un
 * fantasma que fuera igual que el sujeto no enseñaría nada y diría que se midió.
 *
 * Y por encima de las dos, **el vídeo**: si hay una huella articular del ejercicio —de
 * una pista de pose abierta en el encoder—, esa manda. Las de barra dicen a qué ritmo
 * se movió la carga; la articular dice además cómo se movió el cuerpo.
 */
export interface HuellaDeReferencia {
  huella: HuellaDeRepeticion
  cuando: 'video' | 'hoy' | 'semana-pasada'
}

export function huellaDeReferencia(
  ejercicio: EjercicioPrescrito | undefined,
  previo: Microciclo | undefined,
  /**
   * La huella ARTICULAR del ejercicio, si alguien abrió una pista de pose para él
   * (`huellasArticulares.ts`). Manda sobre las de barra: trae la rodilla, la cadera y
   * el tronco que se hicieron, y las otras solo traen la barra. Llega por parámetro
   * para que esto siga siendo puro y se pruebe sin `localStorage`.
   */
  deVideo?: HuellaDeRepeticion,
): HuellaDeReferencia | undefined {
  if (!ejercicio) return undefined
  if (deVideo?.articular && deVideo.fase.length >= 2) return { huella: deVideo, cuando: 'video' }
  const deHoy = ultimaHuella(ejercicio)
  if (deHoy) return { huella: deHoy, cuando: 'hoy' }

  if (!previo) return undefined
  const buscado = normalizarNombre(ejercicio.nombre)
  for (const sesion of previo.sesiones) {
    for (const otro of sesion.ejercicios) {
      if (normalizarNombre(otro.nombre) !== buscado) continue
      const h = ultimaHuella(otro)
      if (h) return { huella: h, cuando: 'semana-pasada' }
    }
  }
  return undefined
}

/** La huella de la última serie que la traiga, por `orden`. */
function ultimaHuella(ejercicio: EjercicioPrescrito): HuellaDeRepeticion | undefined {
  const conHuella = ejercicio.series
    .filter((s) => s.velocidad?.huella && s.velocidad.huella.fase.length >= 2)
    .sort((a, b) => a.orden - b.orden)
  return conHuella.at(-1)?.velocidad?.huella
}
