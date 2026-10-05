import { $ } from './dom'
import { alDesmontar, escuchar, mq, raiz, reducido } from './entorno'
import { Escena, Tema } from './escena'
import { clamp, curvaDesliz } from './movimiento'
import * as Viaje from './viaje'

/**
 * El cosmos: un lienzo fijo detrás de todo. Estrellas en tres capas con paralaje, centelleo
 * y una nebulosa muy tenue. El centelleo va a 15 cuadros por segundo; en Bienestar se
 * duerme a los 12 s sin desplazamiento ni toque (queda el último cuadro) y despierta con
 * scroll o pointerdown. Con movimiento reducido o en la Quieta, un solo cuadro quieto.
 * Con la pestaña oculta, ni un cuadro.
 *
 * El viaje (`viaje.ts`): mientras se mantiene presionado el agujero, el cielo salta al
 * hiperespacio. Las estrellas se abren desde el agujero hacia los bordes (un empuje radial que
 * crece con la velocidad), atenúan, y de cada una de las primeras `RAYOS` sale un rayo plata
 * cuyo largo crece con la velocidad. Todos los rayos van en dos trazos (uno tenue, uno vivo),
 * así que el costo es casi plano. Al soltar frena con inercia y todo vuelve a su sitio sin salto
 * (los rayos miden 0 en reposo y el empuje es proporcional a la velocidad). Con movimiento
 * reducido: ni rayos ni desplazamiento, solo un leve aumento de brillo.
 */
interface Estrella { x: number; y: number; capa: number; fase: number; vel: number; a: number; s: number; ci: number }

