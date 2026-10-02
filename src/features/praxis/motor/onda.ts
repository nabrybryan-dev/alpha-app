import { Cosmos } from './cosmos'
import { HOY, SEMANA, USUARIO, type DatosDia } from './datos'
import { alDesmontar, reducido } from './entorno'
import { Escena, Tema } from './escena'
import { firmaDelDia } from './firma'
import { DUR, M_BRILLO, M_GEOMETRIA, TAU, clamp, curvaCajon, curvaMov, curvaSalida, esperar, muelle } from './movimiento'
import { adornos, agujero, dibujarEco, fondo, ondaLuminosa, recorteInferior, rehacerTextura } from './ondaDibujo'
import { CAJA_COMPACTA, CLAVES_GEO, COL, L, N, PAL, armarCanales, dbg, reiniciarEstado, sp, st, type EstadoOnda, type Geo, type Ojo } from './ondaEstado'

/**
 * El agujero negro que habla. Praxis: rojo-ámbar de Alpha. La persona: plata, y el giro se
 * invierte. En reposo respira 6 veces por minuto.
 *
 * La geometría (cx, cy, Rh, rOut, brillo) sigue a su objetivo con un muelle en vez de
 * saltar; la sílaba mueve la forma y la frase mueve la luz y el giro (tope de 1,2 rad/s);
 * va a 60 fps solo cuando hay voz o transición y a 30 fps en reposo. Con la pestaña oculta
 * no pide ni un cuadro.
 */
let raf = 0, corriendo = false, tAnt = 0, tDib = 0, sucio = true
const costos = new Float32Array(60)
let nCostos = 0
let alQuien: ((q: string) => void) | null = null
let alMedir: (() => void) | null = null
const comp = (e: number) => (1 - Math.exp(-2.2 * e)) / (1 - Math.exp(-2.2)) // compresión suave de la envolvente

