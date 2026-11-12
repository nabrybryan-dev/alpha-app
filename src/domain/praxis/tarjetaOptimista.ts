/**
 * La TARJETA OPTIMISTA de Praxis: máquina de estados PURA (propuesta F de
 * `docs/specs/2026-11-11-velocidad-de-praxis-diseno.md`, rama `spec/praxis-velocidad`).
 *
 * Hoy el cliente espera la respuesta completa del servidor (registrador + lector de riesgo con modelo,
 * p50 ~1,1 s) antes de pintar la tarjeta del registro propuesto. Con la bandera encendida, si el cliente
 * ya puede armar una propuesta local pinta la tarjeta AL INSTANTE con «Guardar» BLOQUEADO y «revisando…».
 * Se desbloquea solo cuando el servidor confirma que el riesgo NO marcó.
 *
 * REGLA DE ORO (no se negocia): el SERVIDOR sigue decidiendo y el cliente nunca guarda por su cuenta.
 * «Guardar» solo existe en `confirmada`. El único efecto que guarda (`pedir_guardado`) solo sale de un
 * `toque_guardar` hecho EN `confirmada`, y `confirmada` solo se alcanza desde `optimista_bloqueada` con
 * un `confirmacion_servidor`. Las pruebas recorren TODAS las secuencias de hasta 5 eventos para comprobarlo.
 *
 * ESTADOS
 *   sin_tarjeta          nada que mostrar (inicio, o la persona siguió con otra cosa, o se guardó).
 *   optimista_bloqueada  tarjeta local visible, «Guardar» deshabilitado, «revisando…». Corre un tope (8 s).
 *   confirmada           el servidor confirmó sin marca de riesgo y la propuesta COINCIDE: «Guardar» existe.
 *   retirada_por_riesgo  el riesgo marcó (antes o después): tarjeta fuera, camino de seguridad de siempre.
 *   retirada_por_error   error, red caída, tope vencido o propuesta del servidor distinta: tarjeta fuera,
 *                        camino de siempre (lo que ocurre sin la bandera: se espera al servidor).
 *
 * CARRERAS (qué pasa en cada una)
 *   - Riesgo que marca DESPUÉS de mostrar la tarjeta: en `optimista_bloqueada` o `confirmada` retira de
 *     inmediato (`retirar_tarjeta` + `mostrar_camino_seguro`). El riesgo, en cualquier estado y con
 *     cualquier mensajeId, termina en `retirada_por_riesgo`: una urgencia no caduca, ni siquiera si la
 *     marca es de una frase anterior.
 *   - Riesgo con «Guardar» ya pedido: la petición en vuelo no se puede recoger desde aquí; el servidor es
 *     quien la valida al guardar. La tarjeta se retira igual y el resultado del guardado se ignora.
 *   - Red caída / error del servidor: `retirada_por_error` y camino de siempre. Nada se guarda.
 *   - Respuesta tardía: pasado el tope (`tic`) pasa a `retirada_por_error` (motivo `tope`). Una confirmación
 *     que llegue después NO resucita la tarjeta optimista; la trata el camino de siempre (que, si el
 *     servidor confirmó, pinta su tarjeta normal). Lo mismo con un mensajeId viejo: se ignora.
 *   - Propuesta del servidor distinta de la local (`coincide: false`): no se desbloquea un botón sobre algo
 *     que la persona no vio; `retirada_por_error` (motivo `distinta`) y el camino de siempre pinta la del servidor.
 *   - La persona toca otra cosa (frase nueva, Descartar, cierra la sala, entra la Quieta): `sin_tarjeta`
 *     y `retirar_tarjeta`. Respuestas posteriores de esa frase se ignoran (el mensajeId ya no coincide).
 *   - Doble toque en «Guardar»: solo el primero emite `pedir_guardado`; el segundo se ignora. Si el guardado
 *     falla, vuelve a `confirmada` con «Guardar» disponible; si sale bien, `sin_tarjeta`.
 *   - Propuesta local nueva con otra tarjeta visible: reemplaza (retira la anterior, bloquea la nueva).
 *
 * Detrás de `TARJETA_OPTIMISTA` (apagada). El cliente de Praxis aún NO la usa: ver el reporte de la rama.
 */

/** APAGADA por defecto. No va en ningún archivo de entorno: encenderla es un cambio de código con su PR. */
export const TARJETA_OPTIMISTA = false

/** Cuánto se espera al servidor con la tarjeta bloqueada antes de retirarla. */
export const TOPE_TARJETA_OPTIMISTA_MS = 8_000

export type MotivoRetiroPorError = 'error' | 'red' | 'tope' | 'distinta'

export type EstadoTarjeta =
  | { estado: 'sin_tarjeta' }
  | { estado: 'optimista_bloqueada'; mensajeId: string; desdeMs: number }
  | { estado: 'confirmada'; mensajeId: string; guardadoPedido: boolean }
  | { estado: 'retirada_por_riesgo' }
  | { estado: 'retirada_por_error'; motivo: MotivoRetiroPorError }

