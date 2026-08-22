/**
 * Encoder de cámara · detección del disco por ajuste de circunferencia.
 *
 * El usuario toca el disco una vez; a partir de ahí, **en cada fotograma se
 * vuelve a encontrar la circunferencia desde cero**, dentro de una ventana
 * alrededor de donde debería estar.
 *
 * Ese matiz —detectar en vez de seguir— es lo que resuelve tres problemas de
 * golpe, y no es un detalle de implementación:
 *
 * 1. **Deriva.** Un seguidor de trozo de imagen mide cada fotograma contra el
 *    anterior y acumula error: 1.500 fotogramas de una serie con 0,05 px de
 *    sesgo son 75 px de desvío. Aquí no hay nada que acumular, porque ningún
 *    fotograma depende de la posición del anterior salvo para saber dónde
 *    mirar.
 * 2. **Oclusión.** Una mano que tapa medio disco deja un arco, y **un arco
 *    todavía define la circunferencia**. Un marcador puntual tapado no deja
 *    nada. Además la confianza (qué fracción del contorno se encontró) cae, así
 *    que el fallo se **ve** en vez de devolver una posición inventada con
 *    aplomo.
 * 3. **Perspectiva.** El disco es un círculo, así que su imagen es una elipse
 *    en cuanto la cámara deja de estar perpendicular. La relación entre sus
 *    ejes mide el ángulo directamente: `cos θ ≈ eje menor / eje mayor`. Eso es
 *    mejor que el giroscopio del teléfono, porque mide el ángulo **respecto a
 *    la barra**, no respecto a la gravedad.
 *
 * Lo que NO resuelve: el diámetro real en milímetros. Eso sigue siendo un dato
 * externo (lista desplegable de diámetros de disco), y sin él solo hay píxeles.
 */

/** Luminancia perceptual de un píxel del ImageData. */
export function luminancia(datos, indice) {
  return 0.299 * datos[indice] + 0.587 * datos[indice + 1] + 0.114 * datos[indice + 2]
}

/** Luminancia con interpolación bilineal: los rayos no caen en píxeles enteros. */
function luminanciaEn(datos, ancho, alto, x, y) {
  if (x < 0 || y < 0 || x >= ancho - 1 || y >= alto - 1) return NaN
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const fx = x - x0, fy = y - y0
  const l = (px, py) => luminancia(datos, (py * ancho + px) * 4)
  const arriba = l(x0, y0) * (1 - fx) + l(x0 + 1, y0) * fx
  const abajo = l(x0, y0 + 1) * (1 - fx) + l(x0 + 1, y0 + 1) * fx
  return arriba * (1 - fy) + abajo * fy
}

/**
 * Lanza rayos desde un centro y devuelve, por cada uno, el borde más marcado.
 *
 * Se busca el **último** borde fuerte dentro del radio máximo, no el primero: un
 * disco tiene agujero central, tornillos, letras y a veces un aro de color, y
 * todos ellos producen bordes interiores. El que interesa es el de fuera.
 */
export function bordesPorRayos(datos, ancho, alto, centro, opciones = {}) {
  const {
    nRayos = 64,
    radioMin = 6,
    radioMax = 140,
    umbralBorde = 12,
    paso = 1,
  } = opciones
  const puntos = []
  for (let k = 0; k < nRayos; k++) {
    const ang = (2 * Math.PI * k) / nRayos
    const dx = Math.cos(ang), dy = Math.sin(ang)
    let mejorR = NaN, mejorFuerza = 0
    let anterior = luminanciaEn(datos, ancho, alto, centro.x + dx * radioMin, centro.y + dy * radioMin)
    for (let r = radioMin + paso; r <= radioMax; r += paso) {
      const actual = luminanciaEn(datos, ancho, alto, centro.x + dx * r, centro.y + dy * r)
      if (Number.isNaN(actual)) break
      const fuerza = Math.abs(actual - anterior)
      if (fuerza >= umbralBorde && fuerza >= mejorFuerza * 0.6) {
        mejorR = r - paso / 2   // el borde está entre las dos muestras
        mejorFuerza = Math.max(mejorFuerza, fuerza)
      }
      anterior = actual
    }
    if (Number.isFinite(mejorR)) {
      puntos.push({
        x: centro.x + dx * mejorR,
        y: centro.y + dy * mejorR,
        ang,
        r: mejorR,
        fuerza: mejorFuerza,
      })
    }
  }
  return { puntos, nRayos }
}

