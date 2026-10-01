import { Cosmos } from './cosmos'
import { DUR, M_ECO, clamp, curvaSalida, muelle } from './movimiento'
import {
  CANAL_FOTON, CANAL_LENTE, CANAL_LUZ, COL, CONICO, L, MODOS, N, NIV, colorCero, colorFino, colorLut, dbg, formaEn, nivelDe, nivelFino,
  rgba, rugosidad, sp, st, tocarTrazo, tono, type Geo, type Ojo,
} from './ondaEstado'
import type { Rgb } from './escena'

/**
 * El dibujo del agujero negro: un solo canvas 2D, sin filter ni shadowBlur. Horizonte negro,
 * anillo de fotones y un disco de acreción que gira (más rápido por dentro), con la lente:
 * la cara lejana del disco se curva por encima y por debajo. Las ondas de voz viven en el
 * disco: el borde y el anillo se rizan con la envolvente de las sílabas.
 */

/** Detrás del agujero va su trozo de cielo: así lo que sube por debajo se esconde sin marco. Solo se copia lo que se ve. */
export function fondo(): void {
  const { ctx, W, H, rect } = L
  ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, W, H)
  const src = Cosmos.lienzo()
  if (!src || !src.width) return
  const kk = src.width / Math.max(1, Cosmos.ancho()), alto = Math.min(H, Math.ceil(st.hVis) + 2)
  let sx = rect.left * kk, sy = rect.top * kk, sw = W * kk, sh = alto * kk, dx = 0, dy = 0, dw = W, dh = alto
  if (sx < 0) { dx = -sx / kk; dw -= dx; sw += sx; sx = 0 }
  if (sy < 0) { dy = -sy / kk; dh -= dy; sh += sy; sy = 0 }
  if (sx + sw > src.width) { const x = sx + sw - src.width; sw -= x; dw -= x / kk }
  if (sy + sh > src.height) { const y = sy + sh - src.height; sh -= y; dh -= y / kk }
  if (sw < 1 || sh < 1 || dw < 1 || dh < 1) return
  try { ctx.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh) } catch { /* sin copia: el lienzo queda transparente */ }
}

/* El disco: por anillo y mitad, el alfa de cada segmento se cuantiza a 10 niveles y todos los del mismo nivel van en un solo trazado */
const PX = new Float32Array(64 * 3 + 4), PY = new Float32Array(64 * 3 + 4), NV = new Uint8Array(64)
const OFF = new Float32Array(64), ALF = new Float32Array(64)

/* Igual que discoTeselas() (mismos radios, mismo rizo, misma franja y el mismo Doppler), pero cada anillo-mitad es UN trazo con un degradado cónico centrado en el
   agujero. La elipse está inclinada: el degradado mide el ángulo en el plano del lienzo, así que cada frontera de segmento va en atan2(tilt·sen θ, cos θ). */
