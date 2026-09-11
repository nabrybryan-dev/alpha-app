// ── EL SALÓN, PROYECTADO ────────────────────────────────────────────────────
// Cámara a nivel que orbita al sujeto. Todo —sala, hierro, sujeto y anatomía—
// vive en metros y pasa por la MISMA proyección, así que al girar gira todo junto.
export const LIENZO = { w: 360, h: 640 }
const PPX = 180, PPY = 272
const F = 700, HC = 1.00, R = 3.45, NEAR = 0.30
export const CAM = { F, HC, R, PPX, PPY }
export const rad = (g) => (g * Math.PI) / 180

export function cam(th) {
  const s = Math.sin(th), c = Math.cos(th)
  return { p: [R * s, HC, -R * c], fwd: [-s, 0, c], right: [c, 0, s], th }
}
export function vista(P, k) {
  const d = [P[0] - k.p[0], P[1] - k.p[1], P[2] - k.p[2]]
  return [d[0] * k.right[0] + d[2] * k.right[2], d[1], d[0] * k.fwd[0] + d[2] * k.fwd[2]]
}
const pant = (v) => [PPX + (F * v[0]) / v[2], PPY - (F * v[1]) / v[2]]
export const proj = (P, k) => pant(vista(P, k))
const n1 = (x) => (Math.round(x * 10) / 10).toFixed(1)

// Recorta un segmento contra el plano cercano. Sin esto, un punto detrás de la
// cámara se proyecta al otro lado y dibuja una raya cruzando toda la pantalla.
function recorta(a, b) {
  if (a[2] < NEAR && b[2] < NEAR) return null
  if (a[2] < NEAR) { const t = (NEAR - a[2]) / (b[2] - a[2]); a = a.map((v, i) => v + (b[i] - v) * t) }
  else if (b[2] < NEAR) { const t = (NEAR - b[2]) / (a[2] - b[2]); b = b.map((v, i) => v + (a[i] - v) * t) }
  return [a, b]
}
export function linea3(A, B, k) {
  const r = recorta(vista(A, k), vista(B, k))
  if (!r) return null
  const p = pant(r[0]), q = pant(r[1])
  return `M ${n1(p[0])} ${n1(p[1])} L ${n1(q[0])} ${n1(q[1])}`
}
function cara(pts, k) {
  const vs = pts.map((P) => vista(P, k))
  if (vs.some((v) => v[2] < NEAR)) return null
  return { d: vs.map((v, i) => `${i ? 'L' : 'M'} ${n1(pant(v)[0])} ${n1(pant(v)[1])}`).join(' ') + ' Z',
           z: vs.reduce((s, v) => s + v[2], 0) / vs.length }
}

// ── Pintor: todo se acumula con su profundidad y se ordena de lejos a cerca ──
export const lienzo = () => ({ lista: [] })
export function pon(L, z, svg) { if (svg) L.lista.push({ z, svg }) }
export function pintar(L) {
  return L.lista.slice().sort((a, b) => b.z - a.z).map((e) => e.svg).join('')
}

const acl = (hex, f) => {
  const c = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.round(((c >> 16) & 255) * f))
  const g = Math.min(255, Math.round(((c >> 8) & 255) * f))
  const b = Math.min(255, Math.round((c & 255) * f))
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

// ── Caja: seis caras, cada una con su sombreado y su descarte por normal ─────
const CARAS = [
  [[0, 1, 2, 3], [0, 0, -1], 0.78], [[5, 4, 7, 6], [0, 0, 1], 0.52],
  [[4, 0, 3, 7], [-1, 0, 0], 0.62], [[1, 5, 6, 2], [1, 0, 0], 0.72],
  [[3, 2, 6, 7], [0, 1, 0], 1.22], [[4, 5, 1, 0], [0, -1, 0], 0.40],
]
export function caja(L, k, c, t, col, borde) {
  const [x, y, z] = c, [w, h, d] = t.map((v) => v / 2)
  const V = [
    [x - w, y - h, z - d], [x + w, y - h, z - d], [x + w, y + h, z - d], [x - w, y + h, z - d],
    [x - w, y - h, z + d], [x + w, y - h, z + d], [x + w, y + h, z + d], [x - w, y + h, z + d],
  ]
  for (const [idx, nor, sh] of CARAS) {
    const cen = idx.reduce((s, i) => [s[0] + V[i][0] / 4, s[1] + V[i][1] / 4, s[2] + V[i][2] / 4], [0, 0, 0])
    const ojo = [cen[0] - k.p[0], cen[1] - k.p[1], cen[2] - k.p[2]]
    if (nor[0] * ojo[0] + nor[1] * ojo[1] + nor[2] * ojo[2] > 0) continue
    const f = cara(idx.map((i) => V[i]), k)
    if (!f) continue
    pon(L, f.z, `<path d="${f.d}" fill="${acl(col, sh)}"${borde ? ` stroke="${borde}" stroke-width=".35"` : ''}/>`)
  }
}
/** Un plano suelto: suelo, muro o techo. Se dibuja solo si mira a la cámara. */
export function plano(L, k, pts, col, nor) {
  const cen = pts.reduce((s, P) => [s[0] + P[0] / pts.length, s[1] + P[1] / pts.length, s[2] + P[2] / pts.length], [0, 0, 0])
  const ojo = [cen[0] - k.p[0], cen[1] - k.p[1], cen[2] - k.p[2]]
  if (nor && nor[0] * ojo[0] + nor[1] * ojo[1] + nor[2] * ojo[2] > 0) return
  const f = cara(pts, k)
  if (f) pon(L, f.z + 40, `<path d="${f.d}" fill="${col}"/>`)
}
/** Disco: veinticuatro puntos de la circunferencia, proyectados uno a uno.
 *  Así un disco de goma es un círculo de frente y una elipse fina de canto,
 *  sin que haya que decidirlo: lo decide la proyección. */
