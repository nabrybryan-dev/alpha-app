/**
 * Geometría ósea del visor.
 *
 * Se construye UNA vez, en el espacio local de cada hueso, y después el shader
 * la mueve con la matriz correspondiente. Por eso el esqueleto no cuesta nada
 * aunque la pose cambie sesenta veces por segundo.
 */

import { entre, grados, M4, type Vec3 } from './algebra'
import { COLOR_HUESO, COLOR_HUESO_OSCURO, INDICE_HUESO, LADO, type Lado } from './esqueleto'
import { curva, elipsoide, huesoLargo, Malla, tubo } from './malla'

export function construirHuesos(): Malla {
  const m = new Malla()
  const H = (n: string): number => INDICE_HUESO[n]
  const lados: Lado[] = ['D', 'I']

  // --- Pelvis: palas ilíacas, sacro y ramas isquiopubianas -----------------
  const bp = H('pelvis')
  for (const k of [-1, 1]) {
    elipsoide(m, [k * 0.085, 0.035, -0.012], [0.062, 0.075, 0.032], {
      hueso: bp,
      color: COLOR_HUESO,
      su: 12,
      sv: 8,
      giro: M4.multiplicar(M4.girarZ(k * grados(14)), M4.girarY(k * grados(-26))),
    })
    // Isquion: el punto sobre el que el sujeto se sienta. Es la referencia
    // visual que hace legible la bisagra de cadera.
    elipsoide(m, [k * 0.062, -0.062, -0.018], [0.028, 0.03, 0.026], {
      hueso: bp,
      color: COLOR_HUESO_OSCURO,
      su: 10,
      sv: 7,
    })
    tubo(
      m,
      curva([[k * 0.055, -0.055, -0.01], [k * 0.048, -0.058, 0.03], [k * 0.012, -0.04, 0.052]], 8),
      () => 0.011,
      { hueso: bp, color: COLOR_HUESO, radial: 7 },
    )
  }
  elipsoide(m, [0, 0.005, -0.052], [0.036, 0.07, 0.026], {
    hueso: bp,
    color: COLOR_HUESO_OSCURO,
    su: 10,
    sv: 8,
  })

  // --- Columna: cuerpos vertebrales y apófisis espinosas -------------------
  const tramoColumna = (hueso: string, n: number, largo: number, r0: number, r1: number, atras: number) => {
    const b = H(hueso)
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      const y = t * largo
      const r = entre(r0, r1, t)
      elipsoide(m, [0, y, -0.008], [r, (largo / n) * 0.36, r * 0.86], {
        hueso: b,
        color: COLOR_HUESO,
        su: 10,
        sv: 6,
      })
      tubo(
        m,
        curva([[0, y, -0.02], [0, y - (largo / n) * 0.25, -0.02 - atras]], 5),
        (u) => 0.01 * (1 - u * 0.45),
        { hueso: b, color: COLOR_HUESO_OSCURO, radial: 6 },
      )
    }
  }
  tramoColumna('lumbar', 5, 0.17, 0.026, 0.023, 0.03)
  tramoColumna('torax', 12, 0.27, 0.022, 0.017, 0.026)
  tramoColumna('cuello', 7, 0.08, 0.015, 0.013, 0.014)

  // --- Caja torácica: doce pares de costillas y esternón -------------------
  const bt = H('torax')
  for (let i = 0; i < 12; i++) {
    const t = i / 11
    const y = 0.245 - t * 0.215
    // El tórax alcanza su mayor anchura hacia la séptima costilla y se cierra
    // abajo; las dos últimas quedan flotantes.
    const apertura = Math.sin((0.3 + t * 0.62) * Math.PI)
    const w = 0.055 + apertura * 0.088
    const p = 0.042 + apertura * 0.055
    const caida = 0.03 + t * 0.055
    const flotante = i >= 10
    for (const k of [-1, 1]) {
      const trazado: Vec3[] = [
        [k * 0.02, y, -0.03],
        [k * w * 0.75, y - caida * 0.18, -p * 0.72],
        [k * w, y - caida * 0.52, 0],
        [k * w * (flotante ? 0.72 : 0.56), y - caida * 0.86, p * 0.62],
        flotante ? [k * w * 0.5, y - caida * 1.02, p * 0.8] : [k * 0.019, y - caida, p * 0.9],
      ]
      tubo(m, curva(trazado, 16), (u) => 0.0088 * (1 - u * 0.22), {
        hueso: bt,
        color: COLOR_HUESO,
        radial: 6,
        aplanar: 0.62,
      })
    }
  }
  tubo(
    m,
    curva([[0, 0.238, 0.082], [0, 0.185, 0.094], [0, 0.11, 0.092], [0, 0.055, 0.079]], 10),
    (u) => entre(0.02, 0.011, u),
    { hueso: bt, color: COLOR_HUESO, radial: 8, aplanar: 0.42 },
  )

  // --- Cráneo y mandíbula --------------------------------------------------
  const bc = H('craneo')
  elipsoide(m, [0, 0.082, -0.008], [0.072, 0.088, 0.079], { hueso: bc, color: COLOR_HUESO, su: 16, sv: 12 })
  elipsoide(m, [0, 0.055, 0.032], [0.052, 0.052, 0.05], { hueso: bc, color: COLOR_HUESO, su: 12, sv: 9 })
  tubo(
    m,
    curva(
      [
        [-0.044, 0.052, 0.002],
        [-0.038, 0.016, 0.042],
        [0, 0.01, 0.062],
        [0.038, 0.016, 0.042],
        [0.044, 0.052, 0.002],
      ],
      14,
    ),
    () => 0.01,
    { hueso: bc, color: COLOR_HUESO_OSCURO, radial: 6 },
  )

  // --- Cintura escapular ---------------------------------------------------
  for (const s of lados) {
    huesoLargo(m, [0, 0.012, 0], [0, 0.155, 0], 0.0105, {
      hueso: H('clavicula' + s),
      color: COLOR_HUESO,
      epifisisA: 1.5,
      epifisisB: 1.7,
      arqueo: 0.016,
    })
    const be = H('escapula' + s)
    tubo(m, curva([[0, 0.012, 0], [0.012, 0.062, -0.004], [0.004, 0.125, -0.006]], 9), (u) => entre(0.04, 0.017, u), {
      hueso: be,
      color: COLOR_HUESO,
      radial: 9,
      aplanar: 0.3,
    })
    tubo(m, curva([[-0.03, 0.03, -0.014], [0.006, 0.048, -0.02], [0.038, 0.052, -0.014]], 8), () => 0.011, {
      hueso: be,
      color: COLOR_HUESO_OSCURO,
      radial: 6,
      aplanar: 0.55,
    })
  }

  // --- Miembro superior ----------------------------------------------------
  for (const s of lados) {
    const k = LADO[s]
    huesoLargo(m, [0, 0.005, 0], [0, 0.31, 0], 0.0155, {
      hueso: H('brazo' + s),
      color: COLOR_HUESO,
      epifisisA: 1.9,
      epifisisB: 1.7,
    })
    // Cabeza humeral: la esfera que hace legible el hombro al orbitar.
    elipsoide(m, [0, 0.008, -0.004], [0.028, 0.028, 0.027], {
      hueso: H('brazo' + s),
      color: COLOR_HUESO,
      su: 12,
      sv: 9,
    })
    // Radio y cúbito por separado: así se ve la pronosupinación.
    huesoLargo(m, [k * 0.013, 0.004, 0], [k * 0.007, 0.26, 0.004], 0.0105, {
      hueso: H('antebrazo' + s),
      color: COLOR_HUESO,
      epifisisA: 1.9,
      epifisisB: 1.5,
    })
    huesoLargo(m, [-k * 0.013, 0.006, -0.004], [-k * 0.009, 0.255, 0], 0.0098, {
      hueso: H('antebrazo' + s),
      color: COLOR_HUESO,
      epifisisA: 1.5,
      epifisisB: 1.8,
    })
    const bm = H('mano' + s)
    elipsoide(m, [0, 0.022, 0], [0.03, 0.026, 0.014], { hueso: bm, color: COLOR_HUESO, su: 10, sv: 7 })
    for (let f = 0; f < 4; f++) {
      const x = (f - 1.5) * 0.013
      // Los dedos rectos y en abanico son de lo que más delata a un maniquí. En
      // reposo la mano los tiene curvados, y el meñique más que el índice.
      const cierre = 0.55 + f * 0.16
      tubo(
        m,
        curva(
          [
            [x, 0.034, 0],
            [x * 1.06, 0.07, 0.01 + cierre * 0.014],
            [x * 1.08, 0.096, 0.008 + cierre * 0.038],
            [x * 1.06, 0.108, -0.004 + cierre * 0.05],
          ],
          10,
        ),
        (u) => entre(0.0062, 0.004, u),
        { hueso: bm, color: COLOR_HUESO, radial: 5 },
      )
    }
    tubo(
      m,
      curva([[-k * 0.022, 0.026, 0.012], [-k * 0.038, 0.048, 0.032], [-k * 0.036, 0.066, 0.048]], 8),
      (u) => entre(0.0066, 0.0046, u),
      { hueso: bm, color: COLOR_HUESO, radial: 5 },
    )
  }

  // --- Miembro inferior ----------------------------------------------------
  for (const s of lados) {
    const k = LADO[s]
    const bmu = H('muslo' + s)
    // Cuello femoral: sale del eje, y por eso la cadera se lee como bisagra.
    elipsoide(m, [k * 0.03, -0.005, 0], [0.03, 0.03, 0.029], { hueso: bmu, color: COLOR_HUESO, su: 12, sv: 9 })
    tubo(m, curva([[k * 0.028, -0.004, 0], [k * 0.012, 0.03, -0.002], [0, 0.062, 0]], 7), (u) => entre(0.02, 0.017, u), {
      hueso: bmu,
      color: COLOR_HUESO,
      radial: 8,
    })
    huesoLargo(m, [0, 0.055, 0], [0, 0.45, 0], 0.019, {
      hueso: bmu,
      color: COLOR_HUESO,
      epifisisA: 1.25,
      epifisisB: 2.0,
      arqueo: 0.01,
    })
    const bti = H('tibia' + s)
    huesoLargo(m, [k * 0.01, 0.006, 0], [k * 0.006, 0.425, 0], 0.0165, {
      hueso: bti,
      color: COLOR_HUESO,
      epifisisA: 2.1,
      epifisisB: 1.7,
    })
    huesoLargo(m, [-k * 0.026, 0.02, -0.006], [-k * 0.026, 0.418, -0.004], 0.0082, {
      hueso: bti,
      color: COLOR_HUESO,
      epifisisA: 1.5,
      epifisisB: 1.9,
    })
    // Rótula: marca la extensión de rodilla de un vistazo.
    elipsoide(m, [0, 0.012, 0.03], [0.022, 0.026, 0.012], { hueso: bti, color: COLOR_HUESO_OSCURO, su: 10, sv: 7 })
    const bpi = H('pie' + s)
    elipsoide(m, [0, 0.022, -0.028], [0.028, 0.026, 0.034], { hueso: bpi, color: COLOR_HUESO, su: 10, sv: 8 })
    for (let f = 0; f < 5; f++) {
      const x = (f - 2) * 0.014
      tubo(
        m,
        curva([[x * 0.55, 0.04, -0.012], [x, 0.115, -0.026], [x * 1.15, 0.185, -0.03]], 8),
        (u) => entre(0.0085, 0.0058, u),
        { hueso: bpi, color: COLOR_HUESO, radial: 5 },
      )
    }
  }
  return m
}