/**
 * Lanza rayos desde un centro y devuelve TODOS los bordes de cada uno.
 *
 * `bordesPorRayos` se queda con el último borde fuerte dentro del radio máximo.
 * Eso funciona con fondo limpio y se rompe en un gimnasio: medido sobre un
 * fotograma real a 3 m, con un disco de 63 px de radio, el último borde de cada
 * rayo estaba en la pared del fondo y el ajuste devolvía 239 px. La escala
 * habría salido casi cuatro veces mayor, sin un solo aviso.
 *
 * Devolver los candidatos permite decidir DESPUÉS cuál es el contorno, mirando
 * las 64 direcciones a la vez en vez de cada rayo por su cuenta.
 */
export function candidatosPorRayos(datos, ancho, alto, centro, opciones = {}) {
  const { nRayos = 64, radioMin = 6, radioMax = 140, umbralBorde = 12, paso = 1 } = opciones
  const porRayo = []
  for (let k = 0; k < nRayos; k++) {
    const ang = (2 * Math.PI * k) / nRayos
    const dx = Math.cos(ang), dy = Math.sin(ang)
    const lista = []
    let anterior = luminanciaEn(datos, ancho, alto, centro.x + dx * radioMin, centro.y + dy * radioMin)
    for (let r = radioMin + paso; r <= radioMax; r += paso) {
      const actual = luminanciaEn(datos, ancho, alto, centro.x + dx * r, centro.y + dy * r)
      if (Number.isNaN(actual)) break
      const fuerza = Math.abs(actual - anterior)
      if (fuerza >= umbralBorde) {
        const rr = r - paso / 2
        lista.push({ x: centro.x + dx * rr, y: centro.y + dy * rr, ang, r: rr, fuerza })
      }
      anterior = actual
    }
    porRayo.push(lista)
  }
  return { porRayo, nRayos }
}

/**
 * ¿En qué radio coinciden más direcciones? Ese es el contorno.
 *
 * Un disco es lo único de la escena que da el MISMO radio en las 64
 * direcciones. La pared, la barra, el tapete y la mochila dan bordes fuertes,
 * pero cada uno a su distancia. Por eso la coincidencia entre rayos separa el
 * disco del decorado sin pedirle nada al usuario — que es el punto: cada
 * requisito de montaje es una razón para no usar la herramienta.
 *
 * La coincidencia sola NO basta, y esto costó una tarde en el gimnasio: sobre un
 * fotograma real, el disco puntuaba 0,548 y la pared del fondo 0,523. Se
 * distinguen por un 5 %, porque la tolerancia crece con el radio y a 230 px cabe
 * cualquier cosa dentro de la banda.
 *
 * Lo que sí los separa es la FÍSICA DE UN CANTO: un disco es oscuro por dentro y
 * el fondo es más claro por fuera —o al revés—, pero **el mismo sentido en las
 * 64 direcciones**. Medido en ese fotograma: el disco, 75 % de direcciones con
 * el mismo signo; la pared, 51 %, que es una moneda al aire. Ese término tira la
 * puntuación del decorado a la décima parte.
 *
 * `datos` hace falta para medirlo, así que esta función lee la imagen: el signo
 * no está en los bordes, está a un lado y a otro de ellos.
 */
