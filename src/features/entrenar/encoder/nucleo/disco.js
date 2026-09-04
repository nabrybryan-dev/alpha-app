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

/** Cuánto se aparta un punto de una elipse, en píxeles, medido radialmente. */
export function desvioDeElipse(punto, elipse) {
  const dx = punto.x - elipse.x, dy = punto.y - elipse.y
  const cos = Math.cos(elipse.giro), sin = Math.sin(elipse.giro)
  const u = (dx * cos + dy * sin) / elipse.semiMayor
  const v = (-dx * sin + dy * cos) / elipse.semiMenor
  const norma = Math.hypot(u, v)
  if (!Number.isFinite(norma)) return Infinity
  return Math.abs(norma - 1) * elipse.semiMayor
}

/**
 * Aprieta el contorno: repite el ajuste quedándose con el borde MÁS CERCANO a la
 * elipse que ya se tiene, dentro de una banda estrecha.
 *
 * Sin esto el radio sale sistemáticamente GRANDE, y no por poco: con ruido alto,
 * un disco de 70 px se medía en 87. La causa está en el voto — su tolerancia es
 * relativa (±25 % del radio), así que cuanto mayor es el radio más ancha es la
 * red, y con ruido el apoyo se consigue barato ahí fuera. El resultado es un
 * sesgo que siempre empuja hacia afuera, nunca hacia adentro, y eso es escala:
 * un 13 % de más en el radio es un 13 % de más en toda velocidad.
 *
 * La banda estrecha invierte el incentivo: ya no gana el radio que reúne más
 * bordes cualesquiera, gana el que reúne los bordes que de verdad caen sobre una
 * elipse. Se itera porque la primera pasada aún arrastra el sesgo de la anterior.
 */
export function afinarContorno(porRayo, nRayos, elipse, opciones = {}) {
  // La banda se estrecha por pasos en vez de empezar apretada. Empezando en
  // 0,10 el afinado no puede ENSANCHAR la elipse: selecciona puntos cerca de la
  // forma que ya tiene y esa forma se congela. Con un disco a 10° —una elipse de
  // relación 1,016— eso borraba la inclinación entera y la devolvía como 0°.
  const { bandas = [0.25, 0.15, 0.10], apoyoMin = 0.5 } = opciones
  let mejorElipse = elipse
  let mejoresPuntos = null
  for (const banda of bandas) {
    const puntos = []
    for (const lista of porRayo) {
      let elegido, mejorD = Infinity
      for (const p of lista) {
        const d = desvioDeElipse(p, mejorElipse)
        if (d > mejorElipse.semiMayor * banda) continue
        if (d < mejorD) { mejorD = d; elegido = p }
      }
      if (elegido) puntos.push(elegido)
    }
    if (puntos.length < nRayos * apoyoMin) break
    const circulo = ajusteRobusto(puntos)
    const nueva = circulo && elipseRobusta(puntos, circulo)
    if (!nueva) break
    mejorElipse = { ...nueva, x: circulo.x, y: circulo.y }
    mejoresPuntos = puntos
  }
  return mejoresPuntos ? { elipse: mejorElipse, puntos: mejoresPuntos } : undefined
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
    // Se puntúa con ELIPSE. Con circunferencia, un disco inclinado 40° puntuaba
    // peor que la pared por el simple hecho de estar torcido.
    const circulo = ajusteRobusto(elegidos)
    if (!circulo || !(circulo.r > 0)) continue
    const ajuste = elipseRobusta(elegidos, circulo)
    if (!ajuste || !(ajuste.semiMayor > 0)) continue
    const redondez = ajuste.residuo / ajuste.semiMayor

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
      R, media: ajuste.semiMayor, apoyo, redondez, coherencia, circulo,
      // El centro viaja siempre con la elipse: `elipseDesdeCentro` solo devuelve
      // ejes, y quien la reciba no tiene por qué saber de dónde salió el centro.
      ajuste: { ...ajuste, x: circulo.x, y: circulo.y },
      puntuacion: (apoyo * coherencia) / (1 + redondez * 10),
      puntos: elegidos,
    })
  }
  if (!evaluados.length) return undefined

  // Entre candidatos igual de buenos gana el MAYOR: un disco tiene buje,
  // tornillos y letras dentro, y esos anillos interiores ajustan tan bien como
  // el canto. Medido con la barra en el suelo, el buje ganaba por un 4 % y
  // devolvía 32 px donde el disco medía 103.
  const mejor = Math.max(...evaluados.map((e) => e.puntuacion))
  const elegido = evaluados
    .filter((e) => e.puntuacion >= mejor * margenEmpate)
    .reduce((a, b) => (b.media > a.media ? b : a))

  if (!elegido.ajuste || !elegido.circulo) return elegido

  // El afinado solo se aplica si el contorno viene SUCIO. El sesgo hacia afuera
  // que corrige nace del ruido; con un contorno limpio no hay nada que apretar y
  // sí algo que perder: una elipse a 10° de cámara se aparta medio píxel de la
  // circunferencia, y reelegir puntos dentro de una banda la borra entera —el
  // ángulo pasaba de 10° a 0°—. Por debajo del 3 % de residuo se deja como está.
  const suciedad = elegido.ajuste.residuo / elegido.ajuste.semiMayor
  if (suciedad < 0.03) return elegido

  const partida = { ...elegido.ajuste, x: elegido.circulo.x, y: elegido.circulo.y }
  const apretado = afinarContorno(porRayo, nRayos, partida)
  if (!apretado) return elegido
  return {
    ...elegido,
    media: apretado.elipse.semiMayor,
    apoyo: apretado.puntos.length / nRayos,
    puntos: apretado.puntos,
    // Las esquinas se juzgan con el contorno ANCHO, antes de apretar. Apretar
    // descarta justo los puntos que se salen —que en un rectángulo son las
    // esquinas—, así que después de afinar cualquier cosa parece una elipse.
    ajuste: { ...apretado.elipse, esquinas: Math.max(apretado.elipse.esquinas ?? 0, elegido.ajuste.esquinas ?? 0) },
  }
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

