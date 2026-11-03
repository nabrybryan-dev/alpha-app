import type { CheckinDiario } from '../../domain/types'
import { tramoDeDolor } from '../../domain/senales/dolor'
import { tramoDeHambre } from '../../domain/senales/hambre'

/**
 * Filas [etiqueta, valor] de lo que la persona llenó hoy (solo lo diligenciado).
 *
 * `verPeso` viene de la decisión de la nutricionista. Dejar de PEDIR el peso sin dejar de
 * ENSEÑARLO no serviría de nada: los kilos que ya están guardados seguirían
 * apareciéndole cada día en su propio resumen.
 *
 * Vive aparte de `HistorialDeCheckins.tsx` para que ese archivo solo exporte componentes
 * (la regla de Fast Refresh del proyecto).
 */
export function filasCheckin(c: CheckinDiario, verPeso: boolean): [string, string][] {
  const filas: [string, string][] = []
  if (verPeso && c.pesoKg !== undefined) filas.push(['Peso ayunas', `${c.pesoKg} kg`])
  if (c.pasos !== undefined) filas.push(['Pasos de ayer', c.pasos.toLocaleString('es-CO')])
  if (c.entreno) filas.push(['Entreno', c.entreno])
  if (c.rendimiento) filas.push(['Rendimiento', c.rendimiento])
  if (c.motivacion) filas.push(['Motivación', c.motivacion])
  // Los dos, y sin mezclarlos: los check-ins viejos guardaron una categoría y los nuevos
  // guardan un número. Enseñar «MUCHO» como si fuera un 8 diría que se midió algo que
  // nadie midió.
  if (c.hambreEscala !== undefined) {
    filas.push(['Hambre', `${c.hambreEscala} / 10 · ${tramoDeHambre(c.hambreEscala).etiqueta}`])
  } else if (c.hambre) {
    filas.push(['Hambre', `${c.hambre} (escala antigua)`])
  }
  if (c.cansancio) filas.push(['Cansancio', c.cansancio])
  if (c.estres) filas.push(['Estrés', c.estres])
  if (c.horasSueno !== undefined) {
    filas.push(['Sueño', `${c.horasSueno} h${c.calidadSueno ? ` · ${c.calidadSueno}` : ''}`])
  }
  if (c.alimentacion) filas.push(['Alimentación', c.alimentacion])
  // El cero se enseña: «sin dolor» es un dato que la persona marcó, no un hueco.
  if (c.dolor !== undefined) {
    const donde = c.dolorDonde ? ` · ${c.dolorDonde}` : ''
    filas.push(['Dolor', `${c.dolor} / 10 · ${tramoDeDolor(c.dolor).etiqueta}${donde}`])
  }
  return filas
}