export function radioMasVotado(datos, ancho, alto, centro, porRayo, nRayos, opciones = {}) {
  const {
    radioMin = 8,
    radioMax = 400,
    apoyoMin = 0.8,
    tolerancia = 0.25,
    dentro = 0.85,
    fuera = 1.15,
    coherenciaMin = 0.25,
    margenEmpate = 0.9,
  } = opciones

  // El apoyo mínimo no es un número de gusto. Un RECTÁNGULO pierde los rayos que
  // apuntan a sus esquinas —quedan fuera de cualquier banda que contenga a los
  // que apuntan a sus lados— y se queda en el 72 %. Un disco inclinado 25°,
  // medido en el gimnasio, conserva el 86 %; uno de frente, el 100 %. La puerta
  // va entre esos dos números, y la prueba del rectángulo la vigila.
  //
  // El precio: un disco medio tapado no se puede FIJAR. Se acepta porque fijar es
  // un acto deliberado y con vista despejada; el seguimiento posterior sí tolera
  // oclusión, que es donde de verdad hace falta.
  const lum = (x, y) => luminanciaEn(datos, ancho, alto, x, y)
  const evaluados = []

  for (let R = radioMin; R <= radioMax; R += 1) {
    const banda = R * tolerancia
    const elegidos = []
    for (const lista of porRayo) {
      let mejor
      for (const p of lista) {
        if (Math.abs(p.r - R) > banda) continue
        if (!mejor || p.fuerza > mejor.fuerza) mejor = p
      }
      if (mejor) elegidos.push(mejor)
    }
    const apoyo = elegidos.length / nRayos
    if (apoyo < apoyoMin) continue

    // La banda es ancha a propósito: nadie toca el centro exacto del disco, y un
    // toque descentrado 9 px hace que el mismo círculo se vea con radios que van
    // de 51 a 69. Por eso NO se puntúa por radio constante —eso castigaría el
    // descentrado igual que castiga un rectángulo— sino por lo bien que los
    // puntos elegidos caen en UNA CIRCUNFERENCIA, que absorbe el desplazamiento.
    const ajuste = ajusteRobusto(elegidos)
    if (!ajuste || !(ajuste.r > 0)) continue
    const redondez = ajuste.residuo / ajuste.r

    // Y la física del canto: dentro y fuera tienen que diferenciarse en el mismo
    // sentido en todas las direcciones. La pared del gimnasio da 51 % —una
    // moneda al aire—; un disco de verdad, 60-75 %.
    let masClaroFuera = 0, medidos = 0
    for (const p of elegidos) {
      const dx = Math.cos(p.ang), dy = Math.sin(p.ang)
      const li = lum(centro.x + dx * p.r * dentro, centro.y + dy * p.r * dentro)
      const lo = lum(centro.x + dx * p.r * fuera, centro.y + dy * p.r * fuera)
      if (Number.isNaN(li) || Number.isNaN(lo)) continue
      medidos++
      if (lo > li) masClaroFuera++
    }
    if (!medidos) continue
    const coherencia = Math.abs((2 * masClaroFuera) / medidos - 1)
    if (coherencia < coherenciaMin) continue

    evaluados.push({
      R, media: ajuste.r, apoyo, redondez, coherencia,
      puntuacion: (apoyo * coherencia) / (1 + redondez * 10),
      puntos: elegidos, ajuste,
    })
  }
  if (!evaluados.length) return undefined

  // Entre candidatos igual de buenos gana el MAYOR: un disco tiene buje,
  // tornillos y letras dentro, y esos anillos interiores ajustan tan bien como
  // el canto. Medido con la barra en el suelo, el buje ganaba por un 4 % y
  // devolvía 32 px donde el disco medía 103.
  const mejor = Math.max(...evaluados.map((e) => e.puntuacion))
  return evaluados
    .filter((e) => e.puntuacion >= mejor * margenEmpate)
    .reduce((a, b) => (b.media > a.media ? b : a))
}

/** Sistema 3x3 por regla de Cramer. Devuelve undefined si es degenerado. */
export function resolver3x3(M, b) {
  const det3 = (A) =>
    A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
    A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
    A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0])
  const det = det3(M)
  if (Math.abs(det) < 1e-9) return undefined
  return [0, 1, 2].map((col) => det3(M.map((fila, i) => fila.map((v, j) => (j === col ? b[i] : v)))) / det)
}

