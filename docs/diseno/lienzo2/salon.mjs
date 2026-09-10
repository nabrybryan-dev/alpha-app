// ── EL SALÓN: la sala, el hierro, la estación y el sujeto en sus cinco capas ──
import { caja, capsula, curva3, disco, esfera, fasciculo, lienzo, pintar, plano, pon, trazo, vista } from './escena.mjs'

const SALA = { x: 6.0, z: 6.0, alto: 3.55 }
const NEGRO = '#0d1014', MURO = '#141821', SUELO = '#0a0c0f', ROJO = '#ff1e1e'
const ACERO = '#1b2027', GOMA = '#101318', CROMO = '#6f7782'

// ── LA SALA ─────────────────────────────────────────────────────────────────
export function sala(L, k) {
  const { x: X, z: Z, alto: A } = SALA
  plano(L, k, [[-X, 0, -Z], [X, 0, -Z], [X, 0, Z], [-X, 0, Z]], SUELO, [0, 1, 0])
  plano(L, k, [[-X, A, -Z], [-X, A, Z], [X, A, Z], [X, A, -Z]], '#12161f', [0, -1, 0])
  const muros = [
    { p: [[-X, 0, Z], [X, 0, Z], [X, A, Z], [-X, A, Z]], n: [0, 0, -1] },
    { p: [[X, 0, -Z], [-X, 0, -Z], [-X, A, -Z], [X, A, -Z]], n: [0, 0, 1] },
    { p: [[-X, 0, -Z], [-X, 0, Z], [-X, A, Z], [-X, A, -Z]], n: [1, 0, 0] },
    { p: [[X, 0, Z], [X, 0, -Z], [X, A, -Z], [X, A, Z]], n: [-1, 0, 0] },
  ]
  for (const m of muros) plano(L, k, m.p, MURO, m.n)
  // Las juntas del panelado. Es lo que convierte un muro liso en una pared.
  for (let i = -4; i <= 4; i++) {
    trazo(L, k, [i * 1.5, 0, Z], [i * 1.5, A, Z], '#242b36', 0.9)
    trazo(L, k, [-X, 0, i * 1.5], [-X, A, i * 1.5], '#242b36', 0.9)
    trazo(L, k, [X, 0, i * 1.5], [X, A, i * 1.5], '#242b36', 0.9)
  }
  for (const y of [1.2, 2.4]) {
    trazo(L, k, [-X, y, Z], [X, y, Z], '#242b36', 0.9)
    trazo(L, k, [-X, y, -Z], [-X, y, Z], '#242b36', 0.9)
    trazo(L, k, [X, y, -Z], [X, y, Z], '#242b36', 0.9)
  }
  // Las losas del suelo: sin ellas el suelo es una mancha y no un plano.
  for (let i = -5; i <= 5; i++) {
    trazo(L, k, [i, 0.002, -Z], [i, 0.002, Z], '#161b23', 0.9)
    trazo(L, k, [-X, 0.002, i], [X, 0.002, i], '#161b23', 0.9)
  }
  // El rodapié de goma: la línea que separa el muro del suelo.
  for (const m of [[[-X, 0.09, Z], [X, 0.09, Z]], [[-X, 0.09, -Z], [-X, 0.09, Z]], [[X, 0.09, -Z], [X, 0.09, Z]]])
    trazo(L, k, m[0], m[1], '#2b333f', 1.6)

  // Las luminarias del techo, corriendo hacia el fondo.
  for (let i = -3; i <= 3; i++) caja(L, k, [0, A - 0.015, i * 1.5], [2 * X, 0.03, 0.16], '#1a202a')
  for (const x of [-0.92, 0.92]) for (const z of [4.3, 5.75]) caja(L, k, [x, A - 0.04, z], [0.13, 0.05, 0.9], '#e8eef7')
  for (const x of [-2.4, 2.4]) caja(L, k, [x, A - 0.04, 5.0], [0.13, 0.05, 0.9], '#7e8fa4')
  caja(L, k, [0, A - 0.02, 5.3], [4.2, 0.04, 0.09], '#5d6b7d')
  // Las tiras rojas de los muros: el acento, y la única fuente de color de la sala.
  for (const x of [-1.95, 1.95]) caja(L, k, [x, 1.55, Z - 0.06], [0.055, 2.0, 0.05], ROJO)
  for (const z of [1.4, 4.2]) {
    caja(L, k, [-X + 0.06, 1.55, z], [0.05, 2.0, 0.055], ROJO)
    caja(L, k, [X - 0.06, 1.55, z], [0.05, 2.0, 0.055], ROJO)
  }
}

