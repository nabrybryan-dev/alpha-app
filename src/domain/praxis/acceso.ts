import type { Rol } from '../types'

/**
 * Quién puede ver la pantalla de Praxis.
 *
 * Praxis entró en la app el 29-sep-2026 como excepción firmada por Bryan («Sí, y que
 * quede publicado»). Lo que se publicó es el DISEÑO: los datos que enseña son de ejemplo y
 * su cerebro —el registrador y la voz— todavía no está desplegado. Un asesorado que la
 * abriera vería un check-in inventado con pinta de ser el suyo.
 *
 * Por eso son dos llaves y no una: el rol de staff, que es el mismo criterio que
 * `public.es_staff()` en la base (migración 0006), y un interruptor para asesorados que
 * nace apagado.
 */

/**
 * El interruptor. Se enciende SOLO cuando Praxis lea datos reales de la persona y su
 * cerebro esté desplegado; encenderlo antes le enseña datos falsos a un cliente. Cambiarlo
 * es un cambio de código, con su PR, a propósito: no hay forma de abrirlo desde fuera.
 */
export const PRAXIS_ABIERTA_A_ASESORADOS = false

/** Coach y nutricionista: lo mismo que `es_staff()` decide en la capa de datos. */
export function esStaff(rol: Rol): boolean {
  return rol === 'coach' || rol === 'nutricionista'
}

export function puedeVerPraxis(rol: Rol, abiertaAAsesorados: boolean = PRAXIS_ABIERTA_A_ASESORADOS): boolean {
  return esStaff(rol) || abiertaAAsesorados
}