let cv: HTMLCanvasElement | null = null, ctx: CanvasRenderingContext2D | null = null
let W = 0, H = 0, k = 1, neb: HTMLCanvasElement | null = null, raf = 0, tim = 0, tAnt = 0, reloj = 0, tDib = 0, desp = 0, sucio = false, dormido = false, tActiv = 0, fin = false
/** Rectángulo de la columna de texto cuando la sala está abierta: las estrellas de ahí bajan a α ×.5 */
let columna: { x0: number; x1: number } | null = null
const estrellas: Estrella[] = []
/** Rayos del viaje: uno por cada tercera estrella (las mismas direcciones del cielo), con su fase y su velocidad propia. */
const RAYOS = 120
const rayoFase = new Float32Array(RAYOS), rayoVel = new Float32Array(RAYOS)
const viaje = Viaje.viajeNuevo()
let centroViaje: (() => { x: number; y: number; r: number } | null) | null = null
let viajeLigero = false, nCostoV = 0
const costoV = new Float32Array(60)

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
  const q = azar(20261002)
  for (let i = 0; i < RAYOS; i++) { rayoFase[i] = q(); rayoVel[i] = 0.6 + q() * 0.8 }
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
  const v = mov && !Escena.quietaActiva ? viaje.v : 0, real = 1 + Viaje.realce(viaje, !mov)
  const c = v > 0 ? centro() : null
  const abre = viajeLigero ? 0 : v, atenua = 1 - 0.45 * v
  for (let i = 0; i < n; i++) {
    const e = estrellas[i]
    let y = (e.y * H - dsp * par[e.capa]) % H
    if (y < 0) y += H
    let x = e.x * W
    if (c && abre > 0) { const z = 1 + abre * ZOOM[e.capa]; x = c.x + (x - c.x) * z; y = c.y + (y - c.y) * z } // las estrellas se abren desde el agujero; en reposo z = 1
    const quieta = e.a * 0.85, tw = mov ? e.a * (0.6 + 0.4 * Math.sin(t * e.vel + e.fase)) : quieta
    let a = quieta + (tw - quieta) * amp
    if (columna && x >= columna.x0 && x <= columna.x1) a *= 0.5
    a *= suave * atenua * real
    const ec = AS[e.ci] || AS[AS.length - 1]
    ctx.fillStyle = 'rgba(' + ec + ',' + (a > 1 ? 1 : a).toFixed(3) + ')'
    if (e.s < 1.2) ctx.fillRect(x, y, e.s, e.s)
    else {
      ctx.beginPath(); ctx.arc(x, y, e.s * 0.6, 0, 6.2832); ctx.fill()
      if (e.capa === 2 && e.s > 2) { ctx.fillStyle = 'rgba(' + ec + ',' + (a * 0.22).toFixed(3) + ')'; ctx.fillRect(x - e.s * 3, y - 0.3, e.s * 6, 0.6); ctx.fillRect(x - 0.3, y - e.s * 3, 0.6, e.s * 6) }
    }
  }
  if (c && v > 0.004) rayos(c, v, n, suave)
}
const ZOOM = [0.05, 0.12, 0.22]
/** Dónde está el agujero (coordenadas de la ventana, el lienzo del cielo es fijo y de pantalla completa); si no se sabe, el centro. */
function centro(): { x: number; y: number; r: number } {
  const g = centroViaje ? centroViaje() : null
  return g || { x: W / 2, y: H / 2, r: Math.min(W, H) * 0.2 }
}
/** El chorro: trazos radiales plata que salen del borde del agujero hacia las esquinas. Dos trazos en total. */
function rayos(c: { x: number; y: number; r: number }, v: number, n: number, suave: number): void {
  if (!ctx) return
  const claro = Tema.v.claro
  const col = claro ? Tema.v.discoU[3] || [154, 161, 171] : Tema.v.discoU[0] || [255, 255, 255] // plata como el estado «escucha»: blanco en oscuro, plata oscura en claro
  const rIni = c.r * 0.62, rMax = Math.hypot(Math.max(c.x, W - c.x), Math.max(c.y, H - c.y)) * 1.02, largo = Viaje.largoDelRayo(v)
  const paso = viajeLigero ? 2 : 1
  ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'round'
  for (let pasada = 0; pasada < 2; pasada++) {
    ctx.beginPath()
    for (let i = pasada; i < RAYOS; i += 2 * paso) {
      const e = estrellas[Math.min(n - 1, i * 3)]
      let dx = e.x * W - c.x, dy = e.y * H - c.y
      const d = Math.hypot(dx, dy) || 1
      dx /= d; dy /= d
      const u = rayoFase[i], u2 = u * u, ut = Math.max(0, u - largo * (0.7 + 0.6 * rayoVel[i] / 1.4)), ut2 = ut * ut
      const r1 = rIni + (rMax - rIni) * u2, r0 = rIni + (rMax - rIni) * ut2
      ctx.moveTo(c.x + dx * r0, c.y + dy * r0); ctx.lineTo(c.x + dx * r1, c.y + dy * r1)
    }
    ctx.lineWidth = pasada ? 1.6 : 0.8
    ctx.strokeStyle = 'rgba(' + col + ',' + ((pasada ? 0.4 : 0.2) * v * suave).toFixed(3) + ')'
    ctx.stroke()
  }
}
/** Lo que mide el cuadro del viaje (en ms), para comprobar el presupuesto desde fuera. */
export const dbgViaje = { costo: 0, p90: 0, cuadros: 0, ligero: false }
const VEL_RAYO = 1.2
/** Un cuadro del viaje: 60 por segundo (30 si la carga pasa de 8 ms de p90, como el recorte del agujero). Devuelve para seguir pidiendo. */
function cuadroViaje(ahora: number, amp: number): void {
  if (ahora - tDib >= (viajeLigero || Escena.baja ? 1000 / 30 : 1000 / 60) - 3) {
    const c0 = performance.now()
    const dt = clamp((ahora - tAnt) / 1000, 0, 0.05)
    reloj += dt; tAnt = ahora; tDib = ahora
    const v = Viaje.avanzar(viaje, dt, false)
    for (let i = 0; i < RAYOS; i++) rayoFase[i] = (rayoFase[i] + v * dt * rayoVel[i] * VEL_RAYO) % 1
    dibujar(reloj, amp); sucio = false
    const costo = performance.now() - c0
    dbgViaje.costo = costo; dbgViaje.cuadros++
    costoV[nCostoV % 60] = costo; nCostoV++
    if (nCostoV % 60 === 0) {
      const ord = Array.from(costoV).sort((a, b) => a - b)
      dbgViaje.p90 = ord[53]
      if (!viajeLigero && dbgViaje.p90 > 8) { viajeLigero = true; dbgViaje.ligero = true } // el mismo recorte de carga que el agujero: la mitad de los rayos, sin empuje, a 30 cuadros
    }
  }
  pedir()
}
function cuadro(ahora: number): void {
  raf = 0
  if (document.hidden || !cv) return // pestaña oculta: ni un cuadro
  const amp = Escena.quietaAmp(ahora)
  if (Escena.quietaActiva && Viaje.activo(viaje)) Viaje.detener(viaje) // la seguridad corta el viaje de golpe
  if (!Escena.quietaActiva && Viaje.activo(viaje) && !reducido()) { cuadroViaje(ahora, amp); return }
  if (viaje.v > 0) { Viaje.avanzar(viaje, 0, true); sucio = true } // el movimiento se redujo a mitad del viaje: queda quieto al instante
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
    alDesmontar(() => { detener(); cv = null; ctx = null; neb = null; centroViaje = null })
    Viaje.detener(viaje); viajeLigero = false; nCostoV = 0; Object.assign(dbgViaje, { costo: 0, p90: 0, cuadros: 0, ligero: false })
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
  /** De dónde sale el viaje: el centro del agujero en coordenadas de la ventana (`r` es su radio). Sin él, el centro de la pantalla. */
  fijarCentro(fn: (() => { x: number; y: number; r: number } | null) | null): void { centroViaje = fn },
  /** Se empieza (`true`) o se deja (`false`) de escuchar con el agujero presionado: arranca o frena el viaje. */
  escucha(si: boolean): void {
    if (!cv) return
    if (si) Viaje.empezar(viaje); else Viaje.soltar(viaje)
    if (reducido()) { sucio = true; dibujar(reloj, Escena.quietaAmp(performance.now())); return } // sin movimiento: un solo cuadro con un leve aumento de brillo
    if (si) { tActiv = performance.now(); tAnt = tActiv; dormido = false }
    pedir()
  },
  /** Llegó un resultado del reconocedor (el mismo pulso que riza las ondas): el viaje sube un poco. */
  pulso(): void { Viaje.pulsar(viaje) },
  tema(): void { if (!cv) return; nebulosa(); fin = false; dibujar(reloj, Escena.quietaAmp(performance.now())); dormido = false; tActiv = performance.now(); pedir() },
  cambio(): void { fin = false; sucio = true; dibujar(reloj, Escena.quietaAmp(performance.now())); dormido = false; pedir() },
  sala(b: boolean): void { Escena.sala = !!b; ajustarColumna(); tActiv = performance.now(); dormido = false; dibujar(reloj, Escena.quietaAmp(performance.now())); pedir() },
  lienzo(): HTMLCanvasElement | null { return cv },
  ancho(): number { return W },
}
