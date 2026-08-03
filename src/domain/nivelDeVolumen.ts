import type { NivelVolumen } from './types'

/**
 * Traduce series por grupo y semana a la MISMA escala de palabras que usa la
 * hoja PERFIL.
 *
 * Existe porque la app decía "volumen por grupo" en dos pantallas con dos
 * vocabularios distintos: PERFIL usa Muy Bajo / Bajo / Normal / Alto / Muy Alto,
 * y Progreso usaba Bajo / Medio / Alto / Muy alto. Ni "Normal" existía en una ni
 * "Medio" en la otra, así que el mismo grupo se leía distinto en dos pantallas
 * el mismo día.
 *
 * Los cortes se anclan en los landmarks del motor (Israetel/RP, página 01):
 * MEV ≈10 series por grupo y semana, MRV ≈22. "Normal" empieza donde empieza el
 * mínimo efectivo, y "Muy Alto" en la zona donde el motor ya manda vigilar la
 * fatiga. No son prescripción: son la escala con la que se lee un número.
 */
const CORTES: readonly { desde: number; nivel: NivelVolumen }[] = [
  { desde: 20, nivel: 'Muy Alto' },
  { desde: 15, nivel: 'Alto' },
  { desde: 10, nivel: 'Normal' },
  { desde: 6, nivel: 'Bajo' },
  { desde: 0, nivel: 'Muy Bajo' },
]

export function nivelDeSeries(series: number): NivelVolumen {
  return CORTES.find((c) => series >= c.desde)?.nivel ?? 'Muy Bajo'
}