// ── EL HIERRO ───────────────────────────────────────────────────────────────
export function hierro(L, k) {
  // La jaula, detrás del sujeto. Cuatro montantes, travesaños y la barra en los ganchos.
  const jx = 0.72, jz = [2.35, 3.45], top = 2.30
  for (const x of [-jx, jx]) for (const z of jz) {
    caja(L, k, [x, top / 2, z], [0.075, top, 0.075], ACERO, '#2b333f')
    caja(L, k, [x, 0.035, z], [0.16, 0.07, 0.34], '#20262f')
  }
  for (const z of jz) caja(L, k, [0, top, z], [2 * jx, 0.07, 0.075], ACERO)
  for (const x of [-jx, jx]) caja(L, k, [x, top, 2.9], [0.07, 0.07, 1.1], ACERO)
  // Los agujeros del montante: la escala que hace que se lea como un rack.
  for (const x of [-jx, jx]) for (let i = 0; i < 14; i++)
    trazo(L, k, [x - 0.04, 0.55 + i * 0.11, jz[0] - 0.038], [x + 0.04, 0.55 + i * 0.11, jz[0] - 0.038], '#0a0d11', 1.1)
  for (const x of [-jx, jx]) caja(L, k, [x, 1.42, jz[0] - 0.11], [0.06, 0.14, 0.2], '#2a3139')
  // La barra descansando, con sus discos.
  capsula(L, k, [-1.05, 1.46, 2.24], [1.05, 1.46, 2.24], 0.016, 0.016, CROMO)
  for (const s of [-1, 1]) {
    disco(L, k, [s * 0.86, 1.46, 2.24], 0.225, 'x', GOMA, '#39414d')
    disco(L, k, [s * 0.895, 1.46, 2.24], 0.06, 'x', '#4a525e')
  }
  // El árbol de discos, a la derecha, contra el muro.
  caja(L, k, [1.26, 0.6, 4.35], [0.3, 1.2, 0.3], '#191e26')
  for (let i = 0; i < 4; i++) disco(L, k, [1.26, 0.28, 4.05 + i * 0.1], 0.235 - i * 0.012, 'z', GOMA, '#333b46')
  for (let i = 0; i < 3; i++) disco(L, k, [1.26, 0.95, 4.1 + i * 0.1], 0.19 - i * 0.012, 'z', GOMA, '#333b46')
  // El banco, a la izquierda y ligeramente girado hacia el centro.
  caja(L, k, [-1.18, 0.45, 3.9], [0.31, 0.09, 1.18], '#1a1f27', '#2b333f')
  caja(L, k, [-1.18, 0.2, 3.42], [0.1, 0.4, 0.1], '#151a21')
  caja(L, k, [-1.18, 0.2, 4.38], [0.1, 0.4, 0.1], '#151a21')
  caja(L, k, [-1.18, 0.03, 3.9], [0.34, 0.06, 1.3], '#12161c')
  // El soporte de barras, a la derecha y hacia delante: al orbitar el sujeto hay
  // que seguir viendo hierro, o la sala se queda en cuatro paredes vacías.
  caja(L, k, [2.62, 0.06, -1.15], [0.5, 0.12, 0.5], '#191e26')
  caja(L, k, [2.62, 1.05, -1.15], [0.14, 2.1, 0.14], '#1b2027', '#2b333f')
  for (let i = 0; i < 4; i++) {
    const x = 2.42 + (i % 2) * 0.4, z = -1.35 + Math.floor(i / 2) * 0.4
    capsula(L, k, [x, 0.06, z], [x, 2.18, z], 0.016, 0.016, CROMO)
  }
  // La pila de discos del otro lado, para el mismo motivo.
  caja(L, k, [-2.45, 0.05, -2.5], [0.6, 0.1, 0.6], '#191e26')
  for (let i = 0; i < 5; i++) disco(L, k, [-2.45, 0.28, -2.75 + i * 0.11], 0.235 - i * 0.008, 'z', GOMA, '#333b46')
  // Las mancuernas del fondo: dos filas cortas sobre su soporte.
  caja(L, k, [-1.85, 0.42, 5.5], [1.5, 0.1, 0.34], '#171c23')
  caja(L, k, [-1.85, 0.16, 5.5], [1.5, 0.08, 0.4], '#141920')
  for (let i = 0; i < 5; i++) {
    const x = -2.45 + i * 0.3
    capsula(L, k, [x, 0.52, 5.5], [x, 0.52, 5.5], 0.055, 0.055, '#232a33')
    disco(L, k, [x, 0.52, 5.38], 0.075, 'z', '#2b333f')
  }
}

