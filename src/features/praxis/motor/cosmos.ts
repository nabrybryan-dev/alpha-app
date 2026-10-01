import { $ } from './dom'
import { alDesmontar, escuchar, mq, raiz, reducido } from './entorno'
import { Escena, Tema } from './escena'
import { clamp, curvaDesliz } from './movimiento'

/**
 * El cosmos: un lienzo fijo detrás de todo. Estrellas en tres capas con paralaje, centelleo
 * y una nebulosa muy tenue. El centelleo va a 15 cuadros por segundo; en Bienestar se
 * duerme a los 12 s sin desplazamiento ni toque (queda el último cuadro) y despierta con
 * scroll o pointerdown. Con movimiento reducido o en la Quieta, un solo cuadro quieto.
 * Con la pestaña oculta, ni un cuadro.
 */
interface Estrella { x: number; y: number; capa: number; fase: number; vel: number; a: number; s: number; ci: number }

let cv: HTMLCanvasElement | null = null, ctx: CanvasRenderingContext2D | null = null
let W = 0, H = 0, k = 1, neb: HTMLCanvasElement | null = null, raf = 0, tim = 0, tAnt = 0, reloj = 0, tDib = 0, desp = 0, sucio = false, dormido = false, tActiv = 0, fin = false
/** Rectángulo de la columna de texto cuando la sala está abierta: las estrellas de ahí bajan a α ×.5 */
let columna: { x0: number; x1: number } | null = null
const estrellas: Estrella[] = []