function refrescarRect(): void { if (L.cv) { const r = L.cv.getBoundingClientRect(); L.rect = { left: r.left, top: r.top } } }
function medir(): void {
  const cv = L.cv
  if (!cv || !L.ctx) return
  const nw = cv.clientWidth, nh = cv.clientHeight
  if (!nw || !nh) return
  const k = Escena.dpr
  L.W = nw; L.H = nh
  cv.width = Math.round(L.W * k); cv.height = Math.round(L.H * k)
  L.ctx.setTransform(k, 0, 0, k, 0, 0); sucio = true
  if (!st.hVis || !st.hAnim) st.hVis = st.compacta ? CAJA_COMPACTA : L.H
  refrescarRect()
  if (alMedir) alMedir()
}
function aliento(t: number): number { const c = t % 10; return c < 4 ? 0.5 - 0.5 * Math.cos((Math.PI * c) / 4) : 0.5 + 0.5 * Math.cos((Math.PI * (c - 4)) / 6) } // 6 por minuto
function envPraxis(t: number): number {
  let a = 0
  const d = DUR.silaba / 1000
  for (const s of st.silabas) { const u = t - s.t; if (u > 0 && u < d) a = Math.max(a, s.a * Math.sin((Math.PI * u) / d)) }
  if (st.espejo) { const u = t - st.espejo.t0; if (u >= 0 && u < 1) { const i = Math.floor(u * st.espejo.env.length); a = Math.max(a, st.espejo.env[i] || 0) } else if (u >= 1) st.espejo = null }
  return a
}
/* Cuánto se ve la caja: se anima con la misma curva que el FLIP del DOM, así el borde del lienzo y el del texto viajan juntos */
function actualizarVis(ahora: number, red: boolean): void {
  const obj = st.compacta ? CAJA_COMPACTA : L.H
  if (st.hAnim && !red) {
    const p = (ahora - st.hAnim.t0) / DUR.panel
    if (p >= 1) { st.hVis = obj; st.hAnim = null } else st.hVis = st.hAnim.d + (st.hAnim.h - st.hAnim.d) * curvaCajon(p)
  } else { st.hVis = obj; st.hAnim = null }
}
function altaFrecuencia(ahora: number): boolean {
  if (st.moviendo || st.hAnim || st.oye || st.hunde > 0.01 || st.nivel > 0.01 || st.respira || (st.eco && (ahora - st.ecoT < DUR.eco + 700 || st.cursor >= 0))) return true
  if (st.estado === 'habla' || st.estado === 'escucha' || st.estado === 'firma' || (st.estado === 'quieta' && st.quietaAmp > 0)) return true
  if (st.firma && ahora - st.firmaT < 1000) return true
  return st.pA > 0.02 || st.uA > 0.02 || st.uObj > 0.02 || st.golpe > 0.01 || st.asienta > 0.01 || !!st.punto || (st.chispaA > 0 && st.chispaA < 1)
}
const modoObjetivo = () => (st.plata ? 1 : st.foco ? 0.5 : 0)
const quienHabla = () => (st.plata ? 'persona' : st.estado === 'habla' || st.pA > 0.05 ? 'praxis' : '')
/* Con movimiento reducido nada se interpola: solo se pide otro cuadro mientras algo cambia de dueño */
function enMovimiento(): boolean {
  if (st.quien !== quienHabla() || Math.abs(st.hunde - st.hundeObj) > 0.01) return true
  if (Math.abs(st.mezcla - st.mezclaObj) > 0.005 || Math.abs(st.k - st.kObj) > 0.005 || Math.abs(st.modo - modoObjetivo()) > 0.01) return true
  for (let i = 0; i < N; i++) if (Math.abs(st.forma[i] - st.formaObj[i]) > 0.005) return true
  return false // la voz, el golpe, el punto, el pulso y la chispa piden su cuadro con un temporizador
}
/* Con movimiento reducido el pulso de la persona (un toque, un envío) dura una ventana fija de 650 ms: un cuadro al empezar y otro al acabar */
function pulsoRed(): void { if (!reducido()) return; st.uHasta = performance.now() + 650; clearTimeout(st.tU); st.tU = window.setTimeout(() => { sucio = true; pedir() }, 680) }
/* Con movimiento reducido no hay nada que animar: se pide un cuadro cuando cambia el estado y otro cuando termina lo que tenía duración */
function avisoRed(...ms: number[]): void { if (reducido()) ms.forEach((m) => setTimeout(() => { sucio = true; pedir() }, m)) }
/* El agujero EN EL CENTRO (la sala conectada; Bryan, 2-oct: «en el centro y lo más grande posible»). Lo manda el ancho: el borde del disco
   queda a 8 px del canto del teléfono (360–430 px, sin desborde lateral) y el horizonte es 1/2,45 de ese radio. En alto, solo pide que la lente
   de arriba (≈ 1,7 Rh) quepa en la caja: Rh ≤ 0,22 del alto. */