// ── LA BAHÍA: las marcas rojas del suelo y la estación de grabación ─────────
export function bahia(L, k, { estacion = true } = {}) {
  const fino = ' stroke-opacity=".55"'
  // El eje de la bahía y sus dos carriles.
  trazo(L, k, [0, 0.004, -2.2], [0, 0.004, 4.6], ROJO, 1.1, ' stroke-opacity=".35" stroke-dasharray="7 6"')
  for (const s of [-1, 1]) trazo(L, k, [s * 0.62, 0.004, -1.6], [s * 0.62, 0.004, 3.4], ROJO, 1.2, fino)
  // El cajón de los pies: donde se pisa para que la medida valga.
  const c = [[-0.34, -0.3], [0.34, -0.3], [0.34, 0.26], [-0.34, 0.26]]
  for (let i = 0; i < 4; i++) trazo(L, k, [c[i][0], 0.005, c[i][1]], [c[(i + 1) % 4][0], 0.005, c[(i + 1) % 4][1]], ROJO, 1.6)
  trazo(L, k, [-0.34, 0.005, -0.02], [0.34, 0.005, -0.02], ROJO, 1, ' stroke-opacity=".4"')
  // Los travesaños de distancia, que es lo que hace medible el suelo.
  for (let i = 0; i < 5; i++) {
    const z = 0.7 + i * 0.85
    trazo(L, k, [-0.9, 0.004, z], [-0.55, 0.004, z], ROJO, 1, fino)
    trazo(L, k, [0.55, 0.004, z], [0.9, 0.004, z], ROJO, 1, fino)
  }
  if (!estacion) return
  // LA ESTACIÓN: donde va el móvil de verdad. Su marca, sus patas y la cámara.
  const ex = -0.68, ez = -0.30, ey = 1.05
  const m = []
  for (let i = 0; i <= 24; i++) {
    const t = (i / 24) * Math.PI * 2
    m.push([ex + 0.34 * Math.cos(t), 0.005, ez + 0.34 * Math.sin(t)])
  }
  for (let i = 0; i < 24; i++) trazo(L, k, m[i], m[i + 1], ROJO, 1.2, ' stroke-opacity=".5"')
  trazo(L, k, [0, 0.005, 0], [ex, 0.005, ez], ROJO, 1, ' stroke-opacity=".3" stroke-dasharray="4 5"')
  for (const a of [0, 2.094, 4.189]) {
    capsula(L, k, [ex + 0.36 * Math.sin(a), 0.01, ez + 0.36 * Math.cos(a)], [ex, ey - 0.16, ez], 0.017, 0.026, '#242b34')
  }
  capsula(L, k, [ex, ey - 0.16, ez], [ex, ey, ez], 0.028, 0.024, '#2c3440')
  caja(L, k, [ex, ey + 0.11, ez], [0.085, 0.185, 0.022], '#10141a', ROJO)
  disco(L, k, [ex, ey + 0.14, ez - 0.014], 0.021, 'z', '#05070a', '#3c4552')
}

