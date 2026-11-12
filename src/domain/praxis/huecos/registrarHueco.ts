// Rutas con «.ts»: este módulo lo importa la Edge Function `praxis-charla` (Deno).
import { MAX_FRASE_HUECO, type Hueco } from '../charla/hueco.ts'

/**
 * Cola de huecos (migración 0180, NO aplicada): el upsert de un hueco ya normalizado. PURO: no escribe nada, devuelve la fila.
 * Una fila por `tema_clave`. Si el tema ya existe, `conteo` sube en uno, se conservan la frase de ejemplo y `primera_vez`, y
 * `ultima_vez` se actualiza. La fila NO lleva dato de persona: solo los seis campos de la tabla (sin `id`, que pone la base).
 */
export const ESTADOS_HUECO = ['nuevo', 'agrupado', 'en_investigacion', 'ficha_creada', 'descartado', 'a_firma_salud'] as const
export type EstadoHueco = (typeof ESTADOS_HUECO)[number]

export interface FilaHueco {
  tema_clave: string
  frase_limpia: string
  conteo: number
  primera_vez: string
  ultima_vez: string
  estado: EstadoHueco
}

/** Lo que ya hay en la tabla para ese tema (lo mínimo para decidir el upsert). */
export type HuecoExistente = Pick<FilaHueco, 'tema_clave' | 'frase_limpia' | 'conteo' | 'primera_vez' | 'estado'>

/** Devuelve null si no hay nada que agrupar (clave o frase vacías: la frase quedó toda tapada por el limpiador). */
export function registrarHueco(hueco: Hueco, existente: HuecoExistente | null, ahora: Date): FilaHueco | null {
  const tema_clave = hueco.temaClave.trim()
  const frase_limpia = hueco.frase.replace(/\s+/g, ' ').trim().slice(0, MAX_FRASE_HUECO)
  if (!tema_clave || !frase_limpia) return null
  const marca = ahora.toISOString()
  if (!existente || existente.tema_clave !== tema_clave) {
    return { tema_clave, frase_limpia, conteo: 1, primera_vez: marca, ultima_vez: marca, estado: 'nuevo' }
  }
  return {
    tema_clave,
    frase_limpia: existente.frase_limpia,
    conteo: existente.conteo + 1,
    primera_vez: existente.primera_vez,
    ultima_vez: marca,
    estado: existente.estado === 'nuevo' ? 'agrupado' : existente.estado,
  }
}