function geoCentro(W: number, Hc: number, esc: number): Geo {
  const Rh = Math.min((W / 2 - 8) / 2.45, Hc * 0.22) * esc
  return { cx: W / 2, cy: Hc * 0.5, Rh, rOut: Math.min(W / 2 - 8, Rh * 2.45) }
}
/* La geometría objetivo de cada modo; el muelle la sigue */
function objetivoGeo(br: number): Geo {
  const { W, H } = L, Hc = st.compacta ? CAJA_COMPACTA : H
  if (st.eco) { const R = Math.min(W, H) * 0.3, Rh = R * 0.32; return { cx: W / 2, cy: H / 2 - 4, Rh, rOut: Rh * 2.3 } }
  let esc = st.firma ? 0.72 : 1
  if (!st.firma) esc = st.respira ? 0.82 + 0.3 * st.respira.nivel : 1 + 0.035 * (br - 0.5)
  if (st.centro && !st.firma) return geoCentro(W, Hc, esc)
  const S = Math.min(W * 0.5, Hc * 0.6) * esc
  return { cx: W / 2, cy: st.firma ? H * 0.5 : Hc * (st.respira ? 0.38 : 0.5), Rh: S * 0.27, rOut: Math.min(S * 0.95, W / 2 - 10) }
}
function cuadro(ahora: number): void {
  raf = 0
  if (!corriendo || document.hidden || !L.W) return
  const { H } = L
  const red = reducido(), alta = altaFrecuencia(ahora), min = red ? 0 : alta ? 15.5 : 32
  if (tDib && ahora - tDib < min) { pedir(); return } // puerta de cuadros: 60 fps con voz o transición, 30 en reposo
  const c0 = performance.now()
  const dt = clamp((ahora - tAnt) / 1000, 0, 0.1) || 0.016
  tAnt = ahora; tDib = ahora; L.reloj += dt; L.nStroke = 0; dbg.dibujados++
  const reloj = L.reloj, t = red ? 0 : reloj

  /* — la voz: ataque rápido, suelta lenta, compresión suave — */
  const objP = red ? 0 : comp(envPraxis(reloj)) // con movimiento reducido la voz no mueve el disco: solo el estado
  st.pA += (objP - st.pA) * (1 - Math.exp(-dt / (objP > st.pA ? TAU.ataque : TAU.suelta)))
  if (red) { if (performance.now() >= st.uHasta) st.uObj = 0; st.uA = st.uObj } // reducido: la persona «pulsa» una ventana fija de 650 ms
  else { st.uA += (st.uObj - st.uA) * (1 - Math.exp(-dt / (st.uObj > st.uA ? TAU.ataque : TAU.suelta))); st.uObj *= Math.exp(-dt / 0.35) }
  const voz = Math.max(st.pA, st.uA)
  st.ee += (voz - st.ee) * (1 - Math.exp(-dt / TAU.energia)) // la energía de la frase: lenta, mueve la luz y el giro
  if (red) { st.k = st.kObj; st.mezcla = st.mezclaObj; st.forma.set(st.formaObj) } // reducido: la forma cambia de una vez
  else {
    st.k += (st.kObj - st.k) * (1 - Math.exp(-dt / TAU.tension))
    const s2 = 1 - Math.exp(-dt / TAU.forma)
    st.mezcla += (st.mezclaObj - st.mezcla) * s2
    for (let i = 0; i < N; i++) st.forma[i] += (st.formaObj[i] - st.forma[i]) * s2
  }
  st.golpe *= Math.exp(-dt / 0.5)
  st.tonoSt += (st.tonoObj - st.tonoSt) * (1 - Math.exp(-dt / 0.15))
  { const s = red ? 0 : clamp(st.tonoSt, -6, 6); const fino = red ? clamp((st.k - 1) / 0.45, 0, 1) * 0.15 : 0; L.W3 = 0.55 - 0.03 * s - fino; L.W7 = 0.3 + 0.02 * s; L.W13 = 0.15 + 0.01 * s + fino }
  if (st.asientaT0 >= 0) { const p = (reloj - st.asientaT0) / 0.36; if (p >= 1) { st.asienta = 0; st.asientaT0 = -1 } else st.asienta = 1 - curvaSalida(p) }
  st.antic += ((reloj < st.anticHasta ? 1 : 0) - st.antic) * (1 - Math.exp(-dt / 0.08))
  /* — hundirse al presionar (120 ms) y el nivel de la voz que se oye: sube al instante con cada resultado del reconocedor y cae en 350 ms — */
  if (red) { st.hunde = st.hundeObj; st.nivel = 0; st.nivelObj = 0 }
  else {
    st.hunde += (st.hundeObj - st.hunde) * (1 - Math.exp(-dt / 0.12))
    st.nivel += (st.nivelObj - st.nivel) * (1 - Math.exp(-dt / (st.nivelObj > st.nivel ? TAU.ataque : TAU.suelta)))
    st.nivelObj *= Math.exp(-dt / 0.35)
  }
  if (st.oye && st.oye.suelta && ahora - st.oye.suelta > 260) st.oye = null // por si el modo de dibujo no pasó por las ondas

  /* — quién habla: histéresis de 250 ms con micrófono; con un toque o un envío, al instante — */
  const persDom = (st.estado === 'escucha' || st.uA > 0.08) && st.uA >= st.pA
  st.tDom = persDom ? st.tDom + dt : 0; st.tNoDom = persDom ? 0 : st.tNoDom + dt
  if (red) st.plata = persDom // reducido: el color sigue al estado
  else if (!st.plata) { if (persDom && (!st.fuenteMic || st.tDom >= 0.25)) st.plata = true }
  else if (st.tNoDom >= 0.25 && st.estado !== 'escucha') st.plata = false
  const modoObj = modoObjetivo()
  st.modo = red ? modoObj : st.modo + (modoObj - st.modo) * (1 - Math.exp(-dt / TAU.color))
  const q = quienHabla()
  if (q !== st.quien) { st.quien = q; if (alQuien) alQuien(q) }

  /* — el giro: nunca cambia de sentido de golpe (pasa por cero) y tiene tope de 1,2 rad/s en el anillo interior — */
  let kk = st.k
  if (st.estado === 'piensa') kk *= 1.6
  let velObj = Math.min(1.2, (0.18 + 0.5 * st.ee) * kk)
  if (st.estado === 'aplanada') velObj *= 0.35
  if (st.plata) velObj = -velObj
  if (st.estado === 'quieta') velObj = 0
  st.vel += (velObj - st.vel) * (1 - Math.exp(-dt / TAU.giro))
  if (!red) st.giro += st.vel * dt

  /* — la chispa de «piensa»: aparece a los 150 ms, entra en 160 ms, da una vuelta cada 900 ms y se apaga donde está — */
  const quiere = st.estado === 'piensa' && ahora - st.piensaT >= 150
  if (quiere && st.chispaDesde < 0) st.chispaDesde = ahora
  const puedeApagar = st.chispaDesde < 0 || ahora - st.chispaDesde >= DUR.piensaMin
  const enChispa = quiere || (!puedeApagar && st.chispaA > 0)
  st.chispaA = red ? (enChispa ? 1 : 0) : clamp(st.chispaA + (enChispa ? dt : -dt) / 0.16, 0, 1)
  if (enChispa && !red) st.chispaAng += ((2 * Math.PI) / (DUR.piensaVuelta / 1000)) * dt
  if (!enChispa && st.chispaA === 0) { st.chispaDesde = -1; st.chispaAng = -Math.PI / 2 }

  /* — brillo y geometría objetivo — */
  const br = red ? 0.5 : aliento(reloj), hablaP = st.pA > 0.05 || st.estado === 'habla', escuchaU = st.estado === 'escucha' || st.uA > 0.08
  let brillo = red ? (hablaP || escuchaU ? 0.85 : 0.6) : 0.5 + 0.22 * br + 0.15 * st.ee
  brillo += 0.12 * st.antic
  if (st.respira) brillo = red ? 0.6 : 0.35 + 0.75 * st.respira.nivel
  if (st.estado === 'aplanada') brillo *= 0.6
  if (st.estado === 'piensa') brillo *= 0.8
  const geo = objetivoGeo(br)
  let brilloObj = brillo
  if (st.estado === 'quieta') {
    st.quietaAmp = Escena.quietaAmp(ahora)
    brilloObj = 0.6 * st.quietaAmp * st.quietaAmp
  }
  if (st.primero || red || st.estado === 'quieta') {
    sp.cx.x = geo.cx; sp.cy.x = geo.cy; sp.Rh.x = geo.Rh; sp.rOut.x = geo.rOut; sp.brillo.x = brilloObj
    sp.cx.v = sp.cy.v = sp.Rh.v = sp.rOut.v = sp.brillo.v = 0; st.primero = false
  } else {
    for (const c of CLAVES_GEO) muelle(sp[c], geo[c], dt, ...M_GEOMETRIA)
    muelle(sp.brillo, brilloObj, dt, ...M_BRILLO)
  }
  /* «en transición» = un muelle con velocidad o lejos de su objetivo; la respiración del reposo no cuenta, así el reposo va a 30 fps */
  st.moviendo = CLAVES_GEO.some((c) => Math.abs(sp[c].v) > 1.5 || Math.abs(sp[c].x - geo[c]) > 1.5) || Math.abs(sp.brillo.v) > 0.15 || Math.abs(sp.brillo.x - brilloObj) > 0.03
  actualizarVis(ahora, red)

  /* — dibujar — */
  fondo()
  const vozVis = red ? (hablaP || escuchaU ? 0.2 : 0) : Math.max(voz, 0.035 + 0.03 * br)
  const o: Ojo = { cx: sp.cx.x, cy: sp.cy.x, Rh: Math.max(4, sp.Rh.x) * (1 + 0.07 * st.hunde), rOut: Math.max(sp.Rh.x * 1.7, sp.rOut.x), brillo: Math.max(0, sp.brillo.x), voz: vozVis, modo: st.modo }
  if (red && st.respira) o.aro = 0.75 + 0.25 * st.respira.nivel // el anillo cambia de opacidad solo entre .75 y 1
  if (st.estado === 'quieta') {
    if (st.quietaAmp > 0) { o.voz = 0; agujero(t, o) }
  } else if (st.eco) dibujarEco(t, red, dt, ahora, o)
  else if (st.firma) {
    const tr = st.trazando, p = red ? 1 : clamp((ahora - st.firmaT - (tr ? 120 : 0)) / (tr ? 520 : DUR.panel), 0, 1)
    dbg.firmaP = p
    const e = tr ? p : curvaMov(p), ys = new Float32Array(N)
    for (let i = 0; i < N; i++) ys[i] = (st.firmaDesde ? st.firmaDesde[i] : 0) * (1 - e) + st.firma[i] * 0.95 * e
    o.brillo = red ? 0.45 : 0.38 + 0.5 * st.ee + 0.12 * st.antic; o.voz = red ? 0 : voz * 0.8
    agujero(t, o) // el agujero espera detrás; solo se riza con la voz
    ondaLuminosa(ys, H / 2, H * 0.36, tr ? p : 1, tr ? p : 1)
  } else {
    agujero(t, o)
    adornos(o, red, ahora)
  }
  recorteInferior()

  /* — medir y pedir el siguiente — */
  const costo = performance.now() - c0
  dbg.strokes = L.nStroke; dbg.costo = costo
  costos[nCostos % 60] = costo; nCostos++
  if (nCostos % 60 === 0) {
    const ord = Array.from(costos).sort((a, b) => a - b)
    dbg.p90 = ord[53]; dbg.p95 = ord[56]
    if (!Escena.baja && dbg.p90 > 8 && !red) bajarCalidad()
  }
  if (st.estado === 'quieta' && st.quietaAmp <= 0) { sucio = false; return } // apagado del todo: cero cuadros pedidos después
  if (red) { if (enMovimiento() || sucio) { sucio = false; pedir() } return }
  sucio = false; pedir()
}
function pedir(): void { if (!raf && corriendo && !document.hidden) raf = requestAnimationFrame(cuadro) }
function muestrear(pts: number[]): Float32Array {
  const out = new Float32Array(N)
  for (let i = 0; i < N; i++) { const j = (i / (N - 1)) * (pts.length - 1); const a = Math.floor(j), b = Math.min(pts.length - 1, a + 1); out[i] = pts[a] * (1 - (j - a)) + pts[b] * (j - a) }
  return out
}
function actual(): Float32Array { const o = new Float32Array(N); for (let i = 0; i < N; i++) o[i] = st.forma[i] * st.mezcla; return o }
function quieta(b: boolean): void { if (Escena.quietaActiva === b) return; Escena.quietaActiva = b; Escena.quietaT0 = performance.now(); Cosmos.cambio() }
/* Si el cuadro del agujero pesa (p90 > 8 ms durante 60 cuadros) el DPR baja a 1,25 y el disco pasa de 11×22 a 8×16. No vuelve a subir. */
function bajarCalidad(): void { if (Escena.baja) return; Escena.baja = true; Escena.dpr = Math.min(Escena.dpr, 1.25); L.NR = 8; L.SEG = 16; armarCanales(); Cosmos.medir(); medir() }
function detener(): void { corriendo = false; if (raf) cancelAnimationFrame(raf); raf = 0 }

