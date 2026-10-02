import { movimientoReducido } from '../../../components/ui/movimientoReducido'

/**
 * El entorno de la escena: dónde está montada, en qué trato habla y qué hay que soltar al
 * desmontar.
 *
 * La maqueta era una página entera y hablaba con `document`. Aquí la escena vive DENTRO de
 * la app: todo se busca bajo su raíz (`.praxis`) y cada oyente que se cuelga de `window` o
 * de `document` queda apuntado para quitarlo al salir de la ruta.
 */
export type Trato = 'tu' | 'usted'

const ctx = { raiz: null as HTMLElement | null, trato: 'tu' as Trato, movSuave: false, vivo: false, prefijo: 'praxis.' }
let limpiezas: (() => void)[] = []

/**
 * `espacio` es de quién es lo que se guarda en este navegador. Conectada va el id de la
 * persona: sus permisos y el estado de su día no los hereda quien entre después en el mismo
 * teléfono. Sin espacio (la escena de ejemplo) las claves son las de la maqueta.
 */
export function fijarEntorno(raiz: HTMLElement, trato: Trato, espacio: string | null = null): void {
  ctx.raiz = raiz; ctx.trato = trato; ctx.vivo = true
  ctx.prefijo = espacio ? `praxis.u.${espacio}.` : 'praxis.'
  ctx.movSuave = !!leer('movSuave', false)
  aplicarMovSuave()
}
/** La raíz de la escena. Tras desmontar sigue apuntando al árbol suelto: un temporizador rezagado escribe ahí sin romper nada. */
export function raiz(): HTMLElement { return ctx.raiz as HTMLElement }
export function montado(): boolean { return ctx.vivo }

/** Trato: tú o usted, según lo que la persona eligió (biblia de voz §2.3). Nunca se mezclan en un mismo mensaje. */
export function tu(t: string, u: string): string { return ctx.trato === 'usted' ? u : t }
export function trato(): Trato { return ctx.trato }

/** El ajuste propio «Movimiento suave» (Tus permisos): lleva al mismo camino que la preferencia del sistema. */
export function movSuave(): boolean { return ctx.movSuave }
export function fijarMovSuave(b: boolean): void { ctx.movSuave = b; guardar('movSuave', b); aplicarMovSuave() }
function aplicarMovSuave(): void { if (ctx.raiz) ctx.raiz.toggleAttribute('data-mov-suave', ctx.movSuave) }
export function reducido(): boolean { return movimientoReducido() || ctx.movSuave }

export function guardar(k: string, v: unknown): void { try { localStorage.setItem(ctx.prefijo + k, JSON.stringify(v)) } catch { /* sin almacenamiento: seguimos */ } }
export function leer<T>(k: string, def: T): T { try { const v = localStorage.getItem(ctx.prefijo + k); return v == null ? def : (JSON.parse(v) as T) } catch { return def } }
export function borrarClave(k: string): void { try { localStorage.removeItem(ctx.prefijo + k) } catch { /* nada */ } }

export function tieneAnimate(): boolean { return typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function' }

export function mq(q: string): MediaQueryList | null { try { return typeof window.matchMedia === 'function' ? window.matchMedia(q) : null } catch { return null } }
/** Safari antiguo solo tiene addListener. */
export function escuchaMQ(m: MediaQueryList | null, fn: () => void): void {
  if (!m) return
  if (typeof m.addEventListener === 'function') { m.addEventListener('change', fn); alDesmontar(() => m.removeEventListener('change', fn)); return }
  if (typeof m.addListener === 'function') { m.addListener(fn); alDesmontar(() => m.removeListener(fn)) }
}

export function alDesmontar(fn: () => void): void { limpiezas.push(fn) }
/** Un oyente fuera de la raíz (window, document): se quita solo al desmontar. */
export function escuchar<E extends Event = Event>(destino: EventTarget, tipo: string, fn: (e: E) => void, opciones?: AddEventListenerOptions): void {
  const oyente = fn as EventListener
  destino.addEventListener(tipo, oyente, opciones)
  alDesmontar(() => destino.removeEventListener(tipo, oyente, opciones))
}
export function limpiarEntorno(): void {
  ctx.vivo = false
  const l = limpiezas
  limpiezas = []
  l.forEach((fn) => { try { fn() } catch { /* nada */ } })
}

export function vibrar(): void {
  try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.isActive)) navigator.vibrate(8) } catch { /* iOS no vibra */ }
}
