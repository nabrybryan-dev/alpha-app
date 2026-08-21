/**
 * Encoder de cámara · fase 1 — el núcleo de cálculo.
 *
 * Aquí no hay DOM ni cámara a propósito: son funciones puras sobre números.
 * Es el código que, si la fase 2 sale en verde, se muda casi tal cual a
 * `app/src/domain/velocidad.ts` con sus tests de vitest.
 *
 * Plan → wiki/motor-velocidad/plan-camara-encoder.md §7 (cadena de señal).
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1 · Color: detección del marcador
// ─────────────────────────────────────────────────────────────────────────────

/** RGB 0-255 → HSV con h en grados 0-360, s y v en 0-1. */
export function rgbAHsv(r, g, b) {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6)
    else if (max === gn) h = 60 * ((bn - rn) / d + 2)
    else h = 60 * ((rn - gn) / d + 4)
  }
  if (h < 0) h += 360
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

/** Distancia angular entre dos tonos, en grados (0-180). El tono es circular. */
export function distanciaTono(a, b) {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/**
 * Píxeles que casan con el color del marcador.
 *
 * `paso` submuestrea la imagen: con paso 2 se miran la cuarta parte de los
 * píxeles. La precisión del centroide apenas sufre —se promedian cientos de
 * píxeles— y el bucle baja de ~5 ms a ~1 ms, que es lo que permite ir a 60 fps
 * en un teléfono de gama media.
 */
export function pixelesQueCasan(datos, ancho, alto, objetivo, opciones = {}) {
  const { tolTono = 22, minSat = 0.35, minVal = 0.25, paso = 2 } = opciones
  const xs = [], ys = []
  for (let y = 0; y < alto; y += paso) {
    for (let x = 0; x < ancho; x += paso) {
      const i = (y * ancho + x) * 4
      const r = datos[i], g = datos[i + 1], b = datos[i + 2]
      // Pre-filtro barato: lo oscuro no puede ser un marcador saturado.
      if (r < 45 && g < 45 && b < 45) continue
      const hsv = rgbAHsv(r, g, b)
      if (hsv.s < minSat || hsv.v < minVal) continue
      if (distanciaTono(hsv.h, objetivo.h) > tolTono) continue
      xs.push(x); ys.push(y)
    }
  }
  return { xs, ys, n: xs.length }
}

/**
 * Centroide del color dentro de una ventana alrededor de un punto.
 *
 * Existe para los vídeos, donde puede haber **más de un objeto del mismo
 * color** en el encuadre —dos cosas soltadas en la misma toma, por ejemplo— y
 * la nube global los mezclaría en un único centroide a mitad de camino entre
 * los dos, que no es donde está ninguno.
 *
 * La ventana es además la misma reja de plausibilidad que usa el disco: si el
 * objeto no aparece donde la física dice que debería, es que no es el objeto.
 */
export function centroideEnVentana(datos, ancho, alto, objetivo, centro, radio, opciones = {}) {
  const { tolTono = 22, minSat = 0.35, minVal = 0.25, paso = 1, minPixeles = 12 } = opciones
  const x0 = Math.max(0, Math.round(centro.x - radio))
  const x1 = Math.min(ancho - 1, Math.round(centro.x + radio))
  const y0 = Math.max(0, Math.round(centro.y - radio))
  const y1 = Math.min(alto - 1, Math.round(centro.y + radio))
  let sx = 0, sy = 0, n = 0
  for (let y = y0; y <= y1; y += paso) {
    for (let x = x0; x <= x1; x += paso) {
      const i = (y * ancho + x) * 4
      const r = datos[i], g = datos[i + 1], b = datos[i + 2]
      if (r < 45 && g < 45 && b < 45) continue
      const hsv = rgbAHsv(r, g, b)
      if (hsv.s < minSat || hsv.v < minVal) continue
      if (distanciaTono(hsv.h, objetivo.h) > tolTono) continue
      sx += x; sy += y; n++
    }
  }
  if (n < minPixeles) return undefined
  return { x: sx / n, y: sy / n, n }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 · De la nube de píxeles a los dos marcadores
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Separa la nube en dos marcadores proyectándola sobre su eje principal.
 *
 * Se proyecta en vez de partir por x porque la barra puede estar inclinada, y
 * bajo fatiga se inclina más: partir por x mezclaría los dos marcadores justo
 * en las repeticiones que más importan.
 *
 * Devuelve `undefined` si la nube es demasiado pequeña o si los dos grupos no
 * quedan separados: mejor un fotograma sin dato que dos centroides inventados.
 */
export function separarMarcadores(nube, minPixeles = 24) {
  const { xs, ys, n } = nube
  if (n < minPixeles) return undefined

  let cx = 0, cy = 0
  for (let i = 0; i < n; i++) { cx += xs[i]; cy += ys[i] }
  cx /= n; cy /= n

  let sxx = 0, syy = 0, sxy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - cx, dy = ys[i] - cy
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  const ux = Math.cos(theta), uy = Math.sin(theta)

  const p = new Float64Array(n)
  for (let i = 0; i < n; i++) p[i] = (xs[i] - cx) * ux + (ys[i] - cy) * uy

  const ordenado = Array.from(p).sort((a, b) => a - b)
  let c1 = ordenado[Math.floor(n * 0.1)]
  let c2 = ordenado[Math.floor(n * 0.9)]

  // k-medias con k=2 sobre la proyección. Ocho vueltas sobran para dos grupos.
  const etiqueta = new Uint8Array(n)
  for (let vuelta = 0; vuelta < 8; vuelta++) {
    let s1 = 0, n1 = 0, s2 = 0, n2 = 0
    for (let i = 0; i < n; i++) {
      const cerca1 = Math.abs(p[i] - c1) <= Math.abs(p[i] - c2)
      etiqueta[i] = cerca1 ? 0 : 1
      if (cerca1) { s1 += p[i]; n1++ } else { s2 += p[i]; n2++ }
    }
    if (n1 === 0 || n2 === 0) return undefined
    c1 = s1 / n1; c2 = s2 / n2
  }

  const acumular = (etq) => {
    let sx = 0, sy = 0, k = 0
    for (let i = 0; i < n; i++) if (etiqueta[i] === etq) { sx += xs[i]; sy += ys[i]; k++ }
    return { x: sx / k, y: sy / k, n: k }
  }
  const a = acumular(0), b = acumular(1)

  // Dos marcadores de verdad, o uno solo mal partido en dos mitades.
  const sep = Math.hypot(b.x - a.x, b.y - a.y)
  const radioTipico = Math.sqrt((a.n + b.n) / Math.PI)
  if (sep < radioTipico * 2.5) return undefined
  if (Math.min(a.n, b.n) < minPixeles * 0.25) return undefined

  return {
    a, b,
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    sepPx: sep,
    // Inclinación de la barra en grados; 0 = horizontal en la imagen.
    anguloGrados: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
  }
}

/** Un solo marcador visible: centroide simple. Sirve para %PV, no para m/s. */
export function unSoloMarcador(nube, minPixeles = 24) {
  const { xs, ys, n } = nube
  if (n < minPixeles) return undefined
  let cx = 0, cy = 0
  for (let i = 0; i < n; i++) { cx += xs[i]; cy += ys[i] }
  return { x: cx / n, y: cy / n, sepPx: NaN, anguloGrados: NaN, n }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2b · Referencia plana de cuatro puntos
//
// Dos marcadores dan UN número —su longitud en píxeles— y un número no puede
// separar «se ve corta porque es corta» de «se ve corta porque está torcida».
// En el intento 2 esa ceguera metió un +14 % en la gravedad sin avisar.
//
// Con cuatro puntos coplanares de geometría conocida sí se puede. La proyección
// de un plano bajo perspectiva débil es M = (f/Z)·[bloque 2×2 de una rotación],
// y los valores singulares de ese bloque son SIEMPRE 1 y cos θ. Luego:
//
//     sigma_max(M) = f/Z          <- la escala, inmune a la inclinación
//     sigma_min/sigma_max = cos θ <- cuánto estaba inclinada, medido
//
// Ver wiki/motor-velocidad/escala-e-inclinacion.md para la derivación.
// ─────────────────────────────────────────────────────────────────────────────

/** Resuelve un sistema 3×3 por eliminación. Devuelve undefined si es singular. */
function resolver3(A, b) {
  const M = [[...A[0], b[0]], [...A[1], b[1]], [...A[2], b[2]]]
  for (let col = 0; col < 3; col++) {
    let piv = col
    for (let f = col + 1; f < 3; f++) if (Math.abs(M[f][col]) > Math.abs(M[piv][col])) piv = f
    if (Math.abs(M[piv][col]) < 1e-12) return undefined
    ;[M[col], M[piv]] = [M[piv], M[col]]
    for (let f = 0; f < 3; f++) {
      if (f === col) continue
      const k = M[f][col] / M[col][col]
      for (let c = col; c < 4; c++) M[f][c] -= k * M[col][c]
    }
  }
  return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]]
}

/**
 * Ajusta la transformación afín que lleva los puntos del modelo (metros, en el
 * plano de la referencia) a los puntos observados (píxeles).
 *
 *   x = m00·u + m01·v + tx
 *   y = m10·u + m11·v + ty
 */
export function ajusteAfin(modelo, observado) {
  const n = modelo.length
  if (n < 3 || observado.length !== n) return undefined
  let Suu = 0, Svv = 0, Suv = 0, Su = 0, Sv = 0, S1 = n
  for (const p of modelo) { Suu += p.u * p.u; Svv += p.v * p.v; Suv += p.u * p.v; Su += p.u; Sv += p.v }
  const A = [[Suu, Suv, Su], [Suv, Svv, Sv], [Su, Sv, S1]]
  const lado = (clave) => {
    let a = 0, b = 0, c = 0
    for (let i = 0; i < n; i++) {
      const w = observado[i][clave]
      a += modelo[i].u * w; b += modelo[i].v * w; c += w
    }
    return [a, b, c]
  }
  const fx = resolver3(A, lado('x')), fy = resolver3(A, lado('y'))
  if (!fx || !fy) return undefined
  const M = [[fx[0], fx[1]], [fy[0], fy[1]]]
  let sc = 0
  for (let i = 0; i < n; i++) {
    const px = M[0][0] * modelo[i].u + M[0][1] * modelo[i].v + fx[2]
    const py = M[1][0] * modelo[i].u + M[1][1] * modelo[i].v + fy[2]
    sc += (px - observado[i].x) ** 2 + (py - observado[i].y) ** 2
  }
  return { M, tx: fx[2], ty: fy[2], rms: Math.sqrt(sc / n) }
}

/** Cuánto mayor tiene que ser la marca de anclaje que las otras tres para que
 *  se la reconozca como tal. */
const FACTOR_MARCA_ANCLA = 1.25

/** Valores singulares de una matriz 2×2, en forma cerrada. */
export function valoresSingulares2x2(M) {
  const [[a, b], [c, d]] = M
  const e = (a + d) / 2, f = (a - d) / 2, g = (c + b) / 2, h = (c - b) / 2
  const q = Math.hypot(e, h), r = Math.hypot(f, g)
  return { mayor: q + r, menor: Math.abs(q - r) }
}

/**
 * Escala e inclinación a partir de cuatro marcas en las esquinas de un
 * rectángulo conocido.
 *
 * El orden en que llegan los centros es desconocido, así que se prueban las
 * ocho asignaciones cíclicas posibles (cuatro rotaciones × dos sentidos) y se
 * queda la de menor residuo. Con un rectángulo no cuadrado eso es inequívoco.
 */
export function referenciaPlana(centros, anchoMm, altoMm) {
  if (!centros || centros.length !== 4) return undefined
  if (!(anchoMm > 0) || !(altoMm > 0)) return undefined
  const W = anchoMm / 2000, H = altoMm / 2000 // metros, media diagonal
  const modelo = [{ u: -W, v: -H }, { u: +W, v: -H }, { u: +W, v: +H }, { u: -W, v: +H }]

  // Orden cíclico alrededor del centroide. Da la secuencia, no el punto de
  // partida ni el sentido.
  const cx = centros.reduce((s, p) => s + p.x, 0) / 4
  const cy = centros.reduce((s, p) => s + p.y, 0) / 4
  const ciclo = [...centros].sort((p, q) =>
    Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx))

  // ¿Hay marca grande que rompa la simetría? Sin ella el problema es AMBIGUO:
  // una transformación afín lleva cualquier paralelogramo a cualquier otro, así
  // que la asignación girada 90° ajusta exactamente igual de bien y el residuo
  // no puede desempatar — pero da la escala del lado equivocado. Es la razón por
  // la que los marcadores fiduciales llevan un patrón asimétrico dentro.
  const tam = ciclo.map((p) => (Number.isFinite(p.n) ? p.n : NaN))
  const hayTam = tam.every(Number.isFinite)
  const orden = [...tam].sort((a, b) => a - b)
  const mediana = hayTam ? (orden[1] + orden[2]) / 2 : NaN
  const iAncla = hayTam && orden[3] >= mediana * FACTOR_MARCA_ANCLA
    ? tam.indexOf(orden[3]) : -1

  // Recorrer el ciclo al revés desde la misma ancla NO es un simple reflejo:
  // intercambia el lado ancho con el alto y da otra escala, ajustando igual de
  // bien. Lo que descarta ese caso es física, no álgebra — una diana impresa se
  // ve siempre por su cara, así que la correspondencia conserva la orientación
  // y det(M) > 0. El sentido equivocado sale con determinante negativo.
  const giros = iAncla >= 0 ? [iAncla] : [0, 1, 2, 3]
  const candidatos = []
  for (const sentido of [1, -1]) {
    for (const g of giros) {
      const obs = [0, 1, 2, 3].map((k) => ciclo[(((g + sentido * k) % 4) + 4) % 4])
      const aj = ajusteAfin(modelo, obs)
      if (!aj) continue
      aj.det = aj.M[0][0] * aj.M[1][1] - aj.M[0][1] * aj.M[1][0]
      candidatos.push({ ...aj, obs })
    }
  }
  const deFrente = candidatos.filter((c) => c.det > 0)
  const usables = deFrente.length ? deFrente : candidatos
  if (!usables.length) return undefined
  usables.sort((a, b) => a.rms - b.rms)
  const mejor = usables[0]

  const sv = (c) => valoresSingulares2x2(c.M)
  const { mayor, menor } = sv(mejor)
  if (!(mayor > 0)) return undefined

  // Ambigüedad: ¿hay otra asignación que ajuste casi igual pero dé otra escala?
  let ambiguo = false
  for (const c of usables.slice(1)) {
    const otra = sv(c).mayor
    if (Math.abs(otra - mayor) / mayor > 0.02 && c.rms <= Math.max(mejor.rms * 1.5, mejor.rms + 0.5)) {
      ambiguo = true; break
    }
  }

  return {
    escalaPxM: mayor,                          // px por metro, sin foreshortening
    cosInclinacion: Math.min(1, menor / mayor),
    inclinacionGrados: (Math.acos(Math.min(1, menor / mayor)) * 180) / Math.PI,
    anguloGrados: (Math.atan2(mejor.M[1][0], mejor.M[0][0]) * 180) / Math.PI,
    rmsPx: mejor.rms,
    ambiguo,
    conAncla: iAncla >= 0,
    deFrente: mejor.det > 0,
    x: mejor.tx,
    y: mejor.ty,
  }
}

