import type { DiaRuta } from '../../../../domain/rutaEntrenamiento'

/** El estado de un día en una palabra, mirado desde hoy. */
export function estadoDelDia(dia: DiaRuta, hoyIso: string | undefined): string {
  if (dia.estado === 'completada') return 'Hecha'
  if (dia.estado === 'descanso') return 'Descanso'
  if (dia.esHoy) return 'Toca hoy'
  // Una programada de un día que ya pasó no está pendiente: se quedó sin hacer.
  if (hoyIso && dia.fechaIso < hoyIso) return 'Sin hacer'
  return 'Pendiente'
}

export const COLOR_DEL_ESTADO: Record<string, string> = {
  Hecha: 'text-texto',
  'Toca hoy': 'text-accion',
  Pendiente: 'text-silver-300',
  'Sin hacer': 'text-tenue',
  Descanso: 'text-tenue',
}
