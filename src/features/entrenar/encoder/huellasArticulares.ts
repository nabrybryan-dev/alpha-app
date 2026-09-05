import type { HuellaDeRepeticion } from '../../../domain/patrones/huella'
import { escribirJSON, leerJSON } from '../../../lib/persistencia'
import { normalizarNombre } from '../salon/paredes/cargaAnterior'

/**
 * DÓNDE VIVE LA HUELLA ARTICULAR de cada ejercicio, en este teléfono.
 *
 * Por NOMBRE de ejercicio y no por serie, a diferencia de la huella de barra: la pista
 * sale de un vídeo que se analiza fuera, horas o días después de la serie, y no hay
 * serie a la que colgarla. Lo que la persona quiere es «cuando vuelva a la sentadilla,
 * que el fantasma haga MI sentadilla», y eso es por ejercicio. Se guarda una por
 * ejercicio —la última pista que se abrió— y el salón la lee por el mismo nombre
 * normalizado que usa para la carga de la semana pasada.
 */
export function claveDeHuellaArticular(nombreEjercicio: string): string {
  return `alpha-huella-articular-${normalizarNombre(nombreEjercicio)}`
}

export function guardarHuellaArticular(nombreEjercicio: string, huella: HuellaDeRepeticion): void {
  escribirJSON(claveDeHuellaArticular(nombreEjercicio), huella)
}

/** La huella articular guardada para ese ejercicio, si la hay y tiene ángulos. */
export function leerHuellaArticular(nombreEjercicio: string | undefined): HuellaDeRepeticion | undefined {
  if (!nombreEjercicio) return undefined
  const h = leerJSON<HuellaDeRepeticion | null>(claveDeHuellaArticular(nombreEjercicio), null)
  if (!h || !Array.isArray(h.fase) || h.fase.length < 2 || !(h.duracionSeg > 0)) return undefined
  if (!h.articular || !Object.keys(h.articular).length) return undefined
  return h
}
