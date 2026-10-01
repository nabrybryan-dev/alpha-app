import type { Rol } from '../types'

/**
 * Quién puede ver la pantalla de Praxis.
 *
 * Praxis entró en la app el 29-sep-2026 como excepción firmada por Bryan («Sí, y que
 * quede publicado»), primero como DISEÑO con datos de ejemplo. Desde el 1-oct-2026 la
 * pantalla está CONECTADA: lee los datos reales de quien tiene la sesión y manda lo que se
 * escribe al registrador. Sigue siendo solo para el staff.
 *
 * Son dos llaves y no una: el rol de staff, que es el mismo criterio que
 * `public.es_staff()` en la base (migración 0006), y un interruptor para asesorados que
 * nace apagado.
 */

/**
 * El interruptor. Que la pantalla ya lea datos reales NO basta para encenderlo. Sigue
 * apagado, y lo que falta es de seguridad, no de pantalla:
 *
 *  - el filtro de riesgo es solo el diccionario (`riesgo.ts`). La decisión firmada es
 *    diccionario + modelo en cada mensaje, medido contra un examen que no haya visto; el
 *    diccionario solo alcanzó 47 % en las frases reservadas;
 *  - ante una señal de riesgo la pantalla se detiene, pero todavía NO le avisa a nadie;
 *  - los textos de la Quieta y las fichas clínicas esperan a un profesional de salud mental;
 *  - el consentimiento y el envío de texto a un proveedor de IA esperan al abogado (P8);
 *  - mientras solo la ve el equipo, tras una Quieta hay un botón para reabrir Praxis el
 *    mismo día (`bienestar.ts`): hay que quitarlo antes de abrir.
 *
 * Cambiarlo es un cambio de código, con su PR, a propósito: no hay forma de abrirlo desde fuera.
 */
export const PRAXIS_ABIERTA_A_ASESORADOS = false

/** Coach y nutricionista: lo mismo que `es_staff()` decide en la capa de datos. */
export function esStaff(rol: Rol): boolean {
  return rol === 'coach' || rol === 'nutricionista'
}

export function puedeVerPraxis(rol: Rol, abiertaAAsesorados: boolean = PRAXIS_ABIERTA_A_ASESORADOS): boolean {
  return esStaff(rol) || abiertaAAsesorados
}