// ── EL SUJETO ───────────────────────────────────────────────────────────────
// Una prescripción anatómica: el mismo esqueleto en las cinco capas del eje W.
export const J = {
  pelvis: [0, 0.98, 0], sacro: [0, 1.02, -0.05],
  caderaI: [-0.105, 0.95, 0], caderaD: [0.105, 0.95, 0],
  rodillaI: [-0.115, 0.52, 0.025], rodillaD: [0.115, 0.52, 0.025],
  tobilloI: [-0.11, 0.095, -0.005], tobilloD: [0.11, 0.095, -0.005],
  talonI: [-0.11, 0.045, -0.075], talonD: [0.11, 0.045, -0.075],
  pieI: [-0.108, 0.03, 0.115], pieD: [0.108, 0.03, 0.115],
  lumbar: [0, 1.21, -0.025], torax: [0, 1.42, -0.035], esternon: [0, 1.34, 0.075],
  cuello: [0, 1.545, -0.03], craneo: [0, 1.665, -0.015],
  hombroI: [-0.195, 1.475, -0.02], hombroD: [0.195, 1.475, -0.02],
  codoI: [-0.245, 1.17, 0.0], codoD: [0.245, 1.17, 0.0],
  munecaI: [-0.265, 0.875, 0.025], munecaD: [0.265, 0.875, 0.025],
  manoI: [-0.272, 0.755, 0.04], manoD: [0.272, 0.755, 0.04],
}
const PIEL = '#2c333e', PIEL_L = '#353d4a', TELA = '#232932'
const AGO = '#d9302c', SIN = '#c2564a', PAS = '#8d8378', HUESO = '#cfc9bd', TENDON = '#e2ded4'

/**
 * La piel: el sujeto vestido, que es el escalón 0 del eje W.
 *
 * `infl` engorda cada radio para dibujar el contraluz: la misma silueta un pelo
 * más gorda, en un tono claro y DETRÁS del cuerpo. Es lo que despega la figura de
 * una sala que es igual de oscura que ella.
 */
export function piel(L, k, { infl = 0, col } = {}) {
  const o = ''
  const t = (base) => col || base
  const c = (a, b, ra, rb, base) => capsula(L, k, J[a], J[b], ra + infl, rb + infl, t(base), o)
  c('caderaI', 'rodillaI', 0.079, 0.050, TELA); c('caderaD', 'rodillaD', 0.079, 0.050, TELA)
  c('rodillaI', 'tobilloI', 0.050, 0.031, TELA); c('rodillaD', 'tobilloD', 0.050, 0.031, TELA)
  c('talonI', 'pieI', 0.034, 0.022, t('#12161d')); c('talonD', 'pieD', 0.034, 0.022, t('#12161d'))
  for (const s of ['I', 'D']) caja(L, k, [J['pie' + s][0], 0.018, 0.02], [0.093, 0.036, 0.255], t('#171c24'))
  c('caderaI', 'caderaD', 0.079, 0.079, PIEL)
  c('pelvis', 'lumbar', 0.098, 0.092, PIEL)
  c('lumbar', 'torax', 0.094, 0.128, PIEL_L)
  c('hombroI', 'hombroD', 0.046, 0.046, PIEL_L)
  c('torax', 'cuello', 0.046, 0.037, PIEL)
  c('hombroI', 'codoI', 0.046, 0.032, PIEL); c('hombroD', 'codoD', 0.046, 0.032, PIEL)
  c('codoI', 'munecaI', 0.032, 0.023, PIEL); c('codoD', 'munecaD', 0.032, 0.023, PIEL)
  c('munecaI', 'manoI', 0.026, 0.021, PIEL_L); c('munecaD', 'manoD', 0.026, 0.021, PIEL_L)
  esfera(L, k, J.craneo, 0.085 + infl, t(PIEL_L), o)
}