export const Onda = {
  iniciar(canvas: HTMLCanvasElement): void {
    detener(); reiniciarEstado()
    L.cv = canvas; L.ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    L.W = 0; L.H = 0; L.reloj = 0; L.NR = 11; L.SEG = 22; armarCanales(); nCostos = 0; tDib = 0; sucio = true
    alDesmontar(() => { detener(); clearTimeout(st.tU); L.cv = null; alQuien = null; alMedir = null })
    medir()
  },
  /** Quién habla cambió: para el rótulo estático del movimiento reducido. */
  alCambiarQuien(fn: (q: string) => void): void { alQuien = fn },
  medir, pedir, refrescarRect, detener,
  /** Un solo redimensionado para los dos lienzos: mismo cuadro, mismo retardo de 120 ms. */
  redimensionar(): void { clearTimeout(Escena.tRes); Escena.tRes = window.setTimeout(() => { Cosmos.medir(); medir(); pedir() }, 120) },
  arrancar(): void { corriendo = true; medir(); st.primero = true; st.hVis = st.compacta ? CAJA_COMPACTA : L.H; st.hAnim = null; tAnt = performance.now(); tDib = 0; refrescarRect(); pedir() },
  despertar(): void { tAnt = performance.now(); sucio = true; pedir() },
  /* El tema cambia: paletas, mezcla y colores fijos salen de los tokens; las tablas de color se rehacen bajo demanda */
  tema(): void {
    const T = Tema.v, B = T.blanco
    if (T.discoP.length >= 2) PAL.P = T.discoP
    if (T.discoU.length === PAL.P.length) PAL.U = T.discoU
    Object.assign(COL, { mezcla: T.mezcla === 'multiply' ? 'multiply' : 'lighter', foton: T.foton, hor: 'rgb(' + T.horizonte + ')', hor0: 'rgba(' + T.horizonte + ',0)',
      blancoPre: 'rgba(' + B + ',', blanco0: 'rgba(' + B + ',0)', escucha: 'rgba(' + B + ',0.92)', cursorRed: 'rgba(' + B + ',0.95)',
      cursor: 'rgb(' + T.luzTxt + ')', brasa: T.brasa, ascua: T.ascua, luz: T.luz })
    armarCanales(); rehacerTextura(); sucio = true; pedir()
  },
  estado(e: EstadoOnda): void {
    const prev = st.estado
    st.estado = e; sucio = true
    if (e === 'piensa' && prev !== 'piensa') st.piensaT = performance.now()
    if (e === 'quieta') { st.quietaAmp = 1; quieta(true) } else if (prev === 'quieta') quieta(false)
    pedir(); avisoRed(170, 660)
  },
  get estadoActual(): EstadoOnda { return st.estado },
  /* Sílabas (segundos desde ahora). El reloj de la voz manda: desplazar() las corre cuando el TTS marca una palabra. */
  prosodia(tiempos: number[]): void { const t0 = L.reloj; st.silabas = tiempos.map((x) => ({ t: t0 + x, a: 0.75 + 0.25 * Math.random() })); if (!reducido()) pedir() },
  desplazar(seg: number): void { st.silabas.forEach((s) => { if (s.t > L.reloj - 0.2) s.t += seg }) },
  pulsoPraxis(): void { if (reducido()) return; st.silabas.push({ t: L.reloj, a: 0.9 }); if (st.silabas.length > 400) st.silabas.splice(0, 200); pedir() },
  callar(): void { st.silabas = [] },
  usuario(v: number): void { if (reducido() && st.estado === 'escucha') return; st.uObj = Math.max(st.uObj, v); pulsoRed(); pedir() },
  pulso(): void { st.uObj = Math.max(st.uObj, 0.75); pulsoRed(); pedir() },
  fuente(mic: boolean): void { st.fuenteMic = !!mic },
  foco(b: boolean): void { st.foco = !!b; sucio = true; pedir() },
  tono(semitonos: number): void { st.tonoObj = clamp(semitonos || 0, -6, 6) },
  anticipa(): void { if (reducido()) return; st.anticHasta = L.reloj + 0.12 + 0.24; pedir() },
  asentar(): void { if (reducido()) return; st.asientaT0 = L.reloj; pedir() },
  /* La estrella sale del borde del disco, por el ángulo más cercano a su órbita. Devuelve el punto de salida en coordenadas de página. */
  punto(xDestino: number, yDestino: number, enMs: number): { x: number; y: number } | null {
    const g = enMs ? Onda.geometriaEn(enMs) : Onda.geometria() // con enMs: donde estará el disco cuando la estrella despegue
    if (!g) return null
    const ang = Math.atan2((yDestino - g.cy) / 0.26, xDestino - g.cx) // ángulo del borde (elipse inclinada .26) más cercano a la órbita
    st.punto = { th: ang, t0: performance.now() }; pedir(); avisoRed(650)
    return { x: g.cx + g.rOut * Math.cos(ang), y: g.cy + g.rOut * Math.sin(ang) * 0.26 }
  },
  golpe(): void { if (reducido()) { st.golpeFijo = performance.now() + 600; avisoRed(650) } else st.golpe = 1; pedir() },
  tension(k: number): void { st.kObj = k; pedir() },
  forma(datos: DatosDia): void { const f = firmaDelDia(datos, USUARIO, HOY.fecha, N); st.formaObj = muestrear(f.pts); st.mezclaObj = f.vacia ? 0 : 0.75; pedir() },
  /* El agujero arranca con el día de ayer: el borde empieza con su forma (mezcla .75) y la suelta al acabar la primera frase */
  formaAyer(datos: DatosDia): void { const f = firmaDelDia(datos, USUARIO, SEMANA[5].fecha, N); st.forma = muestrear(f.pts); st.formaObj = st.forma.slice(); st.mezcla = f.vacia ? 0 : 0.75; st.mezclaObj = st.mezcla; pedir() },
  firmar(datos: DatosDia): Promise<void> {
    const nueva = !st.firma
    st.firmaDesde = st.firma ? st.firma : actual(); st.firma = muestrear(firmaDelDia(datos, USUARIO, HOY.fecha, N).pts)
    st.firmaT = performance.now(); st.trazando = nueva; st.estado = 'firma'; sucio = true; pedir()
    return esperar(reducido() ? 0 : 640)
  },
  soltarFirma(): void { st.firma = null; st.firmaDesde = null; sucio = true },
  eco(datos: DatosDia): Promise<void> {
    const R = Math.min(L.W, L.H) * 0.3
    st.eco = { pts: muestrear(firmaDelDia(datos, USUARIO, HOY.fecha, N).pts), t1: null }; st.ecoT = performance.now(); st.firma = null; sucio = true
    sp.anillo.x = R * 0.32 * 1.05; sp.anillo.v = 0; pedir()
    return esperar(reducido() ? 0 : DUR.eco + 50)
  },
  cursor(p: number): void { st.cursor = p; sucio = true; pedir() },
  espejo(env: number[]): void { st.espejo = { t0: L.reloj, env }; pedir() },
  respirar(nivel: number | null): void { st.respira = nivel == null ? null : { nivel }; sucio = true; pedir() },
  /** El agujero en el centro y lo más grande que cabe (la sala conectada). */
  centro(si: boolean): void { st.centro = !!si; sucio = true; pedir() },
  /** Cuando cambia el tamaño o la caja: quien coloca algo sobre el agujero (el botón de hablar) lo recoloca. */
  alMedir(fn: (() => void) | null): void { alMedir = fn },
  /** Dónde estará el agujero dentro del lienzo (coordenadas locales), sin muelles. */
  objetivo(): Geo | null { return L.cv && L.W ? objetivoGeo(0.5) : null },
  /** Escucha por voz: con `true` empiezan las ondas; con `false` se recogen en 240 ms. */
  oir(si: boolean): void {
    if (si) st.oye = { t0: performance.now(), suelta: 0 }
    else if (st.oye && !st.oye.suelta) st.oye.suelta = performance.now()
    sucio = true; pedir(); avisoRed(260)
  },
  /** El nivel de lo que se oye (0–1). No hay audio propio: lo da cada resultado del reconocedor. */
  nivel(v: number): void { if (reducido()) return; st.nivelObj = Math.max(st.nivelObj, clamp(v, 0, 1)); pedir() },
  /** Cuánto se hunde el agujero: 1 al presionar; con presión real del lápiz o del dedo, un poco más (solo realce). */
  hundir(v: number): void { st.hundeObj = clamp(v, 0, 1.5); sucio = true; pedir() },
  /* Cabecera compacta o grande. La caja del DOM cambia de alto al instante (FLIP); aquí solo cambia cuánto se ve, con la misma curva. */
  compactar(si: boolean, instante?: boolean): void {
    si = !!si
    if (st.compacta === si) return
    const desde = st.hVis || (st.compacta ? CAJA_COMPACTA : L.H)
    st.compacta = si
    st.hAnim = instante || reducido() || !L.H ? null : { d: desde, h: si ? CAJA_COMPACTA : L.H, t0: performance.now() }
    if (!st.hAnim) st.hVis = si ? CAJA_COMPACTA : L.H
    if (alMedir) alMedir()
    pedir()
  },
  /* Dónde está el agujero, en coordenadas de página (para el viaje de la mini a la sala) */
  geometria(objetivo?: boolean): Geo | null {
    if (!L.cv || !L.W) return null
    refrescarRect()
    const g = objetivo ? objetivoGeo(0.5) : { cx: sp.cx.x, cy: sp.cy.x, Rh: sp.Rh.x, rOut: sp.rOut.x }
    return { cx: L.rect.left + g.cx, cy: L.rect.top + g.cy, Rh: g.Rh, rOut: g.rOut }
  },
  /* Dónde estará el agujero dentro de `ms`: los muelles siguen su objetivo y se avanzan en copia, sin tocar los vivos. Sirve para que una estrella que
     despega mientras la cabecera se compacta salga del borde donde el disco va a estar, no de donde ya no está. */
  geometriaEn(ms: number): Geo | null {
    if (!L.cv || !L.W) return null
    refrescarRect()
    const obj = objetivoGeo(0.5), c: Geo = { cx: 0, cy: 0, Rh: 0, rOut: 0 }
    for (const k of CLAVES_GEO) {
      const m = { x: sp[k].x, v: sp[k].v }
      for (let rest = Math.max(0, ms) / 1000; rest > 0; rest -= 0.1) muelle(m, obj[k], Math.min(rest, 0.1), ...M_GEOMETRIA)
      c[k] = m.x
    }
    return { cx: L.rect.left + c.cx, cy: L.rect.top + c.cy, Rh: c.Rh, rOut: c.rOut }
  },
  reiniciar(): void {
    clearTimeout(st.tU)
    Object.assign(st, { estado: 'reposo', pA: 0, uA: 0, uObj: 0, uHasta: 0, ee: 0, kObj: 1, mezclaObj: 0, silabas: [], golpe: 0, golpeFijo: 0, punto: null, firma: null, firmaDesde: null, eco: null, cursor: -1, quietaAmp: 1, respira: null, espejo: null, oye: null, hunde: 0, hundeObj: 0, nivel: 0, nivelObj: 0, modo: 0, plata: false, tDom: 0, tNoDom: 0, foco: false, fuenteMic: false, vel: 0.18, antic: 0, anticHasta: 0, asienta: 0, asientaT0: -1, tonoObj: 0, chispaA: 0, chispaDesde: -1, primero: true })
    st.formaObj = new Float32Array(N); sucio = true; quieta(false); pedir()
  },
}
