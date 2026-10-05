/**
 * Hallazgos de la investigación de mercadeo con los que Manuela interactúa (migración 0103).
 *
 * El agente de mercadeo deja hallazgos (hook, loop, estructura, tendencia, gancho visual); Manuela
 * y Bryan los comentan; el agente responde y los fortalece. Lógica pura: sin React, sin red.
 *
 * Regla de oro (igual que el resto de Estrategias): lo que no viene, se dice FALTA; no se inventa.
 */

export const TIPOS_HALLAZGO = ['hook', 'loop', 'estructura', 'tendencia', 'gancho_visual'] as const
export type TipoHallazgo = (typeof TIPOS_HALLAZGO)[number]

/** De lo macro a lo micro: la tendencia primero, el gancho visual al final. */
export const ORDEN_TIPOS: readonly TipoHallazgo[] = ['tendencia', 'estructura', 'loop', 'hook', 'gancho_visual']

export const NOMBRE_TIPO_HALLAZGO: Record<TipoHallazgo, string> = {
  tendencia: 'Tendencias',
  estructura: 'Estructura de videos',
  loop: 'Loops',
  hook: 'Hooks (ganchos de texto)',
  gancho_visual: 'Ganchos visuales',
}

export const ESTADOS_HALLAZGO_M = ['nuevo', 'en_discusion', 'fortalecido', 'descartado'] as const
export type EstadoHallazgoM = (typeof ESTADOS_HALLAZGO_M)[number]

export const NOMBRE_ESTADO_HALLAZGO_M: Record<EstadoHallazgoM, string> = {
  nuevo: 'Nuevo',
  en_discusion: 'En discusión: espera al agente',
  fortalecido: 'Fortalecido por el agente',
  descartado: 'Descartado',
}

export const AUTORES = ['manuela', 'bryan', 'agente'] as const
export type Autor = (typeof AUTORES)[number]
export const NOMBRE_AUTOR: Record<Autor, string> = { manuela: 'Manuela', bryan: 'Bryan', agente: 'Agente de mercadeo' }

export const MAX_COMENTARIO = 1000

export const esTipoHallazgo = (x: string): x is TipoHallazgo => (TIPOS_HALLAZGO as readonly string[]).includes(x)
export const esEstadoHallazgoM = (x: string): x is EstadoHallazgoM => (ESTADOS_HALLAZGO_M as readonly string[]).includes(x)
export const esAutor = (x: string): x is Autor => (AUTORES as readonly string[]).includes(x)

export interface ComentarioHallazgo {
  id: string
  hallazgoId: string
  autor: Autor
  texto: string
  enRespuestaA: string | null
  creadoEn: string
}

export interface HallazgoMercadeo {
  id: string
  codigo: string
  tipo: TipoHallazgo
  titulo: string
  resumen: string
  fuenteNombre: string | null
  fuenteUrl: string | null
  fuenteFecha: string | null
  estado: EstadoHallazgoM
  comentarios: ComentarioHallazgo[]
}

/** Agrupa por tipo en el orden macro -> micro; un tipo sin hallazgos NO se esconde: sale vacío. */
export function agruparPorTipo(hallazgos: readonly HallazgoMercadeo[]): { tipo: TipoHallazgo; hallazgos: HallazgoMercadeo[] }[] {
  return ORDEN_TIPOS.map((tipo) => ({ tipo, hallazgos: hallazgos.filter((h) => h.tipo === tipo) }))
}

/** Comentarios de Manuela o Bryan a los que el agente todavía no contestó. */
export function comentariosSinRespuesta(h: HallazgoMercadeo): ComentarioHallazgo[] {
  const contestados = new Set(h.comentarios.flatMap((c) => (c.autor === 'agente' && c.enRespuestaA ? [c.enRespuestaA] : [])))
  return h.comentarios.filter((c) => c.autor !== 'agente' && !contestados.has(c.id))
}

/** Lo que falta para poder enviar un comentario (mismo criterio de la base), o null si está listo. */
export function faltaParaComentar(texto: string): string | null {
  const t = texto.trim()
  if (t === '') return 'Escribe tu comentario.'
  if (t.length > MAX_COMENTARIO) return `El comentario pasa de ${MAX_COMENTARIO} letras.`
  if (t.includes('@')) return 'Tu comentario trae un @ o un correo: aquí no van contactos de nadie.'
  if (/(^|[^0-9-])(\+?57[ -]?)?3[0-9]{2}[ -]?[0-9]{3}[ -]?[0-9]{4}([^0-9]|$)/.test(t)) {
    return 'Tu comentario trae un teléfono: aquí no van contactos de nadie.'
  }
  return null
}
