import type { MagnitudPautado } from '../../../domain/pautadoVsHecho'

/** Los nombres de cada magnitud: el del botón y la unidad que se escribe junto a las cifras. */
export const NOMBRE_MAGNITUD: Record<MagnitudPautado, { corto: string; unidad: string }> = {
  series: { corto: 'Series', unidad: 'series' },
  volumen: { corto: 'Volumen', unidad: 'kg·rep' },
}