/** Elimina un sistema n×n por Gauss con pivoteo. undefined si es singular. */
export function resolverNxN(A, b) {
  const n = A.length
  const M = A.map((fila, i) => [...fila, b[i]])
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let f = col + 1; f < n; f++) if (Math.abs(M[f][col]) > Math.abs(M[piv][col])) piv = f
    if (Math.abs(M[piv][col]) < 1e-12) return undefined
    ;[M[col], M[piv]] = [M[piv], M[col]]
    for (let f = 0; f < n; f++) {
      if (f === col) continue
      const k = M[f][col] / M[col][col]
      for (let c = col; c <= n; c++) M[f][c] -= k * M[col][c]
    }
  }
  return M.map((fila, i) => fila[n] / fila[i])
}

/**
 * Ajuste de ELIPSE, que es lo que de verdad se ve.
 *
 * Un disco es un círculo, pero su imagen solo es un círculo si la cámara está
 * perpendicular a su cara. En cuanto se tuerce —y en un gimnasio siempre se
 * tuerce— es una elipse, y ajustarle una circunferencia tiene dos consecuencias
 * que se pagan en sitios distintos:
 *
 * 1. **La detección se cae.** El residuo de meter una circunferencia en una
 *    elipse crece con la inclinación: a 25° ya roza el 8 % que separa «disco» de
 *    «no es redondo», y a 40° lo dobla. Medido en el banco: a 25° y a 40° la
 *    herramienta no fijaba nada.
 * 2. **La escala se queda corta.** La circunferencia ajustada cae en el radio
 *    MEDIO, y el diámetro real del disco se ve entero solo en el eje MAYOR. Son
 *    6-9 % de menos, sistemático, que entran multiplicando en toda velocidad.
 *
 * Esto ya estaba escrito en la doctrina del motor para la diana de cuatro
 * marcas: `sigma_max` es la escala, inmune al escorzo, y `sigma_min/sigma_max`
 * es el coseno del ángulo. La elipse del disco es el mismo teorema con otra
 * forma: semieje mayor = escala, menor/mayor = cos θ.
 *
 * Ajusta la cónica a·x² + b·xy + c·y² + d·x + e·y − 1 = 0 por mínimos cuadrados,
 * con los puntos centrados y normalizados antes (si no, x² y x conviven en la
 * misma matriz con seis órdenes de magnitud de diferencia y el sistema se vuelve
 * numéricamente sordo).
 */