/**
 * Parte la nube en k grupos por k-medias en 2D. Los dos marcadores usaban una
 * proyección 1D porque siempre están alineados; cuatro esquinas no lo están.
 */
export function agruparMarcadores(nube, k = 4, minPixeles = 24) {
  const { xs, ys, n } = nube
  if (n < minPixeles * k * 0.25) return undefined
  // siembra: el punto más lejano de los ya elegidos (k-means++ determinista)
  const cent = [{ x: xs[0], y: ys[0] }]
  while (cent.length < k) {
    let mejor = -1, dMejor = -1
    for (let i = 0; i < n; i++) {
      let d = Infinity
      for (const c of cent) d = Math.min(d, (xs[i] - c.x) ** 2 + (ys[i] - c.y) ** 2)
      if (d > dMejor) { dMejor = d; mejor = i }
    }
    cent.push({ x: xs[mejor], y: ys[mejor] })
  }
  const etq = new Uint8Array(n)
  for (let vuelta = 0; vuelta < 15; vuelta++) {
    for (let i = 0; i < n; i++) {
      let mejor = 0, dMejor = Infinity
      for (let c = 0; c < k; c++) {
        const d = (xs[i] - cent[c].x) ** 2 + (ys[i] - cent[c].y) ** 2
        if (d < dMejor) { dMejor = d; mejor = c }
      }
      etq[i] = mejor
    }
    const sx = new Float64Array(k), sy = new Float64Array(k), cn = new Float64Array(k)
    for (let i = 0; i < n; i++) { sx[etq[i]] += xs[i]; sy[etq[i]] += ys[i]; cn[etq[i]]++ }
    for (let c = 0; c < k; c++) {
      if (cn[c] === 0) return undefined
      cent[c] = { x: sx[c] / cn[c], y: sy[c] / cn[c], n: cn[c] }
    }
  }
  if (cent.some((c) => c.n < minPixeles * 0.25)) return undefined
  return cent
}