// Los músculos, como haces de origen a inserción. `papel` es la prescripción:
// qué pide este patrón de cada uno, no una etiqueta de anatomía.
const SUPERFICIAL = [
  ['Recto femoral', 'caderaD', 'cuadI_D', 3, 'ago', 0.028, 3],
  ['Recto femoral', 'caderaI', 'cuadI_I', -3, 'ago', 0.028, 3],
  ['Vasto lateral', 'caderaD', 'cuadI_D', 9, 'ago', 0.024, 3],
  ['Vasto lateral', 'caderaI', 'cuadI_I', -9, 'ago', 0.024, 3],
  ['Vasto medial', 'caderaD', 'cuadI_D', -5, 'ago', 0.020, 2],
  ['Vasto medial', 'caderaI', 'cuadI_I', 5, 'ago', 0.020, 2],
  ['Glúteo mayor', 'glutO_D', 'glutI_D', 5, 'ago', 0.036, 4],
  ['Glúteo mayor', 'glutO_I', 'glutI_I', -5, 'ago', 0.036, 4],
  ['Isquiosurales', 'glutO_D', 'isqI_D', -4, 'sin', 0.026, 3],
  ['Isquiosurales', 'glutO_I', 'isqI_I', 4, 'sin', 0.026, 3],
  ['Gastrocnemio', 'rodillaD', 'pantI_D', -4, 'sin', 0.024, 3],
  ['Gastrocnemio', 'rodillaI', 'pantI_I', 4, 'sin', 0.024, 3],
  ['Tibial anterior', 'rodillaD', 'tobilloD', 5, 'pas', 0.011, 1],
  ['Tibial anterior', 'rodillaI', 'tobilloI', -5, 'pas', 0.011, 1],
  ['Erector espinal', 'sacro', 'torax', 5, 'sin', 0.017, 3],
  ['Erector espinal', 'sacro', 'torax', -5, 'sin', 0.017, 3],
  ['Dorsal ancho', 'dorsO', 'dorsI_D', 7, 'sin', 0.030, 4],
  ['Dorsal ancho', 'dorsO', 'dorsI_I', -7, 'sin', 0.030, 4],
  ['Trapecio', 'cuello', 'hombroD', 5, 'sin', 0.024, 2],
  ['Trapecio', 'cuello', 'hombroI', -5, 'sin', 0.024, 2],
  ['Deltoides', 'hombroD', 'delI_D', 6, 'pas', 0.022, 3],
  ['Deltoides', 'hombroI', 'delI_I', -6, 'pas', 0.022, 3],
  ['Pectoral', 'esternon', 'hombroD', 5, 'pas', 0.021, 2],
  ['Pectoral', 'esternon', 'hombroI', -5, 'pas', 0.021, 2],
  ['Recto abdominal', 'esternon', 'pelvis', 3, 'sin', 0.016, 2],
  ['Recto abdominal', 'esternon', 'pelvis', -3, 'sin', 0.016, 2],
  ['Bíceps braquial', 'hombroD', 'bicI_D', 4, 'pas', 0.016, 2],
  ['Bíceps braquial', 'hombroI', 'bicI_I', -4, 'pas', 0.016, 2],
]
const PROFUNDO = [
  ['Psoas ilíaco', 'torax', 'caderaD', 7, 'ago', 0.017, 3],
  ['Psoas ilíaco', 'torax', 'caderaI', -7, 'ago', 0.017, 3],
  ['Glúteo medio', 'glutO_D', 'caderaD', 11, 'ago', 0.024, 3],
  ['Glúteo medio', 'glutO_I', 'caderaI', -11, 'ago', 0.024, 3],
  ['Aductor mayor', 'pelvis', 'isqI_D', -5, 'sin', 0.022, 3],
  ['Aductor mayor', 'pelvis', 'isqI_I', 5, 'sin', 0.022, 3],
  ['Sóleo', 'rodillaD', 'pantI_D', 3, 'sin', 0.018, 2],
  ['Sóleo', 'rodillaI', 'pantI_I', -3, 'sin', 0.018, 2],
  ['Multífidos', 'sacro', 'torax', 2, 'sin', 0.012, 4],
  ['Multífidos', 'sacro', 'torax', -2, 'sin', 0.012, 4],
  ['Cuadrado lumbar', 'pelvis', 'torax', 9, 'sin', 0.014, 2],
  ['Cuadrado lumbar', 'pelvis', 'torax', -9, 'sin', 0.014, 2],
  ['Transverso', 'lumbar', 'esternon', 11, 'sin', 0.012, 2],
  ['Transverso', 'lumbar', 'esternon', -11, 'sin', 0.012, 2],
  ['Serrato', 'esternon', 'hombroD', 12, 'pas', 0.011, 3],
  ['Serrato', 'esternon', 'hombroI', -12, 'pas', 0.011, 3],
  ['Tibial posterior', 'rodillaD', 'tobilloD', -3, 'pas', 0.009, 1],
  ['Tibial posterior', 'rodillaI', 'tobilloI', 3, 'pas', 0.009, 1],
]
const COLOR = { ago: AGO, sin: SIN, pas: PAS }