export function ajustarElipse(puntos) {
  if (puntos.length < 6) return undefined
  const n = puntos.length
  const mx = puntos.reduce((s, p) => s + p.x, 0) / n
  const my = puntos.reduce((s, p) => s + p.y, 0) / n
  const escala = Math.sqrt(puntos.reduce((s, p) => s + (p.x - mx) ** 2 + (p.y - my) ** 2, 0) / n) || 1
  const q = puntos.map((p) => ({ x: (p.x - mx) / escala, y: (p.y - my) / escala }))

  // Normales de mínimos cuadrados para [a,b,c,d,e] con el término independiente
  // fijado a −1: el origen está dentro de la elipse tras centrar, así que ese
  // coeficiente no puede ser cero y la normalización es legítima.
  const filas = q.map((p) => [p.x * p.x, p.x * p.y, p.y * p.y, p.x, p.y])
  const A = Array.from({ length: 5 }, (_, i) => Array.from({ length: 5 }, (_, j) =>
    filas.reduce((s, f) => s + f[i] * f[j], 0)))
  const bb = Array.from({ length: 5 }, (_, i) => filas.reduce((s, f) => s + f[i], 0))
  const sol = resolverNxN(A, bb)
  if (!sol) return undefined
  const [a, b, c, d, e] = sol
  const f = -1

  // ¿Es una elipse? b² − 4ac < 0. Si no, lo que se tocó no era un disco.
  if (!(b * b - 4 * a * c < 0)) return undefined

  const den = 4 * a * c - b * b
  const x0 = (b * e - 2 * c * d) / den
  const y0 = (b * d - 2 * a * e) / den
  const F0 = a * x0 * x0 + b * x0 * y0 + c * y0 * y0 + d * x0 + e * y0 + f
  // Autovalores de [[a, b/2], [b/2, c]]: los ejes de la elipse.
  const media = (a + c) / 2
  const raiz = Math.sqrt(((a - c) / 2) ** 2 + (b / 2) ** 2)
  const l1 = media + raiz, l2 = media - raiz
  if (!(l1 > 0 && l2 > 0) || F0 >= 0) return undefined
  const ejeA = Math.sqrt(-F0 / l2)   // el menor autovalor da el eje MAYOR
  const ejeB = Math.sqrt(-F0 / l1)
  // `atan2(b, a−c)` apunta al autovector del autovalor MAYOR, que es el eje
  // MENOR de la elipse. El eje mayor está a 90° de ahí, y confundirlos no cambia
  // los ejes pero sí el residuo: mide contra una elipse girada un cuarto de
  // vuelta y sale enorme con los datos perfectos.
  const giro = 0.5 * Math.atan2(b, a - c) + Math.PI / 2

  // Residuo geométrico aproximado, en píxeles del original.
  const cos = Math.cos(giro), sin = Math.sin(giro)
  const residuos = q.map((p) => {
    const dx = p.x - x0, dy = p.y - y0
    const u = (dx * cos + dy * sin) / ejeA
    const v = (-dx * sin + dy * cos) / ejeB
    return Math.abs(Math.hypot(u, v) - 1) * ejeA * escala
  })
  const residuo = Math.sqrt(residuos.reduce((s, r) => s + r * r, 0) / residuos.length)

  return {
    x: mx + x0 * escala, y: my + y0 * escala,
    semiMayor: ejeA * escala, semiMenor: ejeB * escala,
    giro, residuo, residuos,
  }
}

/** Ajuste de elipse descartando el 25 % de puntos peores y repitiendo. */
export function ajusteRobustoElipse(puntos) {
  const primero = ajustarElipse(puntos)
  if (!primero) return undefined
  const orden = puntos
    .map((p, i) => ({ p, r: primero.residuos[i] }))
    .sort((u, v) => u.r - v.r)
  const buenos = orden.slice(0, Math.max(6, Math.floor(puntos.length * 0.75))).map((o) => o.p)
  return ajustarElipse(buenos) ?? primero
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
  const Abruto = Math.hypot(c1, c2)
  return (c0 + A) / (c0 - A)
}

