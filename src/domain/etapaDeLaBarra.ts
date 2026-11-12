// Etapa de la persona para la barra inferior (pieza C6 del rediseño).
// Función pura: no lee la base ni cambia ninguna pantalla. La barra real
// (BottomNav) NO la usa mientras BARRA_POR_ETAPA_ACTIVA sea false.
// Maqueta de referencia: build-v8/3r-v10-etapas.js.

/** Apagada: nada visible cambia. Se enciende cuando Praxis esté abierta a
 *  asesorados y exista el sello del día (de ahí sale la comida cumplida). */
export const BARRA_POR_ETAPA_ACTIVA = false

export type Etapa = 'empezando' | 'entrenando' | 'comida'
export type PestanaBarra = 'Hoy' | 'Empezar' | 'Praxis' | 'Salón' | 'Nutrición' | 'Semana'

/** Núcleo fijo: Hoy a la izquierda, Praxis al centro. */
export const PESTANAS_POR_ETAPA: Record<Etapa, readonly PestanaBarra[]> = {
  empezando: ['Hoy', 'Empezar', 'Praxis', 'Salón', 'Nutrición'],
  entrenando: ['Hoy', 'Salón', 'Praxis', 'Nutrición', 'Semana'],
  comida: ['Hoy', 'Nutrición', 'Praxis', 'Salón', 'Semana'],
}

/** Regla fijada por Bryan (4-nov): 3 de 7 días sin cumplir en una semana. */
export const FOCO_COMIDA_DIAS_SIN_CUMPLIR = 3
export const FOCO_COMIDA_VENTANA_DIAS = 7

export interface DiaDeComida {
  /** AAAA-MM-DD */
  fecha: string
  cumplio: boolean
  /** Día anotado a ojo: no cuenta ni a favor ni en contra. */
  aOjo?: boolean
}

/** Praxis PROPONE foco en comida si, en los últimos 7 días, 3 o más quedaron
 *  sin cumplir. El día a ojo se descarta antes de contar. El coach confirma. */
export function proponeFocoEnComida(dias: readonly DiaDeComida[]): boolean {
  const ventana = [...dias]
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
    .slice(0, FOCO_COMIDA_VENTANA_DIAS)
  const sinCumplir = ventana.filter((d) => !d.aOjo && !d.cumplio).length
  return sinCumplir >= FOCO_COMIDA_DIAS_SIN_CUMPLIR
}

export interface SenalesDeEtapa {
  /** necesitaPantallaDeSalud(...) */
  cribadoPendiente: boolean
  /** Hay un microciclo activo. */
  tieneMicrociclo: boolean
  /** El coach confirmó la propuesta de Praxis de foco en comida. */
  focoEnComidaConfirmado?: boolean
}

export function etapaDe(s: SenalesDeEtapa): Etapa {
  if (s.cribadoPendiente || !s.tieneMicrociclo) return 'empezando'
  if (s.focoEnComidaConfirmado) return 'comida'
  return 'entrenando'
}

/** Pestañas de la barra por etapa, o null si la bandera está apagada
 *  (el llamador conserva entonces la barra de siempre). */
export function pestanasDeLaBarra(
  s: SenalesDeEtapa,
  activa: boolean = BARRA_POR_ETAPA_ACTIVA,
): readonly PestanaBarra[] | null {
  return activa ? PESTANAS_POR_ETAPA[etapaDe(s)] : null
}