/** Un origen o una inserción puede no ser una articulación: el glúteo no nace en
 *  el sacro exacto ni acaba en el eje del fémur. Estos son los puntos que faltan. */
const P = {
  glutO_D: [0.055, 1.045, -0.075], glutO_I: [-0.055, 1.045, -0.075],
  glutI_D: [0.135, 0.795, -0.055], glutI_I: [-0.135, 0.795, -0.055],
  isqI_D: [0.125, 0.545, -0.045], isqI_I: [-0.125, 0.545, -0.045],
  dorsO: [0, 1.115, -0.06], dorsI_D: [0.155, 1.40, -0.03], dorsI_I: [-0.155, 1.40, -0.03],
  pantI_D: [0.115, 0.185, -0.075], pantI_I: [-0.115, 0.185, -0.075],
  cuadI_D: [0.115, 0.575, 0.075], cuadI_I: [-0.115, 0.575, 0.075],
  bicI_D: [0.248, 1.115, 0.02], bicI_I: [-0.248, 1.115, 0.02],
  delI_D: [0.232, 1.30, 0.0], delI_I: [-0.232, 1.30, 0.0],
}
const pt = (n) => P[n] || J[n]

export function musculos(L, k, capa) {
  const lista = capa === 'profundo' ? PROFUNDO : SUPERFICIAL
  for (const [, o, i, curva, papel, ancho, haces] of lista) {
    const A = pt(o), B = pt(i)
    for (let h = 0; h < haces; h++) {
      const t = haces === 1 ? 0 : h / (haces - 1) - 0.5
      // Los haces se abren a lo ancho DEL MÚSCULO y cada uno tiene grosor: un
      // músculo es un vientre, no un cable, y a dos metros eso es lo que se ve.
      const O = [A[0] + t * ancho * 1.7, A[1], A[2] + t * ancho * 0.7]
      const I = [B[0] + t * ancho * 1.15, B[1], B[2] + t * ancho * 0.5]
      fasciculo(L, k, O, I, curva + t * 3, COLOR[papel], (ancho * 1.5) / haces,
        papel === 'ago' ? 0.95 : papel === 'sin' ? 0.8 : 0.5)
    }
  }
}