/**
 * Los DOS ejes de la elipse, a partir de un centro ya conocido.
 *
 * Ajusta r(θ) = c₀ + c₁·cos2θ + c₂·sin2θ, que es la forma de primer orden del
 * radio de una elipse vista desde su centro. De ahí salen los dos semiejes
 * —c₀+A y c₀−A, con A = |(c₁,c₂)|— y la dirección del mayor.
 *
 * Es el mismo ajuste que `relacionDeEjes` ya hacía para medir el ángulo de
 * cámara. Lo nuevo no es la matemática: es darse cuenta de que **el semieje
 * MAYOR es la escala**. La circunferencia ajustada cae en c₀, el radio medio, y
 * eso deja la escala un 6-9 % corta en cuanto la cámara se tuerce, que es
 * siempre. El diámetro real solo se ve entero en la dirección larga.
 *
 * Frente a ajustar una cónica completa tiene dos ventajas que se pagan caras en
 * el gimnasio: son tres incógnitas en vez de cinco —con el disco medio tapado la
 * cónica se desboca y el centro se iba a 1,7 px— y a excentricidad pequeña es
 * mucho más estable, que es justo donde hay que distinguir 10° de 0°.
 *
 * El residuo se mide contra ESA elipse. Un rectángulo no la cumple: su radio
 * tiene cuatro lóbulos y este ajuste solo puede representar dos, así que el
 * sobrante se queda en el residuo y lo delata.
 */
export function elipseDesdeCentro(puntos, centro) {
  if (puntos.length < 8) return undefined
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  const b = [0, 0, 0]
  const filas = []
  for (const p of puntos) {
    const ang = Math.atan2(p.y - centro.y, p.x - centro.x)
    const base = [1, Math.cos(2 * ang), Math.sin(2 * ang)]
    const r = Math.hypot(p.x - centro.x, p.y - centro.y)
    filas.push({ base, r })
    for (let i = 0; i < 3; i++) {
      b[i] += base[i] * r
      for (let j = 0; j < 3; j++) M[i][j] += base[i] * base[j]
    }
  }
  const c = resolver3x3(M, b)
  if (!c) return undefined
  const [c0, c1, c2] = c
  const Abruto = Math.hypot(c1, c2)

  const residuos = filas.map((f) => f.r - (c[0] * f.base[0] + c[1] * f.base[1] + c[2] * f.base[2]))
  const residuo = Math.sqrt(residuos.reduce((s, r) => s + r * r, 0) / residuos.length)

  // ¿Cuánto de lo que sobra tiene forma de ESQUINAS? Un rectángulo, un banco o
  // una placa cuadrada tienen cuatro lóbulos; una elipse solo dos, y por eso el
  // término de 4θ los delata aunque el residuo total sea parecido. Medido: el
  // rectángulo de las pruebas da 12,3 % y los discos reales del banco, entre
  // 2,6 % y 4,7 % — incluso los oscuros, movidos y con la barra al lado.
  const M4 = [[0, 0], [0, 0]], b4 = [0, 0]
  for (const f of filas) {
    const ang = Math.atan2(f.base[2], f.base[1]) / 2
    const g = [Math.cos(4 * ang), Math.sin(4 * ang)]
    const resto = f.r - (c[0] * f.base[0] + c[1] * f.base[1] + c[2] * f.base[2])
    for (let i = 0; i < 2; i++) {
      b4[i] += g[i] * resto
      for (let j = 0; j < 2; j++) M4[i][j] += g[i] * g[j]
    }
  }
  // SESGO DE LA AMPLITUD. `A` es el módulo de dos coeficientes ruidosos, y un
  // módulo nunca sale negativo: el ruido lo empuja siempre hacia arriba. Con un
  // disco de frente eso inventa inclinación, y con uno inclinado infla el
  // semieje mayor —que es la escala—. Medido en el banco: +9 % con ruido, +25 %
  // con ruido alto, siempre por exceso y nunca por defecto, que es la firma de
  // un sesgo y no de un error aleatorio.
  //
  // E[A²] ≈ A_real² + 2σ²/n para dos parámetros ajustados, así que se resta esa
  // parte. Cuando el ruido domina, A_real cae a cero: un disco ruidoso se
  // declara redondo, que es lo prudente — perder inclinación real cuesta un
  // coseno, e inventarla cuesta la escala.
  const varianza = residuo * residuo
  const A = Math.sqrt(Math.max(0, Abruto * Abruto - (2 * varianza) / filas.length))
  if (!(c0 - A > 0)) return undefined

  const det4 = M4[0][0] * M4[1][1] - M4[0][1] * M4[1][0]
  const esquinas = Math.abs(det4) < 1e-9 ? 0 : Math.hypot(
    (b4[0] * M4[1][1] - b4[1] * M4[0][1]) / det4,
    (M4[0][0] * b4[1] - M4[1][0] * b4[0]) / det4,
  ) / c0

  return {
    esquinas,
    semiMayor: c0 + A,
    semiMenor: c0 - A,
    giro: Math.atan2(c2, c1) / 2,
    relacion: (c0 + A) / (c0 - A),
    residuo,
    residuos,
  }
}