/** Detección completa con diana de cuatro marcas. */
export function detectarDianaCuatro(nube, anchoMm, altoMm, minPixeles = 24) {
  const cent = agruparMarcadores(nube, 4, minPixeles)
  if (!cent) return undefined
  const ref = referenciaPlana(cent, anchoMm, altoMm)
  if (!ref) return undefined
  return { ...ref, marcas: cent, nMarcas: 4 }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 · Velocidad
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Velocidad por ajuste cuadrático local, usando los tiempos REALES de cada
 * fotograma.
 *
 * No se usa Savitzky-Golay clásico ni diferencias entre fotogramas seguidos: el
 * primero asume muestreo uniforme y el segundo amplifica el ruido. Los
 * fotogramas de `requestVideoFrameCallback` no llegan equiespaciados —ese es el
 * error clásico que arruina estas mediciones— así que en cada punto se ajusta
 * s(t) = a + b·(t−ti) + c·(t−ti)² por mínimos cuadrados y la velocidad es `b`.
 */
export function velocidades(t, s, semiVentana = 3) {
  const n = t.length
  const v = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const desde = Math.max(0, i - semiVentana)
    const hasta = Math.min(n - 1, i + semiVentana)
    const m = hasta - desde + 1
    if (m < 3) { v[i] = 0; continue }
    // Normales de [1, dt, dt²] por mínimos cuadrados.
    let S0 = 0, S1 = 0, S2 = 0, S3 = 0, S4 = 0, T0 = 0, T1 = 0, T2 = 0
    for (let k = desde; k <= hasta; k++) {
      const dt = t[k] - t[i], y = s[k]
      const dt2 = dt * dt
      S0 += 1; S1 += dt; S2 += dt2; S3 += dt2 * dt; S4 += dt2 * dt2
      T0 += y; T1 += y * dt; T2 += y * dt2
    }
    const det =
      S0 * (S2 * S4 - S3 * S3) - S1 * (S1 * S4 - S3 * S2) + S2 * (S1 * S3 - S2 * S2)
    if (Math.abs(det) < 1e-12) { v[i] = 0; continue }
    // Regla de Cramer solo para el coeficiente b (la velocidad).
    const detB =
      S0 * (T1 * S4 - T2 * S3) - T0 * (S1 * S4 - S3 * S2) + S2 * (S1 * T2 - T1 * S2)
    v[i] = detB / det
  }
  return v
}