/** Tendón y tejido pasivo: lo que transmite, no lo que tira. */
export function tendones(L, k) {
  const t = (a, b, r, curva) => fasciculo(L, k, Array.isArray(a) ? a : J[a], Array.isArray(b) ? b : J[b], curva || 0, TENDON, r, 0.9)
  for (const s of ['D', 'I']) {
    t('cadera' + s, [J['rodilla' + s][0], J['rodilla' + s][1] + 0.05, 0.07], 0.009, s === 'D' ? 3 : -3) // cuadricipital
    t([J['rodilla' + s][0], J['rodilla' + s][1] - 0.01, 0.075], [J['tobillo' + s][0], J['tobillo' + s][1] + 0.28, 0.05], 0.011) // rotuliano
    t('rodilla' + s, 'talon' + s, 0.01, s === 'D' ? -4 : 4) // aquíleo
    t('cadera' + s, 'rodilla' + s, 0.007, s === 'D' ? 16 : -16) // banda iliotibial
    t('hombro' + s, 'codo' + s, 0.006, s === 'D' ? 9 : -9)
    // La cápsula de la rodilla y sus cruzados, que es donde se paga el rango.
    esfera(L, k, J['rodilla' + s], 0.052, 'none', ` stroke="${TENDON}" stroke-width="1" stroke-opacity=".55"`)
    esfera(L, k, J['tobillo' + s], 0.04, 'none', ` stroke="${TENDON}" stroke-width=".9" stroke-opacity=".45"`)
    esfera(L, k, J['cadera' + s], 0.056, 'none', ` stroke="${TENDON}" stroke-width="1" stroke-opacity=".5"`)
  }
  t('sacro', 'torax', 0.013, 0) // fascia toracolumbar
  t('sacro', 'caderaD', 0.008, 6); t('sacro', 'caderaI', 0.008, -6)
  t('esternon', 'hombroD', 0.007, 4); t('esternon', 'hombroI', 0.007, -4)
}

/** El hueso: el escalón 4, y el único que no se puede discutir. */
export function huesos(L, k) {
  const c = (a, b, ra, rb) => capsula(L, k, Array.isArray(a) ? a : J[a], Array.isArray(b) ? b : J[b], ra, rb, HUESO)
  // Fémur, tibia y peroné.
  for (const s of ['D', 'I']) {
    c('cadera' + s, 'rodilla' + s, 0.031, 0.035)
    esfera(L, k, J['cadera' + s], 0.032, HUESO)
    c([J['rodilla' + s][0], J['rodilla' + s][1], J['rodilla' + s][2]], 'tobillo' + s, 0.027, 0.019)
    c([J['rodilla' + s][0] + (s === 'D' ? 0.03 : -0.03), J['rodilla' + s][1] - 0.03, J['rodilla' + s][2] - 0.01], 'tobillo' + s, 0.012, 0.011)
    esfera(L, k, [J['rodilla' + s][0], J['rodilla' + s][1] - 0.005, J['rodilla' + s][2] + 0.055], 0.026, '#e6e0d4') // rótula
    c('talon' + s, 'pie' + s, 0.026, 0.017)
    c('tobillo' + s, 'talon' + s, 0.021, 0.024)
    // Húmero, cúbito y radio.
    c('hombro' + s, 'codo' + s, 0.022, 0.018); esfera(L, k, J['hombro' + s], 0.026, HUESO)
    c('codo' + s, 'muneca' + s, 0.014, 0.011)
    c([J['codo' + s][0] + (s === 'D' ? 0.022 : -0.022), J['codo' + s][1] - 0.02, J['codo' + s][2] + 0.015], 'muneca' + s, 0.012, 0.01)
    c('muneca' + s, 'mano' + s, 0.019, 0.015)
    // Clavícula y escápula.
    c('esternon', [J['hombro' + s][0] * 0.85, J['hombro' + s][1] + 0.03, J['hombro' + s][2] + 0.03], 0.011, 0.013)
  }
  // La pelvis: dos palas y el sacro.
  for (const s of [-1, 1]) {
    capsula(L, k, [s * 0.02, 1.06, -0.035], [s * 0.135, 1.03, 0.02], 0.038, 0.028, HUESO)
    capsula(L, k, [s * 0.135, 1.03, 0.02], [s * 0.09, 0.93, 0.03], 0.028, 0.026, HUESO)
    capsula(L, k, [s * 0.09, 0.93, 0.03], [s * 0.03, 0.9, 0.0], 0.024, 0.022, HUESO)
  }
  // La columna, vértebra a vértebra: es lo que hace que el tronco tenga eje.
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    const y = 1.02 + t * 0.53
    const z = -0.05 + Math.sin(t * Math.PI) * 0.035 - t * 0.005
    caja(L, k, [0, y, z], [0.052 - t * 0.014, 0.022, 0.036], '#d6d0c4')
  }
  // La caja torácica: siete pares de arcos que salen de la columna al esternón.
  for (let i = 0; i < 8; i++) {
    const t = i / 7
    const y0 = 1.47 - t * 0.25
    // Cada costilla es media elipse: de la vértebra al esternón, abriéndose de
    // lado. Ancha en el cuarto par y más corta arriba y abajo, como la real.
    const rx = 0.046 + Math.sin((0.22 + t * 0.7) * Math.PI) * 0.066
    const rz = 0.026 + Math.sin((0.22 + t * 0.7) * Math.PI) * 0.036
    for (const s of [-1, 1]) {
      const pts = []
      for (let j = 0; j <= 10; j++) {
        const a = (j / 10) * Math.PI
        // La caída hacia el esternón es MENOR que la distancia entre dos costillas:
        // si no, cada arco se cruza con el de abajo y el tórax sale hecho un muelle.
        pts.push([s * rx * Math.sin(a), y0 - 0.026 * (a / Math.PI), -0.052 + rz * (1 - Math.cos(a))])
      }
      curva3(L, k, pts, HUESO, 0.0092, ' stroke-opacity=".92"')
    }
  }
  capsula(L, k, [0, 1.395, 0.075], [0, 1.26, 0.065], 0.026, 0.019, HUESO) // esternón
  c('torax', 'cuello', 0.02, 0.018)
  esfera(L, k, [J.craneo[0], J.craneo[1], J.craneo[2]], 0.088, HUESO)
  esfera(L, k, [0, 1.615, 0.055], 0.055, '#e6e0d4') // macizo facial
}