export type NombreEstado = EstadoTarjeta['estado']

export type EventoTarjeta =
  | { tipo: 'propuesta_local'; mensajeId: string; ahoraMs: number }
  | { tipo: 'confirmacion_servidor'; mensajeId: string; coincide: boolean }
  | { tipo: 'riesgo_marco'; mensajeId?: string }
  | { tipo: 'error_servidor'; mensajeId: string; motivo: 'error' | 'red' }
  | { tipo: 'tic'; ahoraMs: number }
  | { tipo: 'persona_siguio' }
  | { tipo: 'toque_guardar' }
  | { tipo: 'guardado_terminado'; ok: boolean }

export type EfectoTarjeta =
  | 'mostrar_tarjeta_bloqueada'
  | 'desbloquear_guardar'
  | 'retirar_tarjeta'
  | 'mostrar_camino_seguro'
  | 'mostrar_camino_de_siempre'
  | 'pedir_guardado'

export interface Transicion {
  estado: EstadoTarjeta
  efectos: EfectoTarjeta[]
}

export const ESTADO_INICIAL: EstadoTarjeta = { estado: 'sin_tarjeta' }

const quieto = (e: EstadoTarjeta): Transicion => ({ estado: e, efectos: [] })

/** ¿Hay una tarjeta optimista pintada (bloqueada o confirmada)? */
export function hayTarjeta(e: EstadoTarjeta): boolean {
  return e.estado === 'optimista_bloqueada' || e.estado === 'confirmada'
}

/** ¿«Guardar» existe y se puede tocar? Solo en `confirmada` y sin guardado ya pedido. */
export function guardarDisponible(e: EstadoTarjeta): boolean {
  return e.estado === 'confirmada' && !e.guardadoPedido
}

export function transicionar(e: EstadoTarjeta, ev: EventoTarjeta): Transicion {
  switch (ev.tipo) {
    case 'propuesta_local':
      return {
        estado: { estado: 'optimista_bloqueada', mensajeId: ev.mensajeId, desdeMs: ev.ahoraMs },
        efectos: [...(hayTarjeta(e) ? ['retirar_tarjeta' as const] : []), 'mostrar_tarjeta_bloqueada'],
      }

    case 'confirmacion_servidor':
      if (e.estado !== 'optimista_bloqueada' || e.mensajeId !== ev.mensajeId) return quieto(e) // tardía, vieja o ya retirada
      if (!ev.coincide) {
        return { estado: { estado: 'retirada_por_error', motivo: 'distinta' }, efectos: ['retirar_tarjeta', 'mostrar_camino_de_siempre'] }
      }
      return { estado: { estado: 'confirmada', mensajeId: e.mensajeId, guardadoPedido: false }, efectos: ['desbloquear_guardar'] }

    case 'riesgo_marco':
      // Siempre retira, en cualquier estado y con cualquier mensajeId: una urgencia no caduca.
      return {
        estado: { estado: 'retirada_por_riesgo' },
        efectos: [
          ...(hayTarjeta(e) ? ['retirar_tarjeta' as const] : []),
          ...(e.estado === 'retirada_por_riesgo' ? [] : ['mostrar_camino_seguro' as const]),
        ],
      }

    case 'error_servidor':
      if (e.estado !== 'optimista_bloqueada' || e.mensajeId !== ev.mensajeId) return quieto(e)
      return { estado: { estado: 'retirada_por_error', motivo: ev.motivo }, efectos: ['retirar_tarjeta', 'mostrar_camino_de_siempre'] }

    case 'tic':
      if (e.estado !== 'optimista_bloqueada' || ev.ahoraMs - e.desdeMs < TOPE_TARJETA_OPTIMISTA_MS) return quieto(e)
      return { estado: { estado: 'retirada_por_error', motivo: 'tope' }, efectos: ['retirar_tarjeta', 'mostrar_camino_de_siempre'] }

    case 'persona_siguio':
      return { estado: { estado: 'sin_tarjeta' }, efectos: hayTarjeta(e) ? ['retirar_tarjeta'] : [] }

    case 'toque_guardar':
      // Único camino a guardar. Fuera de `confirmada` el botón no existe; con el guardado ya pedido, el doble toque no hace nada.
      if (e.estado !== 'confirmada' || e.guardadoPedido) return quieto(e)
      return { estado: { ...e, guardadoPedido: true }, efectos: ['pedir_guardado'] }

    case 'guardado_terminado':
      if (e.estado !== 'confirmada' || !e.guardadoPedido) return quieto(e) // la tarjeta ya se retiró: el resultado se ignora
      return ev.ok
        ? { estado: { estado: 'sin_tarjeta' }, efectos: ['retirar_tarjeta'] }
        : { estado: { ...e, guardadoPedido: false }, efectos: [] }
  }
}
