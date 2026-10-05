/**
 * Movimiento de Praxis: duraciones, curvas y muelles.
 *
 * Son los tokens de `src/styles/tokens.css` copiados como literales, porque
 * `el.animate()` y el lienzo no resuelven `var()`. Si cambia uno allí, cambia aquí.
 * Regla de la casa: nada que se repita en una sesión pasa de 360 ms; solo lo raro (abrir
 * la sala, el eco, la Quieta) llega a 520 ms o más. Nunca ease-in. Nunca transition: all.
 */
export const DUR = {
  toque: 160, base: 240, panel: 360, escena: 520, // --dur-toque, --dur-base, --dur-panel, --dur-escena
  silaba: 170, anticipa: 120, relevo: 120, mantener: 700, // Praxis · escena
  piensaMin: 400, piensaVuelta: 900, eco: 1200, apagado: 1600, aliento: 10000,
} as const

/** --ease-salida, --ease-mov, --ease-cajon, --ease-rebote y --ease-desliz (el deslizamiento de la sala). */
export const EASE = {
  salida: 'cubic-bezier(0.23, 1, 0.32, 1)', mov: 'cubic-bezier(0.77, 0, 0.175, 1)',
  cajon: 'cubic-bezier(0.32, 0.72, 0, 1)', rebote: 'cubic-bezier(0.34, 1.2, 0.4, 1)',
  desliz: 'cubic-bezier(.37,0,.63,1)',
} as const

/** 8,3 ms por px como mínimo: el deslizamiento nunca pasa de 3,2 px por cuadro a 60 Hz. */
export const MS_POR_PX = 8.3

/** Exponenciales con nombre: lo que se suaviza y en cuánto tiempo (segundos). */
export const TAU = { color: 0.3, giro: 0.6, forma: 0.4, tension: 0.25, ataque: 0.04, suelta: 0.16, energia: 1.2 } as const

export interface Resorte { x: number; v: number }

/** Muelle sin dependencias. Empieza SIEMPRE desde el valor visible (x, v actuales). Subpasos de 1/120 s: estable a 30, 60 o 120 Hz. */
export function muelle(s: Resorte, objetivo: number, dt: number, respuesta = 0.4, amort = 1): Resorte {
  const w = (2 * Math.PI) / respuesta, k = w * w, c = 2 * amort * w
  for (let h = Math.min(dt, 0.1); h > 0; h -= 1 / 120) {
    const p = Math.min(h, 1 / 120)
    s.v += (-k * (s.x - objetivo) - c * s.v) * p
    s.x += s.v * p
  }
  return s
}

/** [respuesta, amortiguación] */
export type Muelle = readonly [number, number]
export const M_GEOMETRIA: Muelle = [0.4, 1]
export const M_BRILLO: Muelle = [0.3, 1]
export const M_ECO: Muelle = [0.5, 0.75]
export const M_TIRA: Muelle = [0.3, 1]

/** La curva de CSS resuelta a mano: el lienzo y el DOM leen la misma curva, así una cosa y otra llegan juntas. */
export function bezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const X = (t: number) => ((ax * t + bx) * t + cx) * t, Y = (t: number) => ((ay * t + by) * t + cy) * t, dX = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i++) { const e = X(t) - x; if (Math.abs(e) < 1e-5) return Y(t); const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= e / d }
    let lo = 0, hi = 1
    t = x
    for (let i = 0; i < 24; i++) { const e = X(t); if (Math.abs(e - x) < 1e-5) break; if (x > e) lo = t; else hi = t; t = (hi + lo) / 2 }
    return Y(t)
  }
}

export const curvaSalida = bezier(0.23, 1, 0.32, 1)
export const curvaCajon = bezier(0.32, 0.72, 0, 1)
export const curvaMov = bezier(0.77, 0, 0.175, 1)
export const curvaDesliz = bezier(0.37, 0, 0.63, 1)

export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v))
export const esperar = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
/** `undefined > 0` es falso en JS porque se vuelve NaN: esto hace lo mismo con tipos. */
export const num = (v: number | null | undefined): number => v ?? NaN
