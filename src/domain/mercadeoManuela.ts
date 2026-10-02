/**
 * Buzón de mercadeo de Manuela (migración 0096; habilidad `mercadeo-manuela`). Lógica pura.
 *
 * Claude le pregunta; ella responde y deja referencias (enlaces con https); de ahí sale una
 * REGLA con su estado. Una regla solo pasa a vigente con 3 referencias distintas de reel,
 * carrusel o historia destacada, con la firma del coach, y caduca a los 60 días.
 */

export const TIPOS_REFERENCIA = ['reel', 'carrusel', 'historia_destacada', 'curso', 'articulo', 'otro'] as const
export type TipoReferencia = (typeof TIPOS_REFERENCIA)[number]

export const NOMBRE_TIPO_REFERENCIA: Record<TipoReferencia, string> = {
  reel: 'Reel',
  carrusel: 'Carrusel',
  historia_destacada: 'Historia destacada',
  curso: 'Curso',
  articulo: 'Artículo',
  otro: 'Otro',
}

/** Las que cuentan para el mínimo de la regla; curso y artículo explican, no cuentan. */
export const TIPOS_QUE_CUENTAN: readonly TipoReferencia[] = ['reel', 'carrusel', 'historia_destacada']
export const REFERENCIAS_MINIMAS = 3
export const DIAS_DE_VIGENCIA = 60
export const MAXIMO_REFERENCIAS = 10

export const ESTADOS_REGLA = ['sin_regla', 'propuesta', 'vigente', 'suspendida', 'caducada', 'retirada', 'rechazada'] as const
export type EstadoRegla = (typeof ESTADOS_REGLA)[number]

export const NOMBRE_ESTADO_REGLA: Record<EstadoRegla, string> = {
  sin_regla: 'Sin regla',
  propuesta: 'Propuesta',
  vigente: 'Vigente',
  suspendida: 'Suspendida',
  caducada: 'Caducada',
  retirada: 'Retirada',
  rechazada: 'Rechazada',
}

export const ESTADOS_PREGUNTA = ['pendiente', 'respondida', 'caducada', 'descartada'] as const
export type EstadoPregunta = (typeof ESTADOS_PREGUNTA)[number]

export function esTipoReferencia(x: string): x is TipoReferencia {
  return (TIPOS_REFERENCIA as readonly string[]).includes(x)
}
export function esEstadoRegla(x: string): x is EstadoRegla {
  return (ESTADOS_REGLA as readonly string[]).includes(x)
}
export function esEstadoPregunta(x: string): x is EstadoPregunta {
  return (ESTADOS_PREGUNTA as readonly string[]).includes(x)
}

/** Solo `https://…` y sin espacios: lo mismo que el `check` de la base. */
export function urlValida(url: string): boolean {
  return /^https:\/\/[^\s]+$/.test(url) && url.length <= 500
}

/** Mismo criterio de la base para no contar dos veces un enlace: sin `?…`, `#…`, barra final ni `www.`. */
export function normalizarUrl(url: string): string {
  const sinCola = url.trim().split('#')[0].split('?')[0].replace(/\/+$/, '')
  const resto = sinCola.replace(/^https:\/\/(www\.)?/i, '')
  const host = resto.split('/')[0].toLowerCase()
  return `https://${host}${resto.slice(host.length)}`
}

export interface ReferenciaMinima {
  tipo: TipoReferencia
  urlNormalizada: string
}

/** Cuántos enlaces DISTINTOS de los tipos que cuentan hay (lo que exige la base para «vigente»). */
export function referenciasQueCuentan(refs: readonly ReferenciaMinima[]): number {
  return new Set(refs.filter((r) => TIPOS_QUE_CUENTAN.includes(r.tipo)).map((r) => r.urlNormalizada)).size
}

/**
 * El estado de la regla HOY: una `vigente` pasada de su fecha de revisión ya no vale y se
 * muestra como caducada, aunque la fila todavía diga vigente (esquema, C-09).
 */
export function reglaEfectiva(estado: EstadoRegla, revisarAntesDe: string | null, hoy: string): EstadoRegla {
  if (estado === 'vigente' && revisarAntesDe !== null && hoy > revisarAntesDe) return 'caducada'
  return estado
}

/** Una pregunta que sigue pendiente pero ya pasó su fecha no se puede responder. */
export function preguntaVencida(estado: EstadoPregunta, venceEn: string, hoy: string): boolean {
  return estado === 'caducada' || (estado === 'pendiente' && hoy > venceEn)
}

/**
 * La respuesta y las notas no admiten correos, @ ni teléfonos (contactos de otras personas):
 * la base los rechaza; esto avisa antes de enviar. Devuelve el motivo o null.
 */
export function contactoEnTexto(texto: string): string | null {
  if (texto.includes('@')) return 'un @ o un correo'
  if (/(^|[^0-9-])(\+?57[ -]?)?3[0-9]{2}[ -]?[0-9]{3}[ -]?[0-9]{4}([^0-9]|$)/.test(texto)) return 'un teléfono'
  return null
}