export function disco(L, k, c, r, eje, col, borde) {
  const P = []
  let vz = 0
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * Math.PI * 2, a = r * Math.cos(t), b = r * Math.sin(t)
    const p = eje === 'z' ? [c[0] + a, c[1] + b, c[2]] : [c[0], c[1] + b, c[2] + a]
    const v = vista(p, k)
    if (v[2] < NEAR) return
    vz += v[2] / 24
    P.push(`${i ? 'L' : 'M'} ${n1(pant(v)[0])} ${n1(pant(v)[1])}`)
  }
  pon(L, vz, `<path d="${P.join(' ') + ' Z'}" fill="${col}"${borde ? ` stroke="${borde}" stroke-width="1"` : ''}/>`)
}
/** Cápsula: un tramo de cuerpo o de hierro con grosor real en metros. */
export function capsula(L, k, A, B, rA, rB, col, extra) {
  const va = vista(A, k), vb = vista(B, k)
  if (va[2] < NEAR || vb[2] < NEAR) return
  const pa = pant(va), pb = pant(vb)
  const dx = pb[0] - pa[0], dy = pb[1] - pa[1], m = Math.hypot(dx, dy) || 1
  const ux = -dy / m, uy = dx / m
  const wa = (rA * F) / va[2], wb = (rB * F) / vb[2]
  const d = `M ${n1(pa[0] + ux * wa)} ${n1(pa[1] + uy * wa)} L ${n1(pb[0] + ux * wb)} ${n1(pb[1] + uy * wb)}` +
    ` L ${n1(pb[0] - ux * wb)} ${n1(pb[1] - uy * wb)} L ${n1(pa[0] - ux * wa)} ${n1(pa[1] - uy * wa)} Z`
  const z = (va[2] + vb[2]) / 2
  pon(L, z, `<path d="${d}" fill="${col}"${extra || ''}/>` +
    `<circle cx="${n1(pa[0])}" cy="${n1(pa[1])}" r="${n1(wa)}" fill="${col}"/>` +
    `<circle cx="${n1(pb[0])}" cy="${n1(pb[1])}" r="${n1(wb)}" fill="${col}"/>`)
}
/** Esfera: la cabeza, y las cabezas articulares del esqueleto. */
export function esfera(L, k, c, r, col, extra) {
  const v = vista(c, k)
  if (v[2] < NEAR) return
  const p = pant(v)
  pon(L, v[2], `<ellipse cx="${n1(p[0])}" cy="${n1(p[1])}" rx="${n1((r * F) / v[2])}" ry="${n1((r * 1.18 * F) / v[2])}" fill="${col}"${extra || ''}/>`)
}
/** Trazo del suelo o del muro: las marcas rojas, las juntas, el cableado. */
export function trazo(L, k, A, B, col, ancho, extra) {
  const d = linea3(A, B, k)
  if (!d) return
  const z = (vista(A, k)[2] + vista(B, k)[2]) / 2
  pon(L, z - 0.02, `<path d="${d}" fill="none" stroke="${col}" stroke-width="${ancho}" stroke-linecap="round"${extra || ''}/>`)
}
/** Un fascículo muscular: de origen a inserción, con su panza. */
export function fasciculo(L, k, O, I, curva, col, ancho, op) {
  const vo = vista(O, k), vi = vista(I, k)
  if (vo[2] < NEAR || vi[2] < NEAR) return
  const po = pant(vo), pi = pant(vi)
  const mx = (po[0] + pi[0]) / 2, my = (po[1] + pi[1]) / 2
  const dx = pi[0] - po[0], dy = pi[1] - po[1], m = Math.hypot(dx, dy) || 1
  const cx = mx + (-dy / m) * curva, cy = my + (dx / m) * curva
  const z = (vo[2] + vi[2]) / 2
  pon(L, z, `<path d="M ${n1(po[0])} ${n1(po[1])} Q ${n1(cx)} ${n1(cy)} ${n1(pi[0])} ${n1(pi[1])}" fill="none" ` +
    `stroke="${col}" stroke-width="${n1((ancho * F) / z)}" stroke-linecap="round" stroke-opacity="${op ?? 1}"/>`)
}

/** Una curva definida EN EL ESPACIO: se proyecta punto a punto y se une.
 *  Un arco costal no se puede fingir con una curva de pantalla — al orbitar
 *  tiene que abrirse y cerrarse, y eso solo lo da la proyección. */
export function curva3(L, k, pts, col, ancho, extra) {
  const vs = pts.map((P) => vista(P, k))
  if (vs.some((v) => v[2] < NEAR)) return
  const d = vs.map((v, i) => `${i ? 'L' : 'M'} ${n1(pant(v)[0])} ${n1(pant(v)[1])}`).join(' ')
  const z = vs.reduce((s, v) => s + v[2], 0) / vs.length
  pon(L, z, `<path d="${d}" fill="none" stroke="${col}" stroke-width="${n1((ancho * F) / z)}" ` +
    `stroke-linecap="round" stroke-linejoin="round"${extra || ''}/>`)
}