/**
 * Ajuste algebraico de circunferencia (Kåsa) por mínimos cuadrados.
 *
 * Resuelve x² + y² + Dx + Ey + F = 0, de donde centro = (−D/2, −E/2) y
 * r = √(cx² + cy² − F). Es lineal, así que no hace falta iterar ni sembrar.
 */
export function ajustarCircunferencia(puntos) {
  const n = puntos.length
  if (n < 5) return undefined
  let Sxx = 0, Syy = 0, Sxy = 0, Sx = 0, Sy = 0, Sxz = 0, Syz = 0, Sz = 0
  for (const p of puntos) {
    const z = p.x * p.x + p.y * p.y
    Sxx += p.x * p.x; Syy += p.y * p.y; Sxy += p.x * p.y
    Sx += p.x; Sy += p.y
    Sxz += p.x * z; Syz += p.y * z; Sz += z
  }
  const det =
    Sxx * (Syy * n - Sy * Sy) - Sxy * (Sxy * n - Sy * Sx) + Sx * (Sxy * Sy - Syy * Sx)
  if (Math.abs(det) < 1e-9) return undefined
  const b = [-Sxz, -Syz, -Sz]
  const M = [
    [Sxx, Sxy, Sx],
    [Sxy, Syy, Sy],
    [Sx, Sy, n],
  ]
  const detDe = (col) => {
    const A = M.map((fila, i) => fila.map((v, j) => (j === col ? b[i] : v)))
    return (
      A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
      A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
      A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0])
    )
  }
  const D = detDe(0) / det, E = detDe(1) / det, F = detDe(2) / det
  const cx = -D / 2, cy = -E / 2
  const bajoRaiz = cx * cx + cy * cy - F
  if (!(bajoRaiz > 0)) return undefined
  const r = Math.sqrt(bajoRaiz)
  let residuo = 0
  for (const p of puntos) residuo += Math.abs(Math.hypot(p.x - cx, p.y - cy) - r)
  return { x: cx, y: cy, r, residuo: residuo / n }
}

/** Ajuste con una pasada robusta: descarta los puntos que se van del consenso. */
export function ajusteRobusto(puntos) {
  const primero = ajustarCircunferencia(puntos)
  if (!primero) return undefined
  const desvios = puntos.map((p) => Math.abs(Math.hypot(p.x - primero.x, p.y - primero.y) - primero.r))
  const ordenados = [...desvios].sort((a, b) => a - b)
  const mediana = ordenados[Math.floor(ordenados.length / 2)]
  const tope = Math.max(2, mediana * 2.5)
  const buenos = puntos.filter((_, i) => desvios[i] <= tope)
  if (buenos.length < 5) return primero
  const segundo = ajustarCircunferencia(buenos)
  return segundo ? { ...segundo, usados: buenos.length } : primero
}

/**
 * Relación entre el eje mayor y el menor de lo que se ve.
 *
 * Con la cámara perpendicular vale ~1. Cuanto más torcida, más se aplasta la
 * imagen del disco: `cos θ ≈ 1 / relación`.
 *
 * **No se usan percentiles de los radios.** Parecía lo natural y estaba mal: en
 * una circunferencia dibujada sobre píxeles los radios ya varían solos, así que
 * el p90/p10 nunca baja de ~1,02 y la cámara perfectamente recta salía a 10°.
 * Un suelo de 10° convierte el aviso de encuadre en un aviso permanente, y un
 * aviso que siempre está encendido no lo lee nadie.
 *
 * Lo correcto es que una elipse tiene el radio ondulando con el DOBLE del
 * ángulo: r(θ) ≈ c₀ + c₁·cos2θ + c₂·sen2θ. Se ajustan los tres coeficientes por
 * mínimos cuadrados sobre todos los rayos —el ruido de discretización se
 * promedia y se va— y de ahí salen los semiejes: a = c₀+A, b = c₀−A, con
 * A = √(c₁²+c₂²).
 */
