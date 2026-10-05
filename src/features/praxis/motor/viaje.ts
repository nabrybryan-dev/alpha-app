/**
 * El viaje a la velocidad de la luz: lo que le pasa al cielo mientras se mantiene presionado
 * el agujero para hablar (Bryan, 2-oct). Aquí vive SOLO el estado y las cuentas, sin pantalla:
 * `cosmos.ts` lo lee y lo dibuja; las pruebas lo recorren por tiempo.
 *
 *   escucha  → velocidad de 0 a `VEL_BASE` en `ARRANQUE_S` (curva suave, sin tirón).
 *   un resultado del reconocedor (el mismo pulso que ya rizaba las ondas) → sube un poco
 *     la velocidad, hasta `VEL_BASE + VEL_PULSO_MAX`, y la suelta en ~0,5 s.
 *   soltar   → frena con inercia: cae al cuadrado hasta 0 en `FRENADO_S`.
 *   movimiento reducido (sistema o «Movimiento suave») → velocidad 0 SIEMPRE; solo queda un
 *     leve aumento de brillo (`realce`).
 *
 * La velocidad `v` va de 0 (cielo en reposo) a 1 (todo el chorro). No toca audio: el pulso
 * lo da el texto que va llegando.
 */
export const ARRANQUE_S = 0.4
export const FRENADO_S = 0.6
export const VEL_BASE = 0.6
export const VEL_PULSO = 0.2
export const VEL_PULSO_MAX = 0.4
export const TAU_PULSO = 0.5
const TAU_SUBE = 0.12
/** Con movimiento reducido, cuánto más brillan las estrellas al escuchar (sin moverse). */
export const REALCE_REDUCIDO = 0.14

export interface Viaje {
  /** ¿Se está manteniendo presionado el agujero? */
  escucha: boolean
  /** Segundos desde el último cambio de fase (empezar o soltar). */
  t: number
  /** La velocidad que llevaba al cambiar de fase: de ahí arranca o frena, sin saltos. */
  desde: number
  /** Cuánto sumaron los resultados recientes del reconocedor. */
  impulso: number
  /** La velocidad objetivo suavizada mientras se escucha. */
  obj: number
  /** La velocidad de este instante, 0–1. */
  v: number
}

export function viajeNuevo(): Viaje { return { escucha: false, t: 0, desde: 0, impulso: 0, obj: 0, v: 0 } }

const suave = (p: number): number => p * p * (3 - 2 * p)

/** Empieza a escuchar. Si ya venía frenando, arranca desde la velocidad que llevaba. */
export function empezar(e: Viaje): void {
  if (e.escucha) return
  e.escucha = true; e.t = 0; e.desde = e.v; e.impulso = 0; e.obj = VEL_BASE
}
/** Suelta: frena con inercia desde la velocidad que llevaba. */
export function soltar(e: Viaje): void {
  if (!e.escucha) return
  e.escucha = false; e.t = 0; e.desde = e.v; e.impulso = 0
}
/** Llegó un resultado del reconocedor: la velocidad sube un poco. */
export function pulsar(e: Viaje): void {
  if (!e.escucha) return
  e.impulso = Math.min(VEL_PULSO_MAX, e.impulso + VEL_PULSO)
}
/** Corta todo de golpe (la Quieta, desmontar). */
export function detener(e: Viaje): void { Object.assign(e, viajeNuevo()) }

/** Avanza `dt` segundos y devuelve la velocidad 0–1. Con movimiento reducido es 0, siempre. */
export function avanzar(e: Viaje, dt: number, reducido: boolean): number {
  e.t += dt
  if (reducido) { e.v = 0; e.desde = 0; e.obj = 0; e.impulso = 0; return 0 }
  if (e.escucha) {
    e.impulso *= Math.exp(-dt / TAU_PULSO)
    const meta = Math.min(1, VEL_BASE + e.impulso)
    e.obj += (meta - e.obj) * (1 - Math.exp(-dt / TAU_SUBE))
    const p = suave(Math.min(1, e.t / ARRANQUE_S))
    e.v = e.desde + (e.obj - e.desde) * p
  } else {
    const p = Math.min(1, e.t / FRENADO_S)
    e.v = e.desde * (1 - p) * (1 - p)
  }
  return e.v
}

/** ¿Hay algo que dibujar o mover? Escuchando, o todavía frenando. */
export function activo(e: Viaje): boolean { return e.escucha || e.v > 0.002 }

/** Aumento de brillo con movimiento reducido: solo mientras se escucha, nada se mueve. */
export function realce(e: Viaje, reducido: boolean): number { return reducido && e.escucha ? REALCE_REDUCIDO : 0 }

/** Largo de un rayo en unidades de recorrido (0–1) según la velocidad: crece con ella. */
export function largoDelRayo(v: number): number { return v <= 0 ? 0 : 0.03 + 0.4 * v }