/**
 * La elipse, quitando solo los atípicos GRUESOS.
 *
 * Aquí hubo que elegir con cuidado, y las dos formas obvias fallan:
 *
 * - **Sin descartar nada**, unos pocos rayos enganchados a un reflejo, a la
 *   barra o a una sombra pegada al canto se comen el criterio de forma: en el
 *   banco de fotogramas reales, el 94 % de los casos acababa en «el contorno no
 *   es redondo».
 * - **Descartando un cupo fijo** —el 25 % peor, como hace el ajuste de
 *   circunferencia— se tiran justo las puntas del eje MAYOR, que en una elipse
 *   de verdad son las que más se separan de la media. Eso aplana la
 *   excentricidad y con ella el ángulo: un disco de frente pasaba a medir 5,5°
 *   de inclinación, y uno a 10° bajaba a 4,5°.
 *
 * Lo que funciona es un umbral por MAD: fuera lo que se aparta más de tres
 * desviaciones robustas, que es donde vive la barra y no el disco. Un contorno
 * limpio no pierde ni un punto, y la eccentricidad —que ES la medida del
 * ángulo— se queda intacta.
 */
export function elipseRobusta(puntos, centro) {
  const primera = elipseDesdeCentro(puntos, centro)
  if (!primera) return undefined
  const abs = primera.residuos.map(Math.abs).slice().sort((a, b) => a - b)
  const mad = abs[Math.floor(abs.length / 2)] || 0
  // 1,4826·MAD estima la desviación típica de una gaussiana sin dejarse
  // arrastrar por las colas. El suelo de 0,5 px evita que un contorno
  // perfectamente ajustado se ponga a descartar sus propios redondeos.
  const limite = Math.max(3 * 1.4826 * mad, 0.5)
  const buenos = puntos.filter((_, i) => Math.abs(primera.residuos[i]) <= limite)
  if (buenos.length < Math.max(8, puntos.length * 0.6)) return primera
  return elipseDesdeCentro(buenos, centro) ?? primera
}

/** Grados que la cámara se sale de la perpendicular, deducidos de la elipse. */
export function anguloDeCamara(relacion) {
  if (!Number.isFinite(relacion) || relacion < 1) return 0
  return (Math.acos(Math.min(1, 1 / relacion)) * 180) / Math.PI
}