function discoSuave(o: Ojo, a0: number, a1: number, t: number): void {
  const { ctx, NR, SEG } = L
  const { cx, cy, Rh, rOut } = o, rIn = Rh * 1.6, tilt = 0.26, dirD = st.vel >= 0 ? 1 : -1, P = SEG * 3 + 1
  const mq = Math.round(clamp(o.modo, 0, 1) * (MODOS - 1)), formaOn = st.mezcla >= 0.01
  for (let s = 0; s <= SEG; s++) {
    const th = a0 + ((a1 - a0) * s) / SEG
    let f = Math.atan2(tilt * Math.sin(th), Math.cos(th))
    if (f < 0) f += 2 * Math.PI
    OFF[s] = Math.min(1, Math.max(f / (2 * Math.PI), s ? OFF[s - 1] : 0))
  }
  OFF[SEG] = Math.max(OFF[SEG], OFF[SEG - 1])
  for (let j = 0; j < NR; j++) {
    const u = j / (NR - 1), r0 = rIn + (rOut - rIn) * Math.pow(u, 0.85)
    const giro = st.giro * Math.pow(rIn / r0, 1.5)
    const ampV = Rh * 0.36 * o.voz * Math.pow(u, 1.2)
    const ampF = u > 0.6 ? (Rh * 0.3 * (u - 0.6)) / 0.4 : 0
    const alfa = (0.14 + 0.5 * (1 - u)) * o.brillo * (u > 0.82 ? 0.25 + (0.75 * (1 - u)) / 0.18 : 1)
    const conRizo = ampV > 0.02, conForma = formaOn && ampF > 0
    let visible = false
    for (let s = 0; s <= SEG; s++) {
      const tm = a0 + ((a1 - a0) * s) / SEG
      const franja = 0.6 + 0.4 * Math.sin(5 * (tm - giro) + j * 1.9) * Math.sin(2 * (tm - giro * 0.7) + j)
      const doppler = 1 + 0.5 * Math.cos(tm) * dirD // el lado que se acerca brilla más
      const a = alfa * franja * doppler
      ALF[s] = a
      if (a >= 0.02) visible = true
    }
    if (!visible) continue
    const gr = ctx.createConicGradient(0, cx, cy)
    for (let s = 0; s <= SEG; s++) gr.addColorStop(OFF[s], colorFino(j, mq, ALF[s] < 0.02 ? 0 : nivelFino(ALF[s])))
    ctx.beginPath()
    for (let p = 0; p < P; p++) {
      const th = a0 + ((a1 - a0) * p) / (P - 1)
      const r = r0 + (conRizo ? ampV * rugosidad(th - giro * 0.3, t, j) : 0) + (conForma ? ampF * formaEn(th) : 0)
      const x = cx + r * Math.cos(th), y = cy + r * Math.sin(th) * tilt
      if (p) ctx.lineTo(x, y); else ctx.moveTo(x, y)
    }
    ctx.lineWidth = Math.max(1, ((rOut - rIn) / NR) * 0.95); ctx.strokeStyle = gr; tocarTrazo()
  }
}
function disco(o: Ojo, a0: number, a1: number, t: number): void {
  if (CONICO) return discoSuave(o, a0, a1, t)
  const { ctx, NR, SEG } = L
  const { cx, cy, Rh, rOut } = o, rIn = Rh * 1.6, tilt = 0.26, dirD = st.vel >= 0 ? 1 : -1, P = SEG * 3 + 1
  const mq = Math.round(clamp(o.modo, 0, 1) * (MODOS - 1)), formaOn = st.mezcla >= 0.01
  for (let j = 0; j < NR; j++) {
    const u = j / (NR - 1), r0 = rIn + (rOut - rIn) * Math.pow(u, 0.85)
    const giro = st.giro * Math.pow(rIn / r0, 1.5) // Kepler: el interior gira más rápido
    const ampV = Rh * 0.36 * o.voz * Math.pow(u, 1.2)
    const ampF = u > 0.6 ? (Rh * 0.3 * (u - 0.6)) / 0.4 : 0
    const alfa = (0.14 + 0.5 * (1 - u)) * o.brillo * (u > 0.82 ? 0.25 + (0.75 * (1 - u)) / 0.18 : 1)
    const conRizo = ampV > 0.02, conForma = formaOn && ampF > 0
    for (let p = 0; p < P; p++) {
      const th = a0 + ((a1 - a0) * p) / (P - 1)
      const r = r0 + (conRizo ? ampV * rugosidad(th - giro * 0.3, t, j) : 0) + (conForma ? ampF * formaEn(th) : 0)
      PX[p] = cx + r * Math.cos(th); PY[p] = cy + r * Math.sin(th) * tilt
    }
    for (let s = 0; s < SEG; s++) {
      const tm = a0 + ((a1 - a0) * (s + 0.5)) / SEG
      const franja = 0.6 + 0.4 * Math.sin(5 * (tm - giro) + j * 1.9) * Math.sin(2 * (tm - giro * 0.7) + j)
      const doppler = 1 + 0.5 * Math.cos(tm) * dirD
      const a = alfa * franja * doppler
      NV[s] = a < 0.02 ? 255 : nivelDe(a)
    }
    ctx.lineWidth = Math.max(1, ((rOut - rIn) / NR) * 0.95)
    for (let nv = 0; nv < NIV; nv++) {
      let abierto = false
      for (let s = 0; s < SEG; s++) {
        if (NV[s] !== nv) continue
        if (!abierto) { ctx.beginPath(); abierto = true }
        const b = s * 3
        ctx.moveTo(PX[b], PY[b]); ctx.lineTo(PX[b + 1], PY[b + 1]); ctx.lineTo(PX[b + 2], PY[b + 2]); ctx.lineTo(PX[b + 3], PY[b + 3])
      }
      if (abierto) { ctx.strokeStyle = colorLut(j, mq, nv); tocarTrazo() }
    }
  }
}
function arcoLente(cx: number, cy: number, r0: number, sy: number, a0: number, a1: number, amp: number, t: number, j: number): void {
  const { ctx } = L
  ctx.beginPath()
  for (let i = 0; i <= 40; i++) { const th = a0 + ((a1 - a0) * i) / 40, r = r0 + (amp > 0.02 ? amp * rugosidad(th, t, j) : 0), x = cx + r * Math.cos(th), y = cy + r * Math.sin(th) * sy; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y) }
  tocarTrazo()
}
/** La cara lejana del disco, curvada por la gravedad: un arco ancho arriba y uno fino abajo. */
function lente(o: Ojo, t: number, mq: number): void {
  const { ctx } = L, { cx, cy, Rh } = o
  for (let j = 0; j < 6; j++) {
    const u = j / 5, ampV = Rh * 0.2 * o.voz * (0.4 + u)
    ctx.lineWidth = Math.max(1, Rh * 0.12 * (1 - u * 0.5)); ctx.strokeStyle = colorLut(CANAL_LENTE + j, mq, nivelDe((0.5 - u * 0.36) * o.brillo))
    arcoLente(cx, cy, Rh * (1.13 + u * 0.55), 0.97, Math.PI, 2 * Math.PI, ampV, t, j)
    ctx.lineWidth = Math.max(0.8, Rh * 0.05); ctx.strokeStyle = colorLut(CANAL_LENTE + j, mq, nivelDe((0.28 - u * 0.2) * o.brillo))
    arcoLente(cx, cy, Rh * (1.08 + u * 0.18), 0.9, 0, Math.PI, ampV * 0.6, t, j + 3)
  }
}
/** El anillo de fotones: lo más brillante, y lo que más se riza con la voz. */
function fotones(o: Ojo, t: number, mq: number): void {
  const { ctx } = L, { cx, cy, Rh } = o, amp = Rh * 0.12 * o.voz, br = o.brillo + st.asienta * 0.08, aro = o.aro == null ? 1 : o.aro
  for (const [w, a] of [[Rh * 0.24, 0.12], [Rh * 0.08, 0.35], [1.4, 0.95]]) {
    ctx.lineWidth = Math.max(1, w); ctx.strokeStyle = colorLut(CANAL_FOTON, mq, nivelDe(a * br * aro)); ctx.beginPath()
    for (let i = 0; i <= 72; i++) { const th = (i / 72) * Math.PI * 2, r = Rh * 1.05 + (amp > 0.02 ? amp * rugosidad(th + st.giro * 0.5, t * 1.3, 5) : 0), x = cx + r * Math.cos(th), y = cy + r * Math.sin(th); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y) }
    ctx.closePath(); tocarTrazo()
  }
}
export function agujero(t: number, o: Ojo): void {
  const { ctx, H } = L, { cx, cy, Rh, rOut } = o, mq = Math.round(clamp(o.modo, 0, 1) * (MODOS - 1))
  ctx.globalCompositeOperation = COL.mezcla
  const R = Math.max(Rh * 1.2, Math.min(rOut * 1.35, cx, cy, H - cy) - 1)
  const g = ctx.createRadialGradient(cx, cy, Rh * 0.9, cx, cy, R)
  g.addColorStop(0, colorLut(CANAL_LUZ, mq, nivelDe(0.2 * o.brillo))); g.addColorStop(0.45, colorLut(CANAL_LUZ, mq, nivelDe(0.06 * o.brillo))); g.addColorStop(1, colorCero(CANAL_LUZ, mq)) // sin cadenas nuevas por cuadro
  ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, R * 2, R * 2) // solo el rectángulo del degradado, no el lienzo entero
  disco(o, Math.PI, 2 * Math.PI, t) // la mitad lejana, detrás
  lente(o, t, mq)
  ctx.globalCompositeOperation = 'source-over' // el horizonte: negro de verdad (tinta en el tema claro)
  const gh = ctx.createRadialGradient(cx, cy, Rh * 0.6, cx, cy, Rh * 1.03)
  gh.addColorStop(0, COL.hor); gh.addColorStop(0.93, COL.hor); gh.addColorStop(1, COL.hor0)
  ctx.fillStyle = gh; ctx.beginPath(); ctx.arc(cx, cy, Rh * 1.03, 0, Math.PI * 2); ctx.fill()
  ctx.globalCompositeOperation = COL.mezcla
  fotones(o, t, mq)
  disco(o, 0, Math.PI, t) // la mitad cercana pasa por delante del horizonte
  ctx.globalCompositeOperation = 'source-over'
}
function capasDeLuz(w: [number, number, number]): [number, number, Rgb][] { return [[w[0], 0.09, COL.brasa], [w[1], 0.22, COL.ascua], [w[2], 0.95, COL.luz]] }
/** La firma del día: una onda de luz. */
export function ondaLuminosa(ys: Float32Array, cy: number, esc: number, alfa: number, hasta: number): void {
  const { ctx, W } = L
  ctx.globalCompositeOperation = COL.mezcla; ctx.lineJoin = 'round'
  for (const [w, a, c] of capasDeLuz([9, 3.5, 1.7])) {
    ctx.lineWidth = w; ctx.strokeStyle = rgba(c, a * alfa); ctx.beginPath()
    const n = Math.max(2, Math.min(N, Math.ceil(hasta * (N - 1)) + 1))
    for (let i = 0; i < n; i++) { const x = 16 + (i / (N - 1)) * (W - 32), y = cy - ys[i] * esc; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y) }
    tocarTrazo()
  }
  ctx.globalCompositeOperation = 'source-over'
}
export function recorteInferior(): void {
  const { ctx, W, H } = L, hv = st.hVis
  if (hv < H) ctx.clearRect(0, hv, W, H - hv)
  const fh = Math.min(32, hv * 0.12), gr = ctx.createLinearGradient(0, hv - fh, 0, hv)
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = gr; ctx.fillRect(0, hv - fh, W, fh); ctx.globalCompositeOperation = 'source-over'
}
/** Lo que se suma al agujero en reposo: chispa, golpe, punto de salida de una estrella, anillo de mantener. */
export function adornos(o: Ojo, red: boolean, ahora: number): void {
  const { ctx } = L
  ctx.globalCompositeOperation = COL.mezcla
  if (st.chispaA > 0.01) {
    const a = red ? -Math.PI / 2 : st.chispaAng, x = o.cx + o.Rh * 1.05 * Math.cos(a), y = o.cy + o.Rh * 1.05 * Math.sin(a)
    const gs = ctx.createRadialGradient(x, y, 0, x, y, o.Rh * 0.3)
    gs.addColorStop(0, COL.blancoPre + (0.95 * st.chispaA).toFixed(3) + ')'); gs.addColorStop(1, COL.blanco0)
    ctx.fillStyle = gs; ctx.fillRect(x - o.Rh * 0.3, y - o.Rh * 0.3, o.Rh * 0.6, o.Rh * 0.6)
  }
  if (st.golpe > 0.01 && !red) { // el entreno: una onda de choque sale del disco, del mismo plano (inclinación .26)
    const r = o.Rh * (1.2 + 2.8 * (1 - st.golpe))
    ctx.strokeStyle = rgba(tono(0.3, st.modo), 0.55 * st.golpe); ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.ellipse(o.cx, o.cy, r, r * 0.26, 0, 0, Math.PI * 2); tocarTrazo()
  }
  if (st.golpeFijo > ahora && red) { // movimiento reducido: una segunda elipse fija a 2 Rh, visible 600 ms
    ctx.strokeStyle = rgba(tono(0.3, st.modo), 0.5); ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.ellipse(o.cx, o.cy, o.Rh * 2, o.Rh * 2 * 0.26, 0, 0, Math.PI * 2); tocarTrazo()
  }
  if (st.punto) { // el punto del borde por donde sale la estrella: enciende con brillo (sin tamaño)
    const u = (ahora - st.punto.t0) / 1000, dur = red ? 0.6 : 0.62
    if (u >= dur) st.punto = null
    else {
      const a = red ? 1 : Math.min(1, u / 0.12) * (u > 0.4 ? 1 - (u - 0.4) / 0.22 : 1)
      const x = o.cx + o.rOut * Math.cos(st.punto.th), y = o.cy + o.rOut * Math.sin(st.punto.th) * 0.26
      const gp = ctx.createRadialGradient(x, y, 0, x, y, 9)
      gp.addColorStop(0, COL.blancoPre + (0.9 * a).toFixed(3) + ')'); gp.addColorStop(1, COL.blanco0)
      ctx.fillStyle = gp; ctx.fillRect(x - 9, y - 9, 18, 18)
    }
  }
  if (st.mant) { // mantener para respirar: anillo de progreso lineal alrededor del horizonte; al soltar antes, se recoge en 200 ms
    const m = st.mant
    let p
    if (m.suelta) { const u = (ahora - m.suelta) / 200; p = u >= 1 ? 0 : m.desde * (1 - curvaSalida(u)); if (u >= 1) st.mant = null }
    else p = Math.min(1, (ahora - m.t0) / DUR.mantener)
    if (st.mant && p > 0.001) {
      const r = o.Rh * 1.34
      ctx.lineWidth = 1.2; ctx.strokeStyle = COL.mantBase; ctx.beginPath(); ctx.arc(o.cx, o.cy, r, 0, Math.PI * 2); tocarTrazo()
      ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.strokeStyle = COL.mant; ctx.beginPath(); ctx.arc(o.cx, o.cy, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); tocarTrazo(); ctx.lineCap = 'butt'
      m.p = p
    }
  }
  ctx.globalCompositeOperation = 'source-over'
}
/** El eco: el agujero absorbe la onda del día y la devuelve como un anillo. La geometría va con el muelle; el anillo, con ANILLO_ECO (un sobrepaso de ≈ 2,8 %). */
export function dibujarEco(t: number, red: boolean, dt: number, ahora: number, oBase: Geo): void {
  const eco = st.eco
  if (!eco) return
  const { ctx, W, H } = L
  const p = red ? 1 : clamp((ahora - st.ecoT) / DUR.eco, 0, 1)
  dbg.ecoP = p
  const cx = oBase.cx, cy = oBase.cy, Rh = oBase.Rh, R = Math.min(W, H) * 0.3
  if (p >= 1 && eco.t1 == null) eco.t1 = L.reloj
  const giro = red ? 0 : p >= 1 ? ((L.reloj - (eco.t1 as number)) / 12) * Math.PI * 2 : 0
  const pa = clamp(p / 0.45, 0, 1), pb = clamp((p - 0.5) / 0.5, 0, 1)
  const ea = pa * pa * (3 - 2 * pa), eb = 1 - Math.pow(1 - pb, 3)
  const destello = red ? 0 : Math.exp(-Math.pow((p - 0.5) / 0.07, 2)) // confinado a la región del agujero
  const rr0 = Rh * 1.05, objAnillo = p < 0.5 ? rr0 : R
  if (red) { sp.anillo.x = objAnillo; sp.anillo.v = 0 } else muelle(sp.anillo, objAnillo, dt, ...M_ECO)
  const anillo = red ? R : Math.max(rr0, sp.anillo.x)
  agujero(t, { cx: oBase.cx, cy: oBase.cy, Rh: oBase.Rh, rOut: oBase.rOut, brillo: 0.4 + 0.6 * destello + 0.2 * eb, voz: 0.03 + 0.4 * destello, modo: 0.3 })
  const f = eco.pts
  ctx.globalCompositeOperation = COL.mezcla; ctx.lineJoin = 'round'
  if (p < 0.5) { // cae en espiral hacia el horizonte
    const alfa = 1 - clamp((p - 0.33) / 0.14, 0, 1)
    const ys: [number, number][] = []
    for (let i = 0; i < N; i++) {
      const x = i / (N - 1), lx = 16 + x * (W - 32), ly = H / 2 - f[i] * H * 0.36
      const d0 = Math.hypot(lx - cx, ly - cy), ang = Math.atan2(ly - cy, lx - cx) + ea * (2.2 + x)
      const d = d0 * (1 - ea) + Rh * 0.95 * ea
      ys.push([cx + d * Math.cos(ang), cy + d * Math.sin(ang) * (1 - 0.45 * ea)])
    }
    for (const [w, a, c] of capasDeLuz([8, 3, 1.6])) {
      ctx.lineWidth = w; ctx.strokeStyle = rgba(c, a * alfa); ctx.beginPath()
      ys.forEach(([x, y], i) => { if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y) }); tocarTrazo()
    }
  } else { // y vuelve como anillo
    const ea2 = red ? 1 : eb
    const trazoAnillo = (hasta: number) => {
      ctx.beginPath()
      const n = Math.max(2, Math.ceil(hasta * (N - 1)) + 1)
      for (let i = 0; i < n; i++) { const x = i / (N - 1), th = -Math.PI / 2 + x * Math.PI * 2 * 0.999 + giro, rr = anillo + f[i] * R * 0.26 * ea2; const X = cx + rr * Math.cos(th), Y = cy + rr * Math.sin(th); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y) }
    }
    for (const [w, a, c] of capasDeLuz([9, 3.5, 1.8])) {
      ctx.lineWidth = w; ctx.strokeStyle = rgba(c, (w === 9 ? 0.1 / 0.09 : 1) * a * ea2); trazoAnillo(1); ctx.closePath(); tocarTrazo()
    }
    if (st.cursor >= 0 && (red || pb >= 1)) {
      if (red) { // sin punto que se mueva: el tramo ya sonado se aclara
        ctx.lineWidth = 2.6; ctx.strokeStyle = COL.cursorRed; trazoAnillo(st.cursor); tocarTrazo()
      } else { // el cursor recorre la firma: cuenta lo mismo sin audio
        const th = -Math.PI / 2 + st.cursor * Math.PI * 2 + giro, i = Math.min(N - 1, Math.round(st.cursor * (N - 1)))
        const rr = anillo + f[i] * R * 0.26
        ctx.fillStyle = COL.cursor; ctx.beginPath(); ctx.arc(cx + rr * Math.cos(th), cy + rr * Math.sin(th), 4, 0, Math.PI * 2); ctx.fill()
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over'
}