/** La cadena cinética: de dónde sale la fuerza y por dónde baja al suelo. */
export function cadena(L, k) {
  const P = [[0, 1.46, 0.0], J.torax, J.lumbar, J.pelvis, J.caderaD, J.rodillaD, J.tobilloD, [J.pieD[0], 0.01, 0.0]]
  for (let i = 0; i < P.length - 1; i++) trazo(L, k, P[i], P[i + 1], ROJO, 2.2, ' stroke-opacity=".9"')
  const Q = [J.pelvis, J.caderaI, J.rodillaI, J.tobilloI, [J.pieI[0], 0.01, 0.0]]
  for (let i = 0; i < Q.length - 1; i++) trazo(L, k, Q[i], Q[i + 1], ROJO, 2.2, ' stroke-opacity=".9"')
  for (const j of ['torax', 'lumbar', 'pelvis', 'caderaD', 'caderaI', 'rodillaD', 'rodillaI', 'tobilloD', 'tobilloI'])
    esfera(L, k, J[j], 0.018, ROJO)
  // La vertical de la carga y los dos brazos de momento que se pagan.
  trazo(L, k, [0, 1.62, 0.0], [0, 0.005, 0.0], '#ffffff', 1, ' stroke-opacity=".35" stroke-dasharray="5 5"')
  trazo(L, k, [0, J.rodillaD[1], 0.0], J.rodillaD, ROJO, 1.4, ' stroke-opacity=".6"')
  trazo(L, k, [0, J.caderaD[1], 0.0], J.caderaD, ROJO, 1.4, ' stroke-opacity=".6"')
}

/** La barra sobre los trapecios: el implemento va con el sujeto, no con la sala. */
export function barraEnEspalda(L, k) {
  capsula(L, k, [-1.05, 1.5, -0.055], [1.05, 1.5, -0.055], 0.016, 0.016, CROMO)
  for (const s of [-1, 1]) {
    disco(L, k, [s * 0.85, 1.5, -0.055], 0.225, 'x', GOMA, '#39414d')
    disco(L, k, [s * 0.885, 1.5, -0.055], 0.058, 'x', '#4a525e')
  }
}

export { lienzo, pintar, pon, vista }