/**
 * Cuanto del lado corto del encuadre puede ocupar un disco, como mucho.
 *
 * NO es una señal de forma, y por eso existe: las de forma ya se midieron y no
 * separan —una pila de discos coaxiales ES redonda y se ajusta de maravilla, así
 * que `cobertura`, `redondez` y `esquinas` dan lo mismo para la cara del primer
 * disco que para la pila entera (`banco/calidad-vs-error.mjs`)—.
 *
 * El argumento es físico, no estadístico. Un disco mide 450 mm. Para que ocupara
 * la mitad del lado corto, ese lado tendría que abarcar 0,9 m en el plano del
 * atleta — y ahí no cabe ni la barra, que mide 2,2 m, ni la persona de pie. Si el
 * ajuste dice que el disco ocupa más de eso, lo que se ha ajustado no es un disco
 * de una serie grabada.
 *
 * ## El umbral, y el error que costó ponerlo bien
 *
 * El primer intento fue 0,50, elegido midiendo «¿cuántos casos BUENOS tira?» con
 * bueno = «el detector acertó dentro del 5 %». Con esa definición no tiraba
 * ninguno, y era una medida mal planteada: las cuatro escenas `--grande` del
 * banco tienen una VERDAD de 0,667 —el disco de verdad ocupa el 67 % del lado
 * corto— y el detector las fallaba por un 9-19 %, así que contaban como malas y
 * rechazarlas parecía un acierto. No lo era: son escenas legítimas que la reja
 * rechazaba por ser lo que son, y ningún detector las habría salvado.
 *
 * La pregunta correcta no es a quién tira HOY sino **a quién tiraría siempre**:
 * cuántas escenas tienen la verdad por encima del umbral. Eso no depende del
 * detector (`banco/donde-va-la-reja.mjs`).
 *
 * Verdad máxima del banco: 0,667. De un fotograma real de gimnasio: 0,298. Se
 * elige **0,75**, por encima de la máxima, para no rechazar nada legítimo. El
 * 0,30 de los fotogramas reales NO justifica bajarlo: son 16 fotogramas de dos
 * escenas, y no son el mundo.
 *
 * A 0,75 esta reja atrapa poco por su cuenta —el trabajo de verdad lo hace la de
 * «cabe en el encuadre»—, y se queda igual: es un techo físico, barato, que no
 * cuesta ni una medida buena.
 */
