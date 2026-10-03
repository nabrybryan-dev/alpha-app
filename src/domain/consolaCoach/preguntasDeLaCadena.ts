import type { RespuestaCoach } from '../../data/consola/respuestasCoach'
import type { PasoCadena } from '../../data/consola/cadenaCorridas'
import type { PreguntaPendienteDeLaCartera } from './tableroAgentes'

/**
 * Las preguntas que la cadena de agentes le deja al COACH (no al asesorado): el importador
 * (`tuberia/subir_a_consola.py` de cerebro-alpha) sube a `cadena_corridas.preguntas_pendientes`
 * cada línea de `para_el_coach` que trae un «¿…?», con esta forma:
 *
 *   { fuente: 'cadena', id: 'cp-<16 hex>', texto, paso, persona, usuario_id, corrida, fecha,
 *     opciones: string[] | null }
 *
 * `opciones` es `null` salvo que el paso las haya declarado: la consola nunca las inventa.
 * Las demás preguntas de la bandeja (el D8 del asesorado, o las que traen `cuestionario_id`) se
 * dejan tal cual para el flujo de siempre (`responder_como_staff`, que responde POR el asesorado).
 */
export interface PreguntaDeLaCadena {
  /** El `cp-…` estable: la clave de la respuesta guardada. */
  id: string
  texto: string
  /** A/B/C si el paso las declaró; `null` = respuesta libre. */
  opciones: string[] | null
  paso: PasoCadena
  usuarioId: string
  /** Cuándo se hizo la pregunta (la fecha del dato del paso), tal como llegó. */
  fecha: string | null
}

const ID_DE_LA_CADENA = /^cp-[0-9a-f]{16}$/

/** `null` si no es una pregunta de la cadena para el coach (nunca adivina una forma que no llegó). */
export function preguntaDeLaCadena(
  cruda: unknown,
  contexto: { usuarioId: string; paso: PasoCadena },
): PreguntaDeLaCadena | null {
  if (typeof cruda !== 'object' || cruda === null) return null
  const o = cruda as Record<string, unknown>
  if (o.fuente !== 'cadena') return null
  if (typeof o.id !== 'string' || !ID_DE_LA_CADENA.test(o.id)) return null
  if (typeof o.texto !== 'string' || o.texto.trim().length === 0) return null
  const opciones = Array.isArray(o.opciones)
    ? o.opciones.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : []
  return {
    id: o.id,
    texto: o.texto,
    opciones: opciones.length >= 2 ? opciones : null,
    paso: contexto.paso,
    usuarioId: contexto.usuarioId,
    fecha: typeof o.fecha === 'string' ? o.fecha : null,
  }
}

export interface BandejaRepartida {
  /** Las de la cadena que el coach todavía no contestó, más reciente primero, sin repetir `id`. */
  pendientes: PreguntaDeLaCadena[]
  /** Todo lo demás de la bandeja (D8, preguntas con cuestionario): el flujo de siempre. */
  otras: PreguntaPendienteDeLaCartera[]
}

/**
 * Separa la bandeja: las preguntas de la cadena para el coach (que salen ARRIBA) de las demás, y
 * quita de pendientes las que ya tienen respuesta guardada. Una pregunta con el mismo `id` en dos
 * eventos sale una vez.
 */
export function repartirBandeja(
  bandeja: readonly PreguntaPendienteDeLaCartera[],
  respuestas: readonly RespuestaCoach[],
): BandejaRepartida {
  const respondidas = new Set(respuestas.map((r) => r.idPregunta))
  const vistas = new Set<string>()
  const pendientes: PreguntaDeLaCadena[] = []
  const otras: PreguntaPendienteDeLaCartera[] = []
  for (const item of bandeja) {
    const p = preguntaDeLaCadena(item.pregunta, { usuarioId: item.usuarioId, paso: item.paso })
    if (!p) {
      otras.push(item)
      continue
    }
    if (respondidas.has(p.id) || vistas.has(p.id)) continue
    vistas.add(p.id)
    pendientes.push(p)
  }
  pendientes.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))
  return { pendientes, otras }
}

/**
 * Lo que se guarda: la opción elegida («A · 25 series») tal cual, y si además se escribió algo,
 * detrás («B · mantener — pero sin sentadilla»). Sin opción, solo lo escrito. Vacío = no hay respuesta.
 */
export function textoDeRespuesta(opcion: string | null, libre: string): string {
  const escrito = libre.trim()
  if (opcion && escrito) return `${opcion.trim()} — ${escrito}`
  return (opcion ?? escrito).trim()
}
