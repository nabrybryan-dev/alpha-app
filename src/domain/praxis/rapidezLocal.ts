/**
 * Interruptor de la rapidez local de Praxis (pedido del dueño, 11-nov-2026): con él encendido, la conversación
 * conectada (1) entiende órdenes de organizar y navegar y (2) contesta los saludos con el libreto local, sin modelo.
 *
 * NACE APAGADO y no se define en ningún archivo de entorno: encenderlo es un cambio de código, con su PR.
 * Nada de esto toca lo clínico: el filtro de riesgo y de salud corre SIEMPRE antes (`decidirTurno`), y una frase
 * marcada nunca navega, nunca organiza y nunca recibe el saludo local.
 */
export const PRAXIS_ORGANIZAR_NAVEGAR_Y_SALUDO_LOCAL = false

/**
 * Prueba de organizar por voz SOLO para las cuentas de Bryan (orden del dueño, 11-nov-2026: «dejas en mi usuario tal
 * cual lo verá un asesorado»). Son sus dos cuentas: la de coach y la de prueba con rol asesorado. Para ellas se enciende
 * organizar y navegar (no el saludo local), con el menú de un asesorado, y Hoy y la barra obedecen lo guardado (0179).
 * Para cualquier otra persona nada cambia. Vaciar esta lista apaga la prueba.
 */
export const CUENTAS_DE_PRUEBA_ORGANIZAR: ReadonlySet<string> = new Set([
  '28c3cfe8-13ef-4f3e-95cc-f23c4f260bce',
  '87f3c420-f2fb-4b5f-986c-95535bbac9dd',
])

export function organizarEncendidoPara(usuarioId: string, global: boolean = PRAXIS_ORGANIZAR_NAVEGAR_Y_SALUDO_LOCAL): boolean {
  return global || CUENTAS_DE_PRUEBA_ORGANIZAR.has(usuarioId)
}
