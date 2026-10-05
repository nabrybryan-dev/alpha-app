import type { CadenaCorrida, PasoCadena } from '../../data/consola/cadenaCorridas'
import { ultimoEventoPorPaso } from '../../data/consola/cadenaCorridas'

const PASOS: readonly PasoCadena[] = [1, 2, 3, 4]

export interface FilaTableroAgentes {
  usuarioId: string
  /** `semana_inicio` más reciente que tiene esta persona, o `undefined` sin ninguna corrida. */
  semanaInicio: string | undefined
  /** El último evento visto de cada paso, DENTRO de `semanaInicio` — nunca mezcla semanas. */
  pasos: Partial<Record<PasoCadena, CadenaCorrida>>
}

/**
 * De todas las corridas de la cadena (de toda la cartera), la fila de tablero de UNA
 * persona: su semana más reciente (`semana_inicio` máxima) y el último evento de cada paso
 * dentro de esa semana. Un paso sin evento en `pasos` es "sin dato" — lo decide quien pinta
 * la casilla, no esta función, que no inventa un estado que no llegó.
 */
export function filaDeLaPersona(usuarioId: string, todasLasCorridas: readonly CadenaCorrida[]): FilaTableroAgentes {
  const propias = todasLasCorridas.filter((c) => c.usuarioId === usuarioId)
  if (propias.length === 0) return { usuarioId, semanaInicio: undefined, pasos: {} }

  const semanaInicio = propias.reduce(
    (masReciente, c) => (c.semanaInicio > masReciente ? c.semanaInicio : masReciente),
    propias[0].semanaInicio,
  )
  const deEsaSemana = propias.filter((c) => c.semanaInicio === semanaInicio)
  return { usuarioId, semanaInicio, pasos: ultimoEventoPorPaso(deEsaSemana) }
}

/**
 * La fecha de recepción más reciente de TODA la cartera — lo que pinta la cabecera "Datos
 * de la cadena del …". `undefined` sin ninguna corrida (todavía no ha sincronizado nada).
 */
export function fechaRecepcionMasReciente(todasLasCorridas: readonly CadenaCorrida[]): string | undefined {
  if (todasLasCorridas.length === 0) return undefined
  return todasLasCorridas.reduce(
    (masReciente, c) => (c.fechaRecepcion > masReciente ? c.fechaRecepcion : masReciente),
    todasLasCorridas[0].fechaRecepcion,
  )
}

const VEINTICUATRO_HORAS_MS = 24 * 60 * 60 * 1000

/**
 * Petición de Astra: si la última recepción de la cadena tiene más de 24 h, la consola lo
 * dice con una etiqueta visible, no lo calla. `fechaRecepcionIso` inválida cuenta como "no
 * atrasado" (no hay con qué comparar) en vez de reventar la cabecera.
 */
export function datosAtrasados(fechaRecepcionIso: string, ahora: Date = new Date()): boolean {
  const recibido = new Date(fechaRecepcionIso).getTime()
  if (Number.isNaN(recibido)) return false
  return ahora.getTime() - recibido > VEINTICUATRO_HORAS_MS
}

export interface PreguntaPendienteDeLaCartera {
  usuarioId: string
  paso: PasoCadena
  /** El jsonb tal cual llegó — la forma la decide quien la escribió, no esta función. */
  pregunta: unknown
}

/**
 * El `cuestionario_id` de una pregunta pendiente, si el jsonb lo trae — es el único dato
 * que `responder_como_staff` necesita para poder "responder como coach" desde la bandeja.
 * `pregunta` es `unknown` a propósito (ver arriba): esto no asume más forma que "si es un
 * objeto con esa clave como texto no vacío, úsala", y `undefined` en cualquier otro caso
 * (string suelto, número, objeto sin esa clave...) — nunca inventa un id que no llegó.
 */
export function cuestionarioIdDePregunta(pregunta: unknown): string | undefined {
  if (typeof pregunta !== 'object' || pregunta === null) return undefined
  const valor = (pregunta as Record<string, unknown>).cuestionario_id
  return typeof valor === 'string' && valor.length > 0 ? valor : undefined
}

/**
 * El texto legible de una pregunta pendiente: si el jsonb trae `texto` o `pregunta` como
 * string, se usa tal cual; si no, se cae al `JSON.stringify` que ya usaba la bandeja antes
 * de esto, para no perder información sobre una forma que no se reconoce.
 */
export function textoDePregunta(pregunta: unknown): string {
  if (typeof pregunta === 'string') return pregunta
  if (typeof pregunta === 'object' && pregunta !== null) {
    const obj = pregunta as Record<string, unknown>
    if (typeof obj.texto === 'string') return obj.texto
    if (typeof obj.pregunta === 'string') return obj.pregunta
  }
  return JSON.stringify(pregunta, null, 2)
}

/**
 * Aplana `preguntas_pendientes` de la última semana de cada persona en una sola bandeja,
 * ordenada por persona y luego por paso. No asume ninguna forma del jsonb de cada
 * pregunta (texto, objeto…): eso lo decide quien la pinta.
 */
export function bandejaDePreguntas(filas: readonly FilaTableroAgentes[]): PreguntaPendienteDeLaCartera[] {
  const bandeja: PreguntaPendienteDeLaCartera[] = []
  for (const fila of filas) {
    for (const paso of PASOS) {
      const evento = fila.pasos[paso]
      if (!evento) continue
      for (const pregunta of evento.preguntasPendientes) {
        bandeja.push({ usuarioId: fila.usuarioId, paso, pregunta })
      }
    }
  }
  return bandeja
}
