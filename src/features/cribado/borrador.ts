/**
 * El borrador del cribado: lo que la persona lleva contestado y aún no ha enviado.
 *
 * Vive en su propio archivo y no dentro de `CribadoForm` porque HoyPage necesita
 * preguntarle si hay algo empezado —para no retirarle la tarjeta a media pregunta— y
 * exportar una función desde un archivo de componente rompe el refresco en caliente
 * (`react-refresh/only-export-components`, que en este repo es un aviso que no se deja
 * crecer).
 */
import { leerJSON } from '../../lib/persistencia'

export interface Borrador {
  respuestas: Record<string, 'si' | 'no'>
  detalle: Record<string, string>
}

export const VACIO: Borrador = { respuestas: {}, detalle: {} }

/** Una clave por persona: en un teléfono compartido, el borrador de una no es el de la otra. */
export const claveBorrador = (usuarioId: string) => `alpha-cribado-${usuarioId}`

/**
 * ¿Esta persona tiene el cribado empezado y sin terminar?
 *
 * Lo pregunta HoyPage para NO desmontarle el formulario a media pregunta. Hasta el
 * 2026-09-10 la tarjeta se pintaba solo mientras `necesitaCribado` fuera cierto, y esa
 * condición se apaga en cuanto llega de arriba la ficha que volcó el coach: quien
 * estuviera contestando las doce preguntas de salud veía **desaparecer el formulario sin
 * una palabra**.
 */
export function hayBorradorDeCribado(usuarioId: string): boolean {
  const b = leerJSON<Borrador>(claveBorrador(usuarioId), VACIO)
  return Object.keys(b.respuestas).length > 0
}