export function relacionDeEjes(puntos, centro) {
  if (puntos.length < 8) return undefined
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  const b = [0, 0, 0]
  for (const p of puntos) {
    const ang = Math.atan2(p.y - centro.y, p.x - centro.x)
    const base = [1, Math.cos(2 * ang), Math.sin(2 * ang)]
    const r = Math.hypot(p.x - centro.x, p.y - centro.y)
    for (let i = 0; i < 3; i++) {
      b[i] += base[i] * r
      for (let j = 0; j < 3; j++) M[i][j] += base[i] * base[j]
    }
  }
  const c = resolver3x3(M, b)
  if (!c) return undefined
  const [c0, c1, c2] = c
  const A = Math.hypot(c1, c2)
  if (!(c0 - A > 0)) return undefined
  return (c0 + A) / (c0 - A)
}

/** Grados que la cámara se sale de la perpendicular, deducidos de la elipse. */
export function anguloDeCamara(relacion) {
  if (!Number.isFinite(relacion) || relacion < 1) return 0
  return (Math.acos(Math.min(1, 1 / relacion)) * 180) / Math.PI
}

/**
 * ¿Lo que el usuario tocó es un disco?
 *
 * Un disco da radios consistentes en todas las direcciones. Una mancuerna, una
 * pierna o una mancha de luz, no. Devuelve el veredicto y por qué, para poder
 * decírselo en pantalla en vez de fallar en silencio.
 */
export function identificarEstructura(datos, ancho, alto, punto, opciones = {}) {
  const { porRayo, nRayos } = candidatosPorRayos(datos, ancho, alto, punto, opciones)
  const votado = radioMasVotado(datos, ancho, alto, punto, porRayo, nRayos, {
    radioMax: opciones.radioMax ?? 140,
    ...(opciones.voto ?? {}),
  })
  if (!votado) {
    const vistos = porRayo.filter((l) => l.length).length / nRayos
    return { tipo: 'desconocida', motivo: 'no se ve un contorno cerrado', cobertura: vistos }
  }
  const puntos = votado.puntos
  const cobertura = votado.apoyo
  if (cobertura < 0.5) {
    return { tipo: 'desconocida', motivo: 'no se ve un contorno cerrado', cobertura }
  }
  const ajuste = ajusteRobusto(puntos)
  if (!ajuste) return { tipo: 'desconocida', motivo: 'no se pudo ajustar', cobertura }
  const relacion = relacionDeEjes(puntos, ajuste)
  // Un residuo por encima del 8 % del radio ya no es una circunferencia.
  const redondez = ajuste.residuo / ajuste.r
  if (redondez > 0.08) {
    return { tipo: 'no-circular', motivo: 'el contorno no es redondo', redondez, cobertura, ajuste }
  }
  return {
    tipo: 'disco',
    ajuste,
    cobertura,
    redondez,
    relacionEjes: relacion,
    anguloCamara: anguloDeCamara(relacion),
  }
}

/**
 * Detección de un fotograma, dentro de una ventana alrededor de lo previsto.
 *
 * `prediccion` es dónde debería estar el centro (posición anterior + velocidad).
 * Acotar la búsqueda no es solo velocidad: **es una reja de plausibilidad**. La
 * barra no puede saltar 40 cm entre dos fotogramas a 60 fps —serían 24 m/s—, así
 * que un ajuste que caiga fuera de la ventana es un error de detección, no un
 * movimiento, y se descarta en vez de guardarlo.
 */
