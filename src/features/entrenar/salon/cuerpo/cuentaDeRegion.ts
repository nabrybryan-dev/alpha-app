import { NOMBRE_DE_REGION, type IdDeRegion } from '../../sujeto/regiones'
import type { SeriesPorRegion } from '../../sujeto/tinte'
import type { RangoDeLectura } from './PortadaDelCuerpo'

/** Lo que dice una región tocada: «Dorsal · 2 series hoy». Solo muestra, no cuenta. */
function cifra(n: number): string {
  const r = Math.round(n * 10) / 10
  return String(r).replace('.', ',')
}

export function cuentaDeRegion(id: IdDeRegion, series: SeriesPorRegion, rango: RangoDeLectura): string {
  const n = series[id] ?? 0
  return `${NOMBRE_DE_REGION[id]} · ${cifra(n)} ${n === 1 ? 'serie' : 'series'} ${rango === 'hoy' ? 'hoy' : 'esta semana'}`
}