/** Percentil sobre una copia ordenada. */
export function percentil(arr, p) {
  const a = Array.from(arr).sort((x, y) => x - y)
  if (a.length === 0) return NaN
  const i = Math.min(a.length - 1, Math.max(0, Math.round((a.length - 1) * p)))
  return a[i]
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 · Repeticiones
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parte la señal en repeticiones con una máquina de estados con histéresis.
 *
 * `s` es la posición **en el sentido de la concéntrica**: crece cuando el
 * asesorado está haciendo la parte que le cuesta. En press y sentadilla eso es
 * subir; en jalón y remo es bajar o tirar. Quien llama se encarga del signo.
 *
 * La histéresis (25 % y 75 % del recorrido) evita que un temblor en el punto
 * bajo cuente cuatro repeticiones donde hay una.
 */
export function segmentarRepeticiones(t, s, v) {
  const n = t.length
  if (n < 8) return []
  const bajo = percentil(s, 0.05)
  const alto = percentil(s, 0.95)
  const A = alto - bajo
  if (!(A > 0)) return []
  const umbralBajo = bajo + 0.25 * A
  const umbralAlto = bajo + 0.75 * A

  const reps = []
  let estado = s[0] > umbralAlto ? 'arriba' : 'abajo'
  let iMin = 0
  let sMin = s[0]
  let iFinAnterior = -1

  for (let i = 1; i < n; i++) {
    if (estado === 'abajo') {
      if (s[i] < sMin) { sMin = s[i]; iMin = i }
      if (s[i] > umbralAlto) {
        // Hasta dónde mirar: hasta que la barra vuelva a bajar de verdad.
        let iTope = i
        for (let k = i; k < n; k++) {
          iTope = k
          if (s[i] - s[k] > 0.15 * A) break
        }
        // Los bordes de la concéntrica se marcan sobre la POSICIÓN, no sobre la
        // velocidad. Marcarlos sobre la velocidad parecía lo natural, pero la
        // velocidad va suavizada y ese suavizado difumina el arranque y el final
        // media ventana hacia cada lado: a 60 fps son ~0,1 s de más en cada
        // repetición. Como el tiempo se infla y el recorrido no, la velocidad
        // media sale corta —y sale MÁS corta cuanto más rápida es la repetición,
        // que es justo el sesgo que comprime el %PV y haría parecer fresco a
        // quien no lo está. En la prueba sintética costaba 3 puntos.
        //
        // Con umbrales de posición al 5 % y al 95 % del recorrido, numerador y
        // denominador se recortan a la vez y el cociente se conserva. De paso se
        // deja fuera la fase de frenado del final, que es lo que separa la
        // velocidad media de la media propulsiva.
        let iCima = iMin
        for (let k = iMin; k <= iTope; k++) if (s[k] > s[iCima]) iCima = k
        const romTotal = s[iCima] - s[iMin]
        const bajo5 = s[iMin] + 0.05 * romTotal
        const alto95 = s[iMin] + 0.95 * romTotal
        let iInicio = iCima
        while (iInicio > iMin && s[iInicio - 1] > bajo5) iInicio--
        let iFin = iInicio
        while (iFin < iCima && s[iFin] < alto95) iFin++

        let iPico = iInicio
        for (let k = iInicio; k <= iFin; k++) if (v[k] > v[iPico]) iPico = k

        const dt = t[iFin] - t[iInicio]
        if (dt > 0.08 && s[iFin] > s[iInicio]) {
          let vExcPico
          if (iFinAnterior >= 0) {
            let peor = 0
            for (let k = iFinAnterior; k <= iInicio; k++) if (v[k] < peor) peor = v[k]
            vExcPico = Math.abs(peor)
          }
          reps.push({
            n: reps.length + 1,
            iInicio,
            iFin,
            concSeg: dt,
            rom: romTotal,
            vMedia: (s[iFin] - s[iInicio]) / dt,
            vPico: v[iPico],
            excSeg: iFinAnterior >= 0 ? t[iInicio] - t[iFinAnterior] : undefined,
            vExcPico,
          })
          iFinAnterior = iFin
        }
        estado = 'arriba'
      }
    } else if (s[i] < umbralBajo) {
      estado = 'abajo'
      sMin = s[i]
      iMin = i
    }
  }
  return reps
}

// ─────────────────────────────────────────────────────────────────────────────
// 5 · Métricas de la serie
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analiza una serie completa a partir de las muestras crudas de la cámara.
 *
 * `muestras`: [{ t, x, y, sepPx, anguloGrados }] con t en segundos y x/y en
 * píxeles de imagen (y crece hacia abajo).
 *
 * `sepMm`: separación real entre los dos marcadores. Si falta, todo sale en
 * píxeles por segundo — y el **%PV sigue siendo válido**, porque es un cociente
 * entre dos velocidades medidas con la misma escala equivocada. Esa es la tesis
 * del §4 del plan y es la razón de que esta función no exija calibración.
 */
export function analizarSerie(muestras, opciones = {}) {
  const { sepMm, sentido = 'subir' } = opciones
  const validas = muestras.filter((m) => m && Number.isFinite(m.y))
  if (validas.length < 10) {
    return { ok: false, motivo: 'sin_segmentar', detalle: 'Menos de 10 fotogramas con marcador' }
  }

  const t = validas.map((m) => m.t)
  const duracion = t[t.length - 1] - t[0]
  const fpsReal = duracion > 0 ? (validas.length - 1) / duracion : 0
  const deteccion = validas.length / muestras.length

  // Escala. Con diana de cuatro marcas cada muestra trae ya px/m corregidos de
  // inclinación; con dos marcadores solo hay una longitud, que no sabe si está
  // torcida —y una inclinación de 20° ya son +6,4 % en toda la velocidad—.
  const escalas = validas.map((m) => m.escalaPxM).filter((x) => Number.isFinite(x) && x > 0)
  const conDiana = escalas.length >= validas.length * 0.5
  const sepsPx = validas.map((m) => m.sepPx).filter((x) => Number.isFinite(x))
  const sepPxMediana = sepsPx.length >= validas.length * 0.5 ? percentil(sepsPx, 0.5) : NaN
  const hayEscala = conDiana || (Number.isFinite(sepPxMediana) && Number.isFinite(sepMm) && sepMm > 0)
  const pxPorMetro = conDiana ? percentil(escalas, 0.5)
    : (hayEscala ? sepPxMediana / (sepMm / 1000) : 1)
  const metrosPorPixel = hayEscala ? 1 / pxPorMetro : 1
  const unidad = hayEscala ? 'm/s' : 'px/s'
  // Inclinación de la referencia a lo largo de la serie. Solo la diana la sabe.
  const inclinaciones = validas.map((m) => m.inclinacionGrados).filter(Number.isFinite)
  const inclinacionGrados = inclinaciones.length ? percentil(inclinaciones, 0.5) : NaN
  const inclinacionMax = inclinaciones.length ? percentil(inclinaciones, 0.9) : NaN

  // Signo: `s` crece durante la concéntrica.
  const signo = sentido === 'subir' ? -1 : 1
  const s = validas.map((m) => signo * m.y * metrosPorPixel)

  const v = velocidades(t, s)
  const reps = segmentarRepeticiones(t, s, v)

  if (reps.length === 0) {
    return { ok: false, motivo: 'sin_segmentar', detalle: 'No se reconoció ninguna repetición', fpsReal, deteccion }
  }

  // v₁ = la mejor de las dos primeras. Una primera repetición dubitativa es
  // habitual —se coloca, respira— y no debe fijar la referencia del día.
  const vPrimera = Math.max(reps[0].vMedia, reps.length > 1 ? reps[1].vMedia : reps[0].vMedia)
  const vUltima = reps[reps.length - 1].vMedia
  const pvPct = vPrimera > 0 ? ((vPrimera - vUltima) / vPrimera) * 100 : NaN

  const angulos = validas.map((m) => m.anguloGrados).filter(Number.isFinite)
  const anguloMediana = angulos.length ? percentil(angulos.map(Math.abs), 0.5) : NaN

  const romPrimera = reps[0].rom
  const romUltima = reps[reps.length - 1].rom
  const concSegMedia = reps.reduce((a, r) => a + r.concSeg, 0) / reps.length

  return {
    ok: true,
    unidad,
    hayEscala,
    fpsReal,
    deteccion,
    sepPxMediana,
    escalaPxM: hayEscala ? pxPorMetro : NaN,
    conDiana,
    inclinacionGrados,
    inclinacionMax,
    anguloMediana,
    reps,
    vPrimera,
    vUltima,
    pvPct,
    concSegMedia,
    romRelativo: romPrimera > 0 ? romUltima / romPrimera : NaN,
    compensacion: reps[reps.length - 1].vExcPico ?? NaN,
    calidad: calificar({ fpsReal, deteccion, anguloMediana, nReps: reps.length, hayEscala,
                         inclinacionGrados, conDiana }),
    serie: { t, s, v },
  }
}

/** Inclinación de la referencia por encima de la cual una toma deja de valer.
 *  NO es lo mismo que INCLINACION_MAX_GRADOS: aquel es el punto en que la
 *  geometría de las cuatro esquinas pierde precisión (35°); este es el punto en
 *  que la medición deja de ser aceptable (20°, que son +6,4 % de velocidad si
 *  entrara sin corregir). El más estricto de los dos es el que manda en pantalla,
 *  porque es el que decide si la grabación sobrevive. */
export const INCLINACION_CALIDAD_GRADOS = 20

/**
 * Contrato de calidad — la puerta del motor.
 * wiki/motor-velocidad/contrato-datos.md §5. Vocabulario de motivos cerrado a
 * propósito: sin él no se puede contar qué falla más, y sin eso el protocolo de
 * encuadre no se puede arreglar.
 */
export function calificar({ fpsReal, deteccion, anguloMediana, nReps, hayEscala,
                            inclinacionGrados, conDiana }) {
  const fallos = []
  // 50 y no 30. Medido en la campaña de ensayos (2026-08-19): a 30 fps el error
  // de %PV es de -5,0 puntos, que es EXACTAMENTE el umbral de muerte de la rama;
  // a 60 baja a -0,6. Treinta fotogramas por segundo bastan para la velocidad
  // media, pero no para la pérdida de velocidad — y la pérdida de velocidad es
  // la que decide la dosis. Ver wiki/motor-velocidad/ensayos-simulados.md §2.
  if (!(fpsReal >= 50)) fallos.push('pocos_fps')
  if (!(deteccion >= 0.95)) fallos.push('marcador_perdido')
  if (Number.isFinite(anguloMediana) && anguloMediana > 10) fallos.push('angulo')
  if (nReps < 3) fallos.push('pocas_reps')
  if (!hayEscala) fallos.push('sin_escala')
  // La inclinación de la referencia va DIRECTA a la velocidad: 20° son +6,4 %.
  // Solo la diana de cuatro marcas la sabe; con dos marcadores entra ciega y por
  // eso la medición nunca puede llamarse «buena».
  // Ver wiki/motor-velocidad/escala-e-inclinacion.md
  if (hayEscala && conDiana === false) fallos.push('inclinacion_no_medible')
  if (Number.isFinite(inclinacionGrados) && inclinacionGrados > INCLINACION_CALIDAD_GRADOS) fallos.push('referencia_torcida')
  if (fallos.length === 0) return { nivel: 'buena', motivos: [] }
  if (fallos.length === 1) return { nivel: 'dudosa', motivos: fallos }
  return { nivel: 'descartada', motivos: fallos }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6 · Validación
// ─────────────────────────────────────────────────────────────────────────────

/** Fracción de la velocidad de pico por debajo de la cual se da por hecho que el
 *  implemento todavía no se ha soltado. Recorta el titubeo entre «grabar» y
 *  «soltar». Medido sobre IMG_6436: sin este recorte el veredicto de una misma
 *  caída salta entre VERDE y ROJO según cuánto tardó la persona en soltar. */
const UMBRAL_SUELTA = 0.15

/** MAD relativa de la separación por encima de la cual la escala se marca como
 *  dudosa. Una oclusión parcial del marcador la dispara. */
const DISPERSION_SEP_MAX = 0.05

/** Por debajo de esto no se recorta más, aunque el residuo siga siendo feo. */
const MIN_MUESTRAS_CAIDA = 8

/** Diferencia máxima admisible entre la aceleración de la primera mitad de la
 *  caída y la de la segunda. Por encima, la toma no determina una aceleración. */
const ESTABILIDAD_MAX = 0.10

/** Por encima de esta inclinación de la referencia, el ajuste de las cuatro
 *  esquinas pierde precisión: las esquinas se juntan y el ruido de cada centro
 *  pesa más. Es el punto débil conocido de los marcadores planos.
 *  Se exporta porque el indicador EN VIVO tiene que enseñar los mismos números
 *  que la puerta de aceptación: el 20 de agosto de 2026 se perdió una sesión de
 *  prueba entera grabando con el círculo verde a 35° mientras la puerta
 *  descartaba a 20°. */
export const INCLINACION_MAX_GRADOS = 35

/**
 * Prueba de gravedad — la verdad de balde (plan §8.1).
 *
 * Se deja caer el implemento con los marcadores y se ajusta una parábola a la
 * caída: la aceleración tiene que salir 9,81 m/s². Valida **escala y tiempos a
 * la vez**, y nadie discute la física. Es el autotest que se puede repetir en
 * cada teléfono nuevo antes de fiarse de él.
 */
/** Ajusta y = a + b·x + c·x² por mínimos cuadrados sobre [i0, i1] y devuelve
 *  también los residuos, que es lo que permite ver qué fotogramas no son caída
 *  libre de verdad. */
function ajustarParabola(x, y, i0, i1) {
  let S0 = 0, S1 = 0, S2 = 0, S3 = 0, S4 = 0, T0 = 0, T1 = 0, T2 = 0
  for (let i = i0; i <= i1; i++) {
    const u = x[i], u2 = u * u
    S0 += 1; S1 += u; S2 += u2; S3 += u2 * u; S4 += u2 * u2
    T0 += y[i]; T1 += y[i] * u; T2 += y[i] * u2
  }
  const det = S0 * (S2 * S4 - S3 * S3) - S1 * (S1 * S4 - S3 * S2) + S2 * (S1 * S3 - S2 * S2)
  if (Math.abs(det) < 1e-12) return null
  const detA = T0 * (S2 * S4 - S3 * S3) - S1 * (T1 * S4 - S3 * T2) + S2 * (T1 * S3 - S2 * T2)
  const detB = S0 * (T1 * S4 - S3 * T2) - T0 * (S1 * S4 - S3 * S2) + S2 * (S1 * T2 - T1 * S2)
  const detC = S0 * (S2 * T2 - S3 * T1) - S1 * (S1 * T2 - S2 * T1) + T0 * (S1 * S3 - S2 * S2)
  const a = detA / det, b = detB / det, c = detC / det
  const residuos = []
  for (let i = i0; i <= i1; i++) residuos.push(y[i] - (a + b * x[i] + c * x[i] * x[i]))
  return { a, b, c, residuos }
}

/**
 * Gravedad local, por la Fórmula Internacional de la Gravedad más las
 * correcciones de altitud.
 *
 * **9,81 no es una constante universal, es un promedio.** Varía con la latitud
 * —la Tierra está achatada y además rota— y con la altitud. En los Andes
 * colombianos el valor real ronda **9,775**: un −0,35 % que, comparado contra
 * 9,81, se come una sexta parte del presupuesto de la fase 2 antes de encender
 * la cámara, y siempre con el mismo signo.
 *
 *   g(φ) = 9,780327 · (1 + 0,0053024 sen²φ − 0,0000058 sen²2φ)
 *   aire libre: −3,086·10⁻⁶ · h        Bouguer: +1,1119·10⁻⁶ · h
 */
export function gLocal(latitudGrados, altitudM = 0) {
  if (!Number.isFinite(latitudGrados)) return G_ESTANDAR
  const p = (latitudGrados * Math.PI) / 180
  const g0 = 9.780327 * (1 + 0.0053024 * Math.sin(p) ** 2 - 0.0000058 * Math.sin(2 * p) ** 2)
  const h = Number.isFinite(altitudM) ? altitudM : 0
  return g0 - 3.086e-6 * h + 1.1119e-6 * h
}

/** Gravedad estándar (CGPM 1901). Es el valor a 45° de latitud y nivel del mar. */
export const G_ESTANDAR = 9.80665

export function pruebaDeGravedad(muestras, sepMm, opciones = {}) {
  const gRef = Number.isFinite(opciones.gRef) && opciones.gRef > 0 ? opciones.gRef : G_ESTANDAR
  // Dos caminos. Con diana de cuatro marcas cada muestra trae ya su escala en
  // px/m, corregida de inclinación; con dos marcadores solo hay una longitud.
  const conEscala = muestras.filter((m) => m && Number.isFinite(m.y) && Number.isFinite(m.escalaPxM))
  const cuatro = conEscala.length >= 8
  const validas = cuatro
    ? conEscala
    : muestras.filter((m) => m && Number.isFinite(m.y) && Number.isFinite(m.sepPx))
  if (validas.length < 8) return { ok: false, motivo: 'Menos de 8 fotogramas con la referencia visible' }
  if (!cuatro && !(sepMm > 0)) return { ok: false, motivo: 'Falta la separación entre marcadores' }

  const t = validas.map((m) => m.t)
  const yPx = validas.map((m) => m.y) // píxeles, hacia abajo positivo

  // 1 · Velocidad de caída en px/s, por diferencias centradas.
  const v = yPx.map((_, i) => {
    const a = Math.max(0, i - 1), b = Math.min(yPx.length - 1, i + 1)
    const dt = t[b] - t[a]
    return dt > 0 ? (yPx[b] - yPx[a]) / dt : 0
  })

  // 2 · El tramo TERMINA en el pico de velocidad. En caída libre la velocidad
  //     crece sin parar hasta tocar, así que el pico es el último fotograma
  //     bueno. Tomar en su lugar «el punto más bajo» metía el rebote dentro de
  //     la parábola.
  let iFin = 0
  v.forEach((val, i) => { if (val > v[iFin]) iFin = i })
  const vPico = v[iFin]
  if (!(vPico > 0)) return { ok: false, motivo: 'No se distingue una caída limpia' }

  // 3 · El tramo EMPIEZA donde el implemento deja de estar quieto: se retrocede
  //     desde el pico mientras siga cayendo de verdad. El protocolo es «grabar →
  //     soltar → parar», así que siempre hay titubeo al principio; si entra en
  //     el ajuste mueve el resultado hasta 6 puntos y puede dar VERDE por azar.
  const umbral = vPico * UMBRAL_SUELTA
  let iIni = iFin
  while (iIni > 0 && v[iIni - 1] >= umbral) iIni--

  const n = iFin - iIni + 1
  if (n < 6) return { ok: false, motivo: `La caída limpia dura ${n} fotogramas; hacen falta 6` }

  // 4 · La escala se mide SOLO durante la caída, que es cuando el implemento
  //     vuela libre: ni la mano encima ni el marcador medio tapado. Medianarla
  //     sobre toda la grabación la contamina con los fotogramas de agarre.
  const tramo = validas.slice(iIni, iFin + 1)
  const seps = tramo.map((m) => (cuatro ? m.escalaPxM : m.sepPx)).filter((x) => x > 0)
  const sepPx = percentil(seps, 0.5)
  if (!(sepPx > 0)) return { ok: false, motivo: 'Sin referencia medible durante la caída' }
  // Dispersión robusta (MAD relativa): una oclusión parcial la dispara, y un
  // 10 % de error de escala son un 10 % de gravedad que pasa por bueno.
  const dispersionSep = percentil(seps.map((x) => Math.abs(x - sepPx)), 0.5) / sepPx
  // px por metro. Con cuatro marcas ya viene corregida de inclinación; con dos
  // sale de una longitud que no sabe si está torcida.
  const pxPorM = cuatro ? sepPx : sepPx / (sepMm / 1000)
  const mpp = 1 / pxPorM
  // Inclinación de la referencia durante la caída, si se puede medir.
  const cosIncl = cuatro
    ? percentil(tramo.map((m) => m.cosInclinacion).filter(Number.isFinite), 0.5)
    : NaN
  const inclinacionGrados = Number.isFinite(cosIncl)
    ? (Math.acos(Math.min(1, cosIncl)) * 180) / Math.PI : NaN

  const t0 = t[iIni]
  const x = t.map((val) => val - t0)
  const alt = yPx.map((val) => -val * mpp) // altura: hacia arriba positivo

  const ajuste = ajustarParabola(x, alt, iIni, iFin)
  if (!ajuste) return { ok: false, motivo: 'Ajuste degenerado' }

  // 5 · ¿Determina esta caída una aceleración, o solo la aparenta?
  //     Una caída libre real es UNA parábola: da igual qué mitad se ajuste. Si
  //     las dos mitades no coinciden, hay algo sistemático —obturador rodante,
  //     borrón asimétrico, el implemento girando— y el número medio es una
  //     media de dos cosas distintas, no una medición. Sin esto, una toma que no
  //     determina nada puede caer dentro del ±2 % por casualidad.
  const medio = iIni + Math.floor((iFin - iIni) / 2)
  const mitad1 = ajustarParabola(x, alt, iIni, medio + 1)
  const mitad2 = ajustarParabola(x, alt, medio, iFin)
  const estabilidad = (mitad1 && mitad2 && Math.abs(ajuste.c) > 0)
    ? Math.abs(Math.abs(mitad2.c) - Math.abs(mitad1.c)) / Math.abs(ajuste.c)
    : NaN

  const nUsadas = iFin - iIni + 1
  const aceleracion = Math.abs(2 * ajuste.c)
  const errorPct = ((aceleracion - gRef) / gRef) * 100
  const rmsPx = Math.sqrt(ajuste.residuos.reduce((acc, val) => acc + val * val, 0)
    / ajuste.residuos.length) / mpp

  const avisos = []
  if (dispersionSep > DISPERSION_SEP_MAX) {
    avisos.push(`La referencia cambia de tamaño un ${(dispersionSep * 100).toFixed(0)} % durante la caída`
      + ' — probable oclusión parcial. La escala no es de fiar.')
  }
  if (Number.isFinite(estabilidad) && estabilidad > ESTABILIDAD_MAX) {
    avisos.push(`Las dos mitades de la caída dan aceleraciones que difieren un ${(estabilidad * 100).toFixed(0)} %`
      + ' — la toma no determina una aceleración. Repítela.')
  }
  if (Number.isFinite(inclinacionGrados) && inclinacionGrados > INCLINACION_MAX_GRADOS) {
    avisos.push(`La referencia estaba a ${inclinacionGrados.toFixed(0)}° de la cámara`
      + ` — corregido, pero por encima de ${INCLINACION_MAX_GRADOS}° el ajuste de esquinas`
      + ' pierde precisión. Ponla más de frente.')
  }
  if (!cuatro) {
    avisos.push('Referencia de dos marcadores: su inclinación no se puede medir'
      + ' y entra entera en la escala. Con cuatro marcas esto sí se corrige.')
  }
  const dentro = Math.abs(errorPct) <= 2
  const veredicto = !dentro ? 'ROJO' : (avisos.length ? 'DUDOSA' : 'VERDE')

  return {
    ok: true,
    aceleracion,
    errorPct,
    veredicto,
    avisos,
    nMuestras: nUsadas,
    rmsPx,
    descartadasInicio: iIni,
    descartadasFinal: validas.length - 1 - iFin,
    sepPx,
    dispersionSep,
    estabilidad,
    escalaPxM: pxPorM,
    gRef,
    inclinacionGrados,
    referencia: cuatro ? 'cuatro marcas' : 'dos marcadores',
    fpsReal: (validas.length - 1) / (t[t.length - 1] - t[0]),
  }
}

/**
 * Prueba sintética — comprueba la aritmética sin cámara.
 *
 * Genera un movimiento con velocidad concéntrica conocida y fotogramas
 * deliberadamente NO equiespaciados (que es la realidad), y mide cuánto se
 * desvía lo que devuelve la tubería. Si esto falla, el problema es el código,
 * no el gimnasio — y sale antes de salir de casa.
 */
export function pruebaSintetica({ nReps = 6, vInicial = 0.60, pvObjetivo = 30, fps = 60, ruidoPx = 0.5 } = {}) {
  const romM = 0.5
  const sepMm = 400
  const sepPx = 160            // ⇒ 2,5 mm por píxel
  const mpp = sepMm / 1000 / sepPx
  const muestras = []
  let t = 0
  let semilla = 12345
  const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648 - 0.5 }

  for (let r = 0; r < nReps; r++) {
    const v = vInicial * (1 - (pvObjetivo / 100) * (r / Math.max(1, nReps - 1)))
    const tramos = [
      { dur: 1.2, desde: romM, hasta: 0 },   // excéntrica
      { dur: 0.15, desde: 0, hasta: 0 },     // pausa abajo
      { dur: romM / v, desde: 0, hasta: romM }, // concéntrica a velocidad v
      { dur: 0.2, desde: romM, hasta: romM },
    ]
    for (const tr of tramos) {
      const pasos = Math.max(1, Math.round(tr.dur * fps))
      for (let k = 0; k < pasos; k++) {
        const u = k / pasos
        const altura = tr.desde + (tr.hasta - tr.desde) * u
        // Fotogramas no equiespaciados: ±15 % de jitter, como en un móvil real.
        t += (1 / fps) * (1 + 0.3 * azar())
        muestras.push({
          t,
          x: 320 + azar() * ruidoPx,
          y: 400 - altura / mpp + azar() * ruidoPx,
          sepPx: sepPx + azar() * ruidoPx,
          anguloGrados: azar() * 2,
        })
      }
    }
  }

  const res = analizarSerie(muestras, { sepMm, sentido: 'subir' })
  const vUltimaEsperada = vInicial * (1 - pvObjetivo / 100)
  return {
    esperado: { nReps, vPrimera: vInicial, vUltima: vUltimaEsperada, pvPct: pvObjetivo },
    obtenido: res.ok
      ? { nReps: res.reps.length, vPrimera: res.vPrimera, vUltima: res.vUltima, pvPct: res.pvPct }
      : undefined,
    error: res.ok
      ? {
          vPrimera: res.vPrimera - vInicial,
          vUltima: res.vUltima - vUltimaEsperada,
          pvPuntos: res.pvPct - pvObjetivo,
          reps: res.reps.length - nReps,
        }
      : undefined,
    resultado: res,
  }
}
