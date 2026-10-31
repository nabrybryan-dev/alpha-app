/**
 * La salud de Hermes que ve el coach (0152, ALARMA-1).
 *
 * La regla central NO es mirar el estado de cada pieza sino la HORA: un minipc apagado no
 * escribe nada y la tabla seguiría diciendo «arriba» de hace tres horas. Por eso, si alguna
 * pieza lleva más de `MINUTOS_SIN_SENAL` sin verse, o no hay filas, el veredicto es SIN SEÑAL,
 * aunque el último estado guardado fuera bueno. El vigía pasa cada 20 minutos: 45 son más de dos
 * pasadas perdidas.
 */
export const MINUTOS_SIN_SENAL = 45
export const PIEZAS_HERMES = ['puerta', 'hermes', 'custodio'] as const
export type PiezaHermes = (typeof PIEZAS_HERMES)[number]

export interface FilaSaludHermes {
  pieza: string
  estado: string
  vistoEn: string
}

export interface PiezaCaida {
  pieza: PiezaHermes
  estado: 'caido' | 'desconocido'
  queHacer: string
}

export type VeredictoSalud =
  | { tipo: 'sin_senal'; motivo: 'sin_filas' | 'vieja'; minutos: number | null }
  | { tipo: 'pieza_caida'; piezas: PiezaCaida[] }
  | { tipo: 'todo_bien'; minutos: number }

const QUE_HACER: Record<PiezaHermes, string> = {
  puerta: 'Reinicia la puerta en el minipc (contenedor config-puerta-1).',
  hermes: 'Reinicia Hermes en el minipc (contenedor config-hermes-1).',
  custodio: 'Vuelve a lanzar la tarea Alpha-Custodio-Servir en el minipc.',
}

export function veredictoDeSalud(filas: FilaSaludHermes[], ahora: number): VeredictoSalud {
  const porPieza = new Map(filas.map((f) => [f.pieza, f]))
  const delMinipc = PIEZAS_HERMES.map((p) => porPieza.get(p)).filter((f): f is FilaSaludHermes => !!f)
  if (delMinipc.length === 0) return { tipo: 'sin_senal', motivo: 'sin_filas', minutos: null }

  // Una hora que no se entiende cuenta como vieja: nunca como «reciente».
  const edades = delMinipc.map((f) => {
    const t = Date.parse(f.vistoEn)
    return Number.isNaN(t) ? Infinity : Math.floor((ahora - t) / 60_000)
  })
  const peor = Math.max(...edades)
  if (peor > MINUTOS_SIN_SENAL) {
    return { tipo: 'sin_senal', motivo: 'vieja', minutos: Number.isFinite(peor) ? peor : null }
  }

  const caidas: PiezaCaida[] = []
  for (const pieza of PIEZAS_HERMES) {
    const estado = porPieza.get(pieza)?.estado
    if (estado === 'arriba') continue
    caidas.push({
      pieza,
      estado: estado === 'caido' ? 'caido' : 'desconocido',
      queHacer: QUE_HACER[pieza],
    })
  }
  if (caidas.length > 0) return { tipo: 'pieza_caida', piezas: caidas }
  return { tipo: 'todo_bien', minutos: Math.max(0, peor) }
}
