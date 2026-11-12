/**
 * Interruptor de la rapidez local de Praxis (pedido del dueño, 11-nov-2026): con él encendido, la conversación
 * conectada (1) entiende órdenes de organizar y navegar y (2) contesta los saludos con el libreto local, sin modelo.
 *
 * NACE APAGADO y no se define en ningún archivo de entorno: encenderlo es un cambio de código, con su PR.
 * Nada de esto toca lo clínico: el filtro de riesgo y de salud corre SIEMPRE antes (`decidirTurno`), y una frase
 * marcada nunca navega, nunca organiza y nunca recibe el saludo local.
 */
export const PRAXIS_ORGANIZAR_NAVEGAR_Y_SALUDO_LOCAL = false