export function detectarDisco(datos, ancho, alto, prediccion, radioEsperado, opciones = {}) {
  const { saltoMaxPx = 40, toleranciaRadio = 0.25, minCobertura = 0.6, coberturaBuena = 0.9 } = opciones
  const { puntos, nRayos } = bordesPorRayos(datos, ancho, alto, prediccion, {
    ...opciones,
    radioMin: Math.max(4, radioEsperado * (1 - toleranciaRadio)),
    radioMax: radioEsperado * (1 + toleranciaRadio),
  })
  const cobertura = puntos.length / nRayos
  if (cobertura < minCobertura) return { ok: false, motivo: 'marcador_perdido', cobertura }

  const ajuste = ajusteRobusto(puntos)
  if (!ajuste) return { ok: false, motivo: 'marcador_perdido', cobertura }

  const salto = Math.hypot(ajuste.x - prediccion.x, ajuste.y - prediccion.y)
  if (salto > saltoMaxPx) return { ok: false, motivo: 'salto_imposible', cobertura, salto }
  if (Math.abs(ajuste.r - radioEsperado) / radioEsperado > toleranciaRadio) {
    return { ok: false, motivo: 'radio_incoherente', cobertura, r: ajuste.r }
  }

  const relacion = relacionDeEjes(puntos, ajuste)
  return {
    ok: true,
    // Con el disco medio tapado el ajuste SALE, y sale con un error de un par de
    // píxeles. No se rechaza —tirar el dato sería peor— pero tampoco se le da la
    // misma confianza: por debajo del 90 % de contorno visto, el fotograma va
    // marcado y la serie acaba en `dudosa`. La diferencia entre un instrumento y
    // un adivino es que el instrumento dice cuánto se fía.
    fiable: cobertura >= coberturaBuena,
    x: ajuste.x,
    y: ajuste.y,
    r: ajuste.r,
    // El diámetro visto hace de "separación entre marcadores": es la escala.
    sepPx: ajuste.r * 2,
    cobertura,
    relacionEjes: relacion,
    anguloGrados: anguloDeCamara(relacion),
    residuo: ajuste.residuo,
  }
}

/**
 * Diámetros reales de disco, para la lista desplegable.
 *
 * Es el único dato que la cámara no puede deducir sola, y se pregunta **una vez
 * por montaje**, no por serie. Los de goma de competición son todos de 450 mm;
 * los de hierro varían por fabricante, y por eso está la opción de teclearlo.
 */
export const DIAMETROS_DISCO_MM = [
  { etiqueta: 'Bumper / competición (450 mm)', mm: 450 },
  { etiqueta: 'Olímpico 20-25 kg (450 mm)', mm: 450 },
  { etiqueta: 'Olímpico 15 kg (400 mm)', mm: 400 },
  { etiqueta: 'Olímpico 10 kg hierro (325 mm)', mm: 325 },
  { etiqueta: 'Disco de técnica (450 mm)', mm: 450 },
]

/**
 * ¿El recorrido medido es plausible para ese ejercicio?
 *
 * Reja contra el error de escala, que es el que más daño hace porque produce
 * números creíbles: si el diámetro elegido no es el del disco que hay puesto,
 * TODAS las velocidades salen desviadas por el mismo factor y nada chirría. Un
 * recorrido de sentadilla de 1,4 m sí chirría.
 */
export const ROM_PLAUSIBLE_M = {
  sentadilla: [0.25, 0.85],
  'peso muerto': [0.3, 0.85],
  'press banca': [0.15, 0.55],
  'hip thrust': [0.15, 0.5],
  remo: [0.2, 0.7],
  jalon: [0.3, 0.8],
  generico: [0.1, 1.2],
}

export function romPlausible(romM, ejercicio = 'generico') {
  const clave = Object.keys(ROM_PLAUSIBLE_M).find((k) =>
    (ejercicio || '').toLowerCase().includes(k),
  ) ?? 'generico'
  const [min, max] = ROM_PLAUSIBLE_M[clave]
  if (!Number.isFinite(romM)) return { ok: false, motivo: 'sin ROM' }
  if (romM < min || romM > max) {
    return {
      ok: false,
      motivo: `recorrido de ${romM.toFixed(2)} m fuera de lo plausible para ${clave} (${min}-${max} m). Revisa el diámetro del disco`,
      clave,
    }
  }
  return { ok: true, clave }
}