export const FRACCION_MARCO_MAX = 0.75

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
  // La elipse ya la trae el voto —afinada y con las esquinas medidas sobre el
  // contorno ancho—. Recalcularla aquí desde los puntos ya apretados borraba las
  // dos cosas: las esquinas de un rectángulo y la inclinación de un disco a 10°.
  const elipse = votado.ajuste ?? (() => {
    const c = ajusteRobusto(puntos)
    return c && elipseRobusta(puntos, c)
  })()
  if (!elipse) return { tipo: 'desconocida', motivo: 'no se pudo ajustar', cobertura }
  const circulo = { x: elipse.x, y: elipse.y, r: elipse.semiMayor, residuo: elipse.residuo }
  const relacion = elipse.relacion
  // El residuo se mide contra la ELIPSE, no contra una circunferencia: un disco
  // inclinado sigue siendo un contorno perfecto, solo que escorzado. Antes, a
  // 25° ya rozaba este 8 % y a 40° lo doblaba, y la herramienta se negaba a
  // fijar el disco justo en los encuadres que hay en un gimnasio de verdad.
  const redondez = elipse.residuo / elipse.semiMayor
  // Dos criterios distintos para dos cosas distintas. ESQUINAS dice «esto no es
  // un disco» y es el que rechaza rectángulos. El residuo dice «esto es un disco
  // mal visto» y por eso puede ser laxo: un disco de verdad en penumbra, movido
  // o con la barra pegada al canto da 8-13 % de residuo, y el umbral de 8 %
  // heredado de la circunferencia tumbaba 23 de los 49 casos del banco.
  if (elipse.esquinas > 0.08) {
    return { tipo: 'no-circular', motivo: 'eso tiene esquinas: un disco no las tiene', redondez, esquinas: elipse.esquinas, cobertura, ajuste: { ...circulo, ...elipse, r: elipse.semiMayor } }
  }
  if (redondez > 0.16) {
    return { tipo: 'no-circular', motivo: 'el contorno no es redondo', redondez, cobertura, ajuste: { ...circulo, ...elipse, r: elipse.semiMayor } }
  }
  // ── Dos rejas que NO miran la forma ────────────────────────────────────────
  //
  // Hasta aquí todo lo comprobado es forma, y la forma no distingue la cara del
  // primer disco de la pila entera: las dos son redondas y las dos se ajustan
  // bien. Medido, el peor fallo del banco (+247 % de escala) pasa las tres
  // comprobaciones de arriba con los tres indicadores dentro de lo normal.
  //
  // Y no hay nadie detrás que lo cace: el rastreador acota la búsqueda a
  // `radioEsperado × (1 ± 0,25)` y luego compara contra ese mismo radio, así que
  // HEREDA la semilla y la certifica —con la semilla envenenada devuelve
  // `fiable: true`, y con la buena `fiable: false`—. Ver `banco/semilla-envenenada.mjs`.
  //
  // Estas dos son lo único que puede auditar el arranque, porque no salen del
  // contorno sino del encuadre.
  const desborda = circulo.x - circulo.r < 0 || circulo.x + circulo.r > ancho ||
                   circulo.y - circulo.r < 0 || circulo.y + circulo.r > alto
  if (desborda) {
    // Un disco más ancho que la propia imagen no es un disco. Es la comprobación
    // más tonta posible y por eso vale: no depende del contraste ni de la luz.
    return { tipo: 'desconocida', motivo: 'el disco ajustado no cabe en el encuadre', cobertura, redondez, ajuste: { ...circulo, ...elipse, r: elipse.semiMayor } }
  }
  const fraccion = (circulo.r * 2) / Math.min(ancho, alto)
  if (fraccion > FRACCION_MARCO_MAX) {
    return { tipo: 'desconocida', motivo: 'el disco ajustado se come el encuadre: no cabría la serie', cobertura, redondez, fraccion, ajuste: { ...circulo, ...elipse, r: elipse.semiMayor } }
  }

  return {
    tipo: 'disco',
    // `r` es el SEMIEJE MAYOR, que es la escala inmune al escorzo: el diámetro
    // real solo se ve entero en esa dirección. El radio medio de una
    // circunferencia ajustada se queda un 6-9 % corto en cuanto hay inclinación.
    ajuste: { ...circulo, ...elipse, r: elipse.semiMayor },
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

  const circulo = ajusteRobusto(puntos)
  if (!circulo) return { ok: false, motivo: 'marcador_perdido', cobertura }
  const elipse = elipseRobusta(puntos, circulo)
  if (!elipse) return { ok: false, motivo: 'marcador_perdido', cobertura }
  // `r` del seguimiento es el semieje MAYOR: es lo que se convierte en `sepPx`,
  // y `sepPx` es la escala de la medición entera. El centro sigue saliendo de la
  // circunferencia, que con el disco medio tapado es mucho más estable.
  const ajuste = { ...circulo, r: elipse.semiMayor }

  const salto = Math.hypot(ajuste.x - prediccion.x, ajuste.y - prediccion.y)
  if (salto > saltoMaxPx) return { ok: false, motivo: 'salto_imposible', cobertura, salto }
  if (Math.abs(ajuste.r - radioEsperado) / radioEsperado > toleranciaRadio) {
    return { ok: false, motivo: 'radio_incoherente', cobertura, r: ajuste.r }
  }

  const relacion = elipse.relacion
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

// ─────────────────────────────────────────────────────────────────────────────
// La escala de una barra: dos discos, no uno
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Salto de escala entre los dos extremos de la barra por encima del cual un
 * solo disco deja de servir para fijar la escala.
 *
 * Un 15 % de error en mm/px va lineal al brazo de momento y a la velocidad, y
 * es del orden del criterio de muerte de la rama. Por debajo, coger un disco u
 * otro da igual; por encima, decide el número.
 */
export const SALTO_DE_ESCALA_MAX = 0.15

/**
 * La escala en el plano del atleta, sacada de los discos de LOS DOS extremos.
 *
 * ## Por qué no vale un disco
 *
 * Esto no es teoría: lo obligó el corpus de 168 vídeos reales de gimnasio
 * (CORPUS.md §2). La barra mide 2,2 m y **apunta hacia la cámara**, así que sus
 * dos extremos están a distancias muy distintas del móvil. Medido sobre un peso
 * muerto a 1080×1920 con el teléfono en el suelo a un metro:
 *
 *     disco cercano   eje mayor 197 px  →  2,28 mm/px
 *     disco lejano    eje mayor 125 px  →  3,60 mm/px
 *
 * Un 58 % de diferencia entre los dos extremos de la MISMA barra. El atleta
 * está en medio, así que fijar la escala con el disco que se detecte primero
 * mete un sesgo de hasta la mitad del brazo de momento — y siempre en la misma
 * dirección, que es la clase de error que no hace ruido.
 *
 * ## Dos correcciones, y son distintas
 *
 * 1. **La escala**, que se interpola entre los dos discos hasta donde la barra
 *    cruza el plano sagital del atleta: las manos.
 * 2. **El escorzo anteroposterior.** El eje MAYOR de la elipse es la vertical y
 *    no se comprime nunca, así que da los mm/px verticales tal cual. Pero un
 *    brazo de momento es una distancia ANTEROPOSTERIOR, y ésa sí sale
 *    comprimida por cos φ. Hay que dividir por él.
 *
 * Las dos van juntas porque las dos salen del mismo par de elipses, y separarlas
 * es cómo se aplica una y se olvida la otra.
 *
 * @param cerca  {x, semiMayor, semiMenor} del disco más cercano a la cámara
 * @param lejos  lo mismo del otro extremo. Si falta, se devuelve la escala del
 *               único disco y `fiable: false`: un disco no sabe que le falta el otro.
 */
export function escalaDeLaBarra(cerca, lejos, diametroMm = 450) {
  const mmPorPxDe = (d) => diametroMm / (2 * d.semiMayor)
  const fiDe = (d) => anguloDeCamara(d.semiMayor / d.semiMenor)

  if (!lejos) {
    const fi = fiDe(cerca)
    return {
      fiable: false,
      motivo: 'un solo disco: la escala vale en su extremo de la barra, no donde está el atleta',
      fiGrados: fi,
      cosFi: Math.cos((fi * Math.PI) / 180),
      saltoRelativo: NaN,
      mmPorPxEn: () => mmPorPxDe(cerca),
    }
  }

  const mmCerca = mmPorPxDe(cerca)
  const mmLejos = mmPorPxDe(lejos)
  const salto = Math.abs(mmLejos / mmCerca - 1)
  // El promedio de los dos y no el de uno: el atleta está entre ellos, y a esa
  // distancia la elipse ya no dice exactamente lo mismo en los dos extremos.
  const fi = (fiDe(cerca) + fiDe(lejos)) / 2

  return {
    fiable: true,
    fiGrados: fi,
    cosFi: Math.cos((fi * Math.PI) / 180),
    saltoRelativo: salto,
    // Por encima del tope, quedarse con un disco cualquiera ya no es una
    // aproximación: es elegir el error.
    exigeInterpolar: salto > SALTO_DE_ESCALA_MAX,
    mmPorPxEn(x) {
      if (!Number.isFinite(x) || cerca.x === lejos.x) return (mmCerca + mmLejos) / 2
      const t = Math.max(0, Math.min(1, (x - cerca.x) / (lejos.x - cerca.x)))
      // Se interpola el INVERSO, y no es un refinamiento: es lo unico exacto.
      //
      // mm/px es proporcional a la profundidad Z, y en una camara pinhole lo que
      // resulta AFIN en la coordenada de imagen es 1/Z, no Z. Para una barra recta
      // sale despejando: Z(x) = C / (x*Dz - f*Dx). O sea que mm/px es HIPERBOLICA
      // en x, y la recta que se trazaba antes entre los dos extremos siempre pasa
      // por encima de ella.
      //
      // Siempre por encima: el error no se promedia entre videos, los infla todos
      // en la misma direccion. Medido sobre los saltos que da el corpus real
      // (wiki/motor-velocidad/escala-por-disco.md): +1,4 % a 27 % de salto, +3,5 %
      // a 46 %, +10,8 % a 98 %. Interpolando el inverso el error es exactamente
      // cero para cualquier salto y cualquier orientacion de la barra.
      const pxPorMm = 1 / mmCerca + t * (1 / mmLejos - 1 / mmCerca)
      return 1 / pxPorMm
    },
  }
}

/**
 * El brazo de momento externo en milímetros, con las dos correcciones puestas.
 *
 * Se separa de `escalaDeLaBarra` porque es la operación que alguien va a repetir
 * por cada eje —tobillo, rodilla, cadera, lumbar— y conviene que no haya forma
 * de hacerla a medias.
 */
export function brazoEnMm(escala, xEje, xCarga) {
  const px = xCarga - xEje
  return (px * escala.mmPorPxEn(xCarga)) / escala.cosFi
}