function azar(sem: number): () => number {
  let s = sem >>> 0
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
function sembrar(): void {
  estrellas.length = 0
  const r = azar(20260929)
  for (let i = 0; i < 380; i++) {
    const q = r(), capa = q < 0.64 ? 0 : q < 0.92 ? 1 : 2, tinte = r()
    estrellas.push({ x: r(), y: r(), capa, fase: r() * 6.283, vel: 0.35 + r() * 1.5,
      a: capa === 0 ? 0.22 + r() * 0.3 : capa === 1 ? 0.4 + r() * 0.35 : 0.7 + r() * 0.3,
      s: capa === 0 ? 0.6 + r() * 0.5 : capa === 1 ? 0.9 + r() * 0.7 : 1.4 + r() * 1.1,
      ci: tinte < 0.12 ? 0 : tinte < 0.26 ? 1 : 2 }) // el color sale del tema: --lienzo-astros (cálida, azulada, neutra)
  }
}
const sinTransparencia = () => !!mq('(prefers-reduced-transparency: reduce)')?.matches
const contrasteAlto = () => !!mq('(prefers-contrast: more)')?.matches

/** Se pinta una vez por tamaño, a media resolución: es luz muy suave. Con menos transparencia se apaga. */
function nebulosa(): void {
  if (sinTransparencia()) { neb = null; return }
  const c = document.createElement('canvas'), s = 0.5
  c.width = Math.max(1, Math.round(W * s)); c.height = Math.max(1, Math.round(H * s))
  const g = c.getContext('2d')
  if (!g) { neb = null; return }
  g.scale(s, s)
  const T = Tema.v, NB = T.nebulosa, kn = T.nebulosaK
  g.fillStyle = 'rgb(' + T.cielo + ')'; g.fillRect(0, 0, W, H)
  const mancha = (x: number, y: number, r: number, col: string, a: number) => { a *= kn; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(' + col + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + col + ',0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2) }
  const M = Math.max(W, H)
  mancha(W * 0.88, H * 0.06, M * 0.55, NB[0], 0.07)
  mancha(W * 0.05, H * 0.5, M * 0.6, NB[1], 0.065)
  mancha(W * 0.65, H * 0.98, M * 0.5, NB[2], 0.055)
  const r = azar(7)
  for (let i = 0; i < 28; i++) { const u = r(); mancha(W * (u * 1.2 - 0.1), H * (0.15 + u * 0.7) + (r() - 0.5) * H * 0.14, M * (0.04 + r() * 0.1), r() < 0.5 ? NB[3] : NB[4], 0.018 + r() * 0.022) } // polvo: una banda diagonal
  neb = c
}
function vivo(): boolean { return !Escena.quietaActiva && !reducido() }
/** Durante un deslizamiento de la sala el scroll ya saltó y el contenido vuelve con transform: el paralaje usa el valor VISIBLE */
function despVisible(ahora: number): number { const dz = Escena.desliz; if (!dz) return desp; const p = clamp((ahora - dz.t0) / dz.dur, 0, 1); return desp - dz.desde * (1 - curvaDesliz(p)) }

function dibujar(t: number, amp: number): void {
  if (!ctx) return
  ctx.setTransform(k, 0, 0, k, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  if (neb) ctx.drawImage(neb, 0, 0, W, H); else { ctx.fillStyle = 'rgb(' + Tema.v.cielo + ')'; ctx.fillRect(0, 0, W, H) }
  const AS = Tema.v.astros, ka = Tema.v.astrosK
  const n = Math.min(estrellas.length, clamp(Math.round((W * H) / 2200), 110, 380))
  const mov = !reducido(), dsp = mov && !Escena.quietaActiva ? despVisible(performance.now()) : 0, par = [0.02, 0.06, 0.14]
  const suave = (sinTransparencia() || contrasteAlto() ? 0.5 : 1) * ka
  for (let i = 0; i < n; i++) {
    const e = estrellas[i]
    let y = (e.y * H - dsp * par[e.capa]) % H
    if (y < 0) y += H
    const x = e.x * W
    const quieta = e.a * 0.85, tw = mov ? e.a * (0.6 + 0.4 * Math.sin(t * e.vel + e.fase)) : quieta
    let a = quieta + (tw - quieta) * amp
    if (columna && x >= columna.x0 && x <= columna.x1) a *= 0.5
    a *= suave
    const ec = AS[e.ci] || AS[AS.length - 1]
    ctx.fillStyle = 'rgba(' + ec + ',' + a.toFixed(3) + ')'
    if (e.s < 1.2) ctx.fillRect(x, y, e.s, e.s)
    else {
      ctx.beginPath(); ctx.arc(x, y, e.s * 0.6, 0, 6.2832); ctx.fill()
      if (e.capa === 2 && e.s > 2) { ctx.fillStyle = 'rgba(' + ec + ',' + (a * 0.22).toFixed(3) + ')'; ctx.fillRect(x - e.s * 3, y - 0.3, e.s * 6, 0.6); ctx.fillRect(x - 0.3, y - e.s * 3, 0.6, e.s * 6) }
    }
  }
}
function cuadro(ahora: number): void {
  raf = 0
  if (document.hidden || !cv) return // pestaña oculta: ni un cuadro
  const amp = Escena.quietaAmp(ahora)
  const anima = vivo() || (Escena.quietaActiva && amp > 0 && !reducido())
  if (anima && ahora - tDib >= 1000 / 15 - 3) { reloj += clamp((ahora - tAnt) / 1000, 0, 0.1); tAnt = ahora; tDib = ahora; dibujar(reloj, amp); sucio = false }
  else if (sucio && ahora - tDib >= 33) { tDib = ahora; dibujar(reloj, amp); sucio = false } // al desplazar: redibujo inmediato con tope de 30 fps
  if (Escena.desliz) sucio = true // mientras la sala se desliza, el paralaje sigue el valor visible (30 fps)
  if (Escena.quietaActiva && amp <= 0 && !fin) { fin = true; dibujar(reloj, 0) }
  if (!Escena.quietaActiva && !Escena.sala && ahora - tActiv > 12000) { dormido = true; return } // Bienestar se duerme: queda el último cuadro
  if (sucio) pedir()
  else if (anima) pedirEn(1000 / 15 - 3 - 8 - (performance.now() - tDib)) // el centelleo va a 15 fps: el cuadro se pide justo antes de tocar
}
function pedir(): void { if (!raf && cv && !document.hidden && !dormido) { clearTimeout(tim); tim = 0; raf = requestAnimationFrame(cuadro) } }
function pedirEn(ms: number): void { if (raf || tim || !cv || document.hidden || dormido) return; tim = window.setTimeout(() => { tim = 0; pedir() }, Math.max(0, ms)) }
function despertar(): void { tActiv = performance.now(); tAnt = tActiv; if (dormido) dormido = false; pedir() }
function ajustarColumna(): void { columna = Escena.sala ? { x0: Math.max(0, (W - 460) / 2), x1: Math.min(W, (W + 460) / 2) } : null }
function medir(): void {
  if (!cv) return
  W = Math.max(1, cv.clientWidth || window.innerWidth); H = Math.max(1, cv.clientHeight || window.innerHeight); k = Escena.dpr
  cv.width = Math.round(W * k); cv.height = Math.round(H * k)
  nebulosa(); ajustarColumna(); dibujar(reloj, Escena.quietaAmp(performance.now()))
}
function mover(): void {
  const sc = raiz().querySelector('#salaCuerpo')
  desp = (window.scrollY || 0) + (sc ? sc.scrollTop : 0); sucio = true; tActiv = performance.now()
  if (dormido) dormido = false
  if (vivo() || !reducido()) pedir()
}
function detener(): void { if (raf) { cancelAnimationFrame(raf); raf = 0 } clearTimeout(tim); tim = 0 }

export const Cosmos = {
  iniciar(canvas: HTMLCanvasElement): void {
    detener()
    cv = canvas; ctx = cv.getContext('2d')
    W = 0; H = 0; neb = null; reloj = 0; tDib = 0; desp = 0; sucio = false; dormido = false; fin = false; columna = null
    alDesmontar(() => { detener(); cv = null; ctx = null; neb = null })
    if (!ctx) { cv = null; return }
    sembrar(); tActiv = performance.now(); tAnt = tActiv; medir(); pedir()
    escuchar(window, 'scroll', mover, { passive: true })
    escuchar(document, 'pointerdown', () => { tActiv = performance.now(); if (dormido) despertar() }, { passive: true, capture: true })
    escuchar($('#salaCuerpo'), 'scroll', mover, { passive: true })
    escuchar(document, 'visibilitychange', () => {
      if (!document.hidden) { tAnt = performance.now(); tActiv = tAnt; dormido = false; dibujar(reloj, Escena.quietaAmp(tAnt)); pedir() }
      else detener()
    })
  },
  medir, despertar,
  tema(): void { if (!cv) return; nebulosa(); fin = false; dibujar(reloj, Escena.quietaAmp(performance.now())); dormido = false; tActiv = performance.now(); pedir() },
  cambio(): void { fin = false; sucio = true; dibujar(reloj, Escena.quietaAmp(performance.now())); dormido = false; pedir() },
  sala(b: boolean): void { Escena.sala = !!b; ajustarColumna(); tActiv = performance.now(); dormido = false; dibujar(reloj, Escena.quietaAmp(performance.now())); pedir() },
  lienzo(): HTMLCanvasElement | null { return cv },
  ancho(): number { return W },
}
