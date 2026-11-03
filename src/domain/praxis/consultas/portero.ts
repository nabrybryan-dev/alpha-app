/**
 * Consultas del equipo a Praxis contestadas con una ficha del Centro de Respuestas (decisión de Bryan,
 * 25-oct-2026: «Praxis, solo equipo»). Hasta ahora toda consulta recibía «Eso lo decide Bryan…».
 *
 * El portero es un servicio aparte (estudiante e5 en camilin; n-gramas en el portátil) que solo devuelve
 * QUÉ ficha es y con cuánta seguridad: `atender` (una ficha), `aclarar` (sus 3 primeras) o `ninguna`.
 * Medido en TAXONOMIA-TEMAS-PRAXIS-20261023.md §6.20 (examen v2: cobertura 74,4 %, acierto 94,7 %).
 *
 * Reglas que esta capa no suelta:
 *   - Solo se muestran `respuesta_directa` y `senal_alarma`: son las dos partes que `ficha.ts` prohíbe
 *     llevar ranuras, así que nunca sale un {{hueco}} ni un dato de la persona.
 *   - Una ficha con `bandera_salud` NO se contesta aquí: la consulta sigue al coach como siempre.
 *   - Cualquier respuesta rara del portero, o una ficha que no está publicada, deja la consulta como antes.
 *     Esta capa nunca empeora lo que había: o contesta con una ficha, o devuelve null.
 */

export type DecisionPortero = 'atender' | 'aclarar' | 'ninguna'

export interface LecturaPortero {
  decision: DecisionPortero
  ficha: string
  tresPrimeras: string[]
}

export interface FichaParaPraxis {
  id: string
  titulo: string
  bandera_salud: boolean
  cuerpo: { respuesta_directa?: unknown; senal_alarma?: unknown } | null
}

export interface RespuestaDeConsulta {
  respuesta: string
  nota: string
  fichas: string[]
}

const ID = /^[a-z0-9-]{1,80}$/

/** Valida lo que devolvió el portero. Cualquier forma inesperada → null (la consulta sigue como antes). */
export function leerPortero(x: unknown): LecturaPortero | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  if (o.decision !== 'atender' && o.decision !== 'aclarar' && o.decision !== 'ninguna') return null
  if (typeof o.ficha !== 'string' || !ID.test(o.ficha)) return null
  const tres = Array.isArray(o.tres_primeras)
    ? o.tres_primeras
        .map((t) => (t && typeof t === 'object' ? (t as Record<string, unknown>).ficha : null))
        .filter((f): f is string => typeof f === 'string' && ID.test(f))
        .slice(0, 3)
    : []
  return { decision: o.decision, ficha: o.ficha, tresPrimeras: tres }
}

/** Ids que hay que leer de `fichas_respuesta` para contestar esta lectura (ninguno si es `ninguna`). */
export function fichasNecesarias(l: LecturaPortero): string[] {
  if (l.decision === 'atender') return [l.ficha]
  if (l.decision === 'aclarar') return [...new Set(l.tresPrimeras)]
  return []
}

function limpio(x: unknown): string {
  return typeof x === 'string' ? x.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim() : ''
}

function contestable(f: FichaParaPraxis | undefined): f is FichaParaPraxis {
  return !!f && f.bandera_salud !== true && limpio(f.cuerpo?.respuesta_directa) !== ''
}

export function respuestaDeConsulta(l: LecturaPortero, fichas: ReadonlyMap<string, FichaParaPraxis>): RespuestaDeConsulta | null {
  if (l.decision === 'atender') {
    const f = fichas.get(l.ficha)
    if (!contestable(f)) return null
    const alarma = limpio(f.cuerpo?.senal_alarma)
    return {
      respuesta: alarma ? `${limpio(f.cuerpo?.respuesta_directa)}\n\n${alarma}` : limpio(f.cuerpo?.respuesta_directa),
      nota: `Praxis contestó la consulta con la ficha ${f.id} (portero)`,
      fichas: [f.id],
    }
  }
  if (l.decision === 'aclarar') {
    const opciones = l.tresPrimeras.map((id) => fichas.get(id)).filter(contestable)
    if (opciones.length < 2) return null
    const lista = opciones.map((f, i) => `${i + 1}) ${limpio(f.titulo)}`).join('\n')
    return {
      respuesta: `¿Tu pregunta es alguna de estas?\n${lista}\nEscríbeme cuál y te contesto. Si no es ninguna, le paso la pregunta a Bryan.`,
      nota: `Praxis ofreció opciones a la consulta: ${opciones.map((f) => f.id).join(', ')} (portero)`,
      fichas: opciones.map((f) => f.id),
    }
  }
  return null
}
