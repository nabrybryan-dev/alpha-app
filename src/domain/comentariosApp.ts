/**
 * Comentarios de la app (migración 0095; habilidad `comentarios-app`). Lógica pura.
 *
 * La persona elige el TIPO (algo falla · una idea · no entiendo) y escribe; la base guarda la
 * pantalla (solo la ruta) y el estado. Lo que la persona ve de su comentario es solo el
 * estado público: RECIBIDO, EN CONTRATO o ARREGLADO.
 */

export const TIPOS_COMENTARIO = ['falla', 'idea', 'no_entiendo'] as const
export type TipoComentario = (typeof TIPOS_COMENTARIO)[number]

export const NOMBRE_TIPO: Record<TipoComentario, string> = {
  falla: 'Algo falla',
  idea: 'Una idea',
  no_entiendo: 'No entiendo',
}

export const ESTADOS_COMENTARIO = ['nuevo', 'en_contrato', 'arreglado'] as const
export type EstadoComentario = (typeof ESTADOS_COMENTARIO)[number]

/** Lo que ve quien comentó (esquema §5): nunca el estado interno del triaje. */
export const ESTADO_PUBLICO: Record<EstadoComentario, string> = {
  nuevo: 'RECIBIDO',
  en_contrato: 'EN CONTRATO',
  arreglado: 'ARREGLADO',
}

/** El largo máximo, el mismo del `check` de la base. */
export const LARGO_MAXIMO_COMENTARIO = 500

/**
 * Se muestra SIEMPRE, antes del botón de enviar (CA8 del contrato de comentarios): una
 * pregunta de salud no es un comentario de la app y una urgencia no espera respuesta.
 */
export const AVISO_SALUD = 'Esto no es para salud ni urgencias: escríbele a tu coach. En una urgencia, llama al 123.'

export function esTipoComentario(x: string): x is TipoComentario {
  return (TIPOS_COMENTARIO as readonly string[]).includes(x)
}
export function esEstadoComentario(x: string): x is EstadoComentario {
  return (ESTADOS_COMENTARIO as readonly string[]).includes(x)
}

/** Solo `location.pathname`: sin query ni fragmento (que pueden traer identificadores). */
export function soloLaRuta(ruta: string): string {
  const limpia = ruta.split('#')[0].split('?')[0]
  return limpia.startsWith('/') ? limpia.slice(0, 200) : 'desconocida'
}
