import { grados, V, type Vec3 } from '../patrones/algebra'
import { Malla, type Color } from '../patrones/malla'

/**
 * El escenario donde se para el sujeto: una BAHÍA DE MEDIDA.
 *
 * ## Por qué una bahía y no un gimnasio
 *
 * La tentación era construir un gimnasio: suelo de goma, racks, discos apilados.
 * No se hace, y por dos razones que apuntan al mismo sitio.
 *
 * La primera es lo que esta app **es**. Alpha mide: velocidad de barra con la cámara,
 * brazo de momento, desviación de RIR, fotogramas por segundo de la toma. Ninguna otra
 * app del mercado hace eso. Un gimnasio dibujado la disfrazaría de lo que ya hay;
 * una bahía de medida la enseña.
 *
 * La segunda es geométrica, y es la que decide. La cámara del visor orbita entre 1,1 y
 * 6,5 m con elevación de −78° a +78°. **Unas paredes taparían al sujeto en media
 * vuelta**: cuando la cámara sale del recinto, el muro cercano se cruza por delante. Un
 * laboratorio de plataformas de fuerza no tiene paredes alrededor de la plataforma —
 * tiene suelo marcado y un bordillo. Eso además se lee desde cualquier ángulo.
 *
 * ## Todo lo de aquí MIDE
 *
 * Ni una línea es decorativa, y es el criterio para admitir cualquier añadido futuro:
 *
 * - La retícula da escala. Con 10 cm de paso menor se puede LEER cuánto bajó la
 *   sentadilla, en vez de intuirlo.
 * - La placa marca dónde se pone el sujeto, y es lo que impide que parezca flotando.
 * - El eje sagital dibujado en el suelo es el plano en el que el encoder mide de
 *   verdad — los detectores de pose dan cinco grados de libertad, así que **el plano
 *   frontal no se puede medir con una sola cámara**. El suelo lo dice en vez de
 *   dejarlo en una nota al pie.
 * - El estadiómetro da referencia de altura, que la retícula no puede dar.
 *
 * ## Cómo entra en el motor sin tocarlo
 *
 * `Malla` guarda un índice de hueso por vértice y **el slot 0 es la identidad**,
 * reservado a la geometría fija. Todo lo de aquí va con hueso 0, así que se añade a la
 * misma malla del sujeto y se dibuja en la misma llamada. Cero cambios en `motor.ts`.
 *
 * ## Lo que este módulo NO hace, y por qué
 *
 * No anima nada. El entorno «vivo» pedía movimiento ambiental, y aquí no lo hay a
 * propósito: esta escena puede acabar en pantalla mientras el encoder captura, y ahí
 * por debajo de 50 fps la toma se descarta. Un fondo que se mueve solo no vale una
 * serie repetida. Lo que sí puede moverse es lo que responde a una causa —una serie
 * guardada, una medición que aterriza— y eso va por encima, no en la geometría.
 */

// ---------------------------------------------------------------------------
// Medidas. Todas en metros, con el suelo en Y=0, que es el espacio del sujeto.
// ---------------------------------------------------------------------------

/** Hasta dónde llega el suelo. La bruma del motor satura a 5,8 m del ojo, así que
 *  más allá de esto no se ve nada y solo serían vértices pagados. */
const RADIO_SUELO = 6.2

/** Paso menor de la retícula: la unidad con la que se lee una profundidad. */
const PASO_MENOR = 0.1

/** Paso mayor. Cada cinco menores, para que se pueda contar de un vistazo. */
const PASO_MAYOR = 0.5

/** Media anchura de una línea de retícula. Fija en metros y no en píxeles: al
 *  acercarse la cámara la línea engorda, que es lo correcto — es una marca pintada
 *  en el suelo, no un trazo de interfaz. */
const GROSOR_MENOR = 0.0035
const GROSOR_MAYOR = 0.007

/** El bordillo de la bahía. 30 cm: un umbral, no un muro. A esa altura no cruza por
 *  delante del sujeto desde ninguna elevación de la órbita. */
const RADIO_BAHIA = 3.2
const ALTO_BORDILLO = 0.3
const ANCHO_BORDILLO = 0.09

/** La placa de fuerza: dónde se pone el sujeto. */
const RADIO_PLACA = 0.45

/** El estadiómetro, y su sitio. Va detrás y a la izquierda —215°— para que quede
 *  fuera del encuadre de partida de la cámara, que mira desde 28°. Es la única pieza
 *  vertical de la escena, así que es la única que puede interponerse: se paga ese
 *  precio una vez, en un ángulo estrecho, a cambio de poder leer alturas. */
const ANGULO_ESTADIOMETRO = 215
const RADIO_ESTADIOMETRO = 1.55
const ALTO_ESTADIOMETRO = 2.0

/** Las marcas de altura. Media, uno y uno y medio: las tres que sitúan una cadera,
 *  un hombro y una barra en press militar. */
const MARCAS_ALTURA = [0.5, 1.0, 1.5]

// ---------------------------------------------------------------------------
// Materia. Colores pensados CONTRA la iluminación del motor, que es fija: dos luces
// y una bruma azulada. Un color elegido a ojo aquí sale distinto ahí.
// ---------------------------------------------------------------------------

const SUELO: Color = [0.085, 0.092, 0.104]
const LINEA_MENOR: Color = [0.16, 0.175, 0.2]
const LINEA_MAYOR: Color = [0.3, 0.325, 0.365]
/** El eje sagital lleva el rojo de la marca, apagado: es una referencia, no un aviso. */
const EJE_SAGITAL: Color = [0.42, 0.14, 0.15]
const PLACA: Color = [0.13, 0.142, 0.163]
const PLACA_FILO: Color = [0.38, 0.41, 0.46]
const BORDILLO: Color = [0.115, 0.125, 0.142]
const BORDILLO_CANTO: Color = [0.26, 0.285, 0.33]
const POSTE: Color = [0.2, 0.22, 0.25]
const MARCA: Color = [0.52, 0.56, 0.63]

const ARRIBA: Vec3 = [0, 1, 0]

// ---------------------------------------------------------------------------

/**
 * Un rectángulo horizontal a la altura `y`, con la normal hacia arriba.
 *
 * Es la primitiva de casi todo el suelo: retícula, placa y marcas. Va aquí y no en
 * `malla.ts` porque aquella construye volúmenes anatómicos —tubos y elipsoides— y
 * esto es carpintería plana.
 */
function losa(m: Malla, x0: number, z0: number, x1: number, z1: number, y: number, c: Color): void {
  const base = m.vertices
  m.vertice([x0, y, z0], ARRIBA, c, 0)
  m.vertice([x1, y, z0], ARRIBA, c, 0)
  m.vertice([x1, y, z1], ARRIBA, c, 0)
  m.vertice([x0, y, z1], ARRIBA, c, 0)
  m.cuadro(base, base + 1, base + 2, base + 3)
}

/** Un disco horizontal de `n` segmentos. */
function disco(m: Malla, radio: number, y: number, c: Color, n = 64): void {
  const centro = m.vertices
  m.vertice([0, y, 0], ARRIBA, c, 0)
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    m.vertice([Math.cos(a) * radio, y, Math.sin(a) * radio], ARRIBA, c, 0)
  }
  for (let i = 0; i < n; i++) m.triangulo(centro, centro + 1 + i, centro + 2 + i)
}

/** Un anillo plano entre dos radios: el filo de la placa, las marcas del suelo. */
function anillo(m: Malla, rInt: number, rExt: number, y: number, c: Color, n = 64): void {
  const base = m.vertices
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    const co = Math.cos(a)
    const si = Math.sin(a)
    m.vertice([co * rInt, y, si * rInt], ARRIBA, c, 0)
    m.vertice([co * rExt, y, si * rExt], ARRIBA, c, 0)
  }
  for (let i = 0; i < n; i++) {
    const k = base + i * 2
    m.cuadro(k, k + 1, k + 3, k + 2)
  }
}

/**
 * La retícula, recortada al disco del suelo.
 *
 * Cada línea se acorta a la cuerda que le corresponde en la circunferencia, así que
 * el suelo acaba en redondo y no en un cuadrado con esquinas que asoman de la bruma.
 */
function reticula(m: Malla): void {
  const pasos = Math.floor(RADIO_SUELO / PASO_MENOR)
  for (let i = -pasos; i <= pasos; i++) {
    const d = i * PASO_MENOR
    if (Math.abs(d) > RADIO_SUELO) continue

    const esMayor = Math.abs(d % PASO_MAYOR) < 1e-9 || Math.abs(Math.abs(d % PASO_MAYOR) - PASO_MAYOR) < 1e-9
    const g = esMayor ? GROSOR_MAYOR : GROSOR_MENOR

    // Media cuerda, medida al BORDE LEJANO de la línea y no a su eje. Una línea tiene
    // grosor, así que sus dos esquinas están más lejos del centro que su eje: cortando
    // por el eje, las esquinas asomaban por fuera del disco. Son tres milímetros y no
    // se ven, pero es una geometría que dice una cosa y hace otra — y el suelo es
    // justamente la pieza cuyo trabajo es que las medidas se puedan creer.
    const borde = Math.abs(d) + g
    const media = Math.sqrt(Math.max(0, RADIO_SUELO * RADIO_SUELO - borde * borde))
    if (media < PASO_MENOR) continue
    const c = esMayor ? LINEA_MAYOR : LINEA_MENOR
    // Altura escalonada: la mayor va por encima de la menor para que el cruce no
    // parpadee. Tres milímetros de separación son invisibles y bastan.
    const y = esMayor ? 0.003 : 0.002

    losa(m, -media, d - g, media, d + g, y, c)
    losa(m, d - g, -media, d + g, media, y, c)
  }
}

/**
 * El eje sagital: el plano en el que se mide de verdad.
 *
 * El sujeto mira a lo largo de Z, así que su plano sagital es el que contiene X=0.
 * Dibujarlo no es adorno: la medición del brazo de momento **solo existe en ese
 * plano**, porque una sola cámara no da los tres grados de libertad que haría falta
 * para el frontal. Que el suelo lo diga ahorra la nota al pie.
 */
function ejeSagital(m: Malla): void {
  losa(m, -0.009, -RADIO_SUELO * 0.62, 0.009, RADIO_SUELO * 0.62, 0.0035, EJE_SAGITAL)
}

/** La placa de fuerza: el sitio del sujeto, con su filo. */
function placa(m: Malla): void {
  disco(m, RADIO_PLACA, 0.004, PLACA)
  anillo(m, RADIO_PLACA - 0.012, RADIO_PLACA, 0.0045, PLACA_FILO)
}

/**
 * El bordillo de la bahía: una banda vertical de 30 cm con su canto.
 *
 * Se construye como prisma anular —cara interior, canto superior y cara exterior—
 * porque el motor no descarta caras traseras: si fuera una sola cara, desde la mitad
 * de las órbitas se vería el interior del bordillo y la escena se rompería.
 */
function bordillo(m: Malla, n = 72): void {
  const rInt = RADIO_BAHIA
  const rExt = RADIO_BAHIA + ANCHO_BORDILLO
  const base = m.vertices

  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    const co = Math.cos(a)
    const si = Math.sin(a)
    // La normal interior mira al centro; la exterior, afuera.
    const haciaFuera: Vec3 = [co, 0, si]
    const haciaDentro: Vec3 = V.escalar(haciaFuera, -1)

    m.vertice([co * rInt, 0, si * rInt], haciaDentro, BORDILLO, 0)
    m.vertice([co * rInt, ALTO_BORDILLO, si * rInt], haciaDentro, BORDILLO_CANTO, 0)
    m.vertice([co * rExt, ALTO_BORDILLO, si * rExt], ARRIBA, BORDILLO_CANTO, 0)
    m.vertice([co * rExt, 0, si * rExt], haciaFuera, BORDILLO, 0)
  }
  for (let i = 0; i < n; i++) {
    const k = base + i * 4
    const s = k + 4
    m.cuadro(k, k + 1, s + 1, s) // cara interior
    m.cuadro(k + 1, k + 2, s + 2, s + 1) // canto
    m.cuadro(k + 2, k + 3, s + 3, s + 2) // cara exterior
  }
}

/** Un prisma vertical de sección cuadrada, para el poste y sus marcas. */
function barra(m: Malla, cx: number, cz: number, ancho: number, y0: number, y1: number, c: Color): void {
  const h = ancho / 2
  const esquinas: [number, number][] = [
    [cx - h, cz - h],
    [cx + h, cz - h],
    [cx + h, cz + h],
    [cx - h, cz + h],
  ]
  for (let i = 0; i < 4; i++) {
    const [ax, az] = esquinas[i]
    const [bx, bz] = esquinas[(i + 1) % 4]
    const nr = V.normalizar([(ax + bx) / 2 - cx, 0, (az + bz) / 2 - cz])
    const k = m.vertices
    m.vertice([ax, y0, az], nr, c, 0)
    m.vertice([bx, y0, bz], nr, c, 0)
    m.vertice([bx, y1, bz], nr, c, 0)
    m.vertice([ax, y1, az], nr, c, 0)
    m.cuadro(k, k + 1, k + 2, k + 3)
  }
  const t = m.vertices
  for (const [ex, ez] of esquinas) m.vertice([ex, y1, ez], ARRIBA, c, 0)
  m.cuadro(t, t + 1, t + 2, t + 3)
}

/**
 * El estadiómetro: lo único vertical de la escena.
 *
 * La retícula da distancias en el suelo y no puede dar alturas, y una altura es lo
 * que hace falta para situar una cadera en el fondo de la sentadilla. Va a 215°,
 * detrás y a la izquierda del encuadre de partida —la cámara arranca a 28°—, así que
 * solo se interpone en un arco estrecho de la órbita.
 */
function estadiometro(m: Malla): void {
  const a = grados(ANGULO_ESTADIOMETRO)
  const cx = Math.cos(a) * RADIO_ESTADIOMETRO
  const cz = Math.sin(a) * RADIO_ESTADIOMETRO
  barra(m, cx, cz, 0.05, 0, ALTO_ESTADIOMETRO, POSTE)

  // Las marcas: un travesaño corto hacia el centro de la bahía, para que se lean
  // contra el sujeto y no contra el vacío de detrás.
  const haciaCentro = V.normalizar([-cx, 0, -cz])
  for (const y of MARCAS_ALTURA) {
    const largo = 0.22
    const p0: Vec3 = [cx, y, cz]
    const p1: Vec3 = [cx + haciaCentro[0] * largo, y, cz + haciaCentro[2] * largo]
    const g = 0.012
    const k = m.vertices
    // Una placa fina horizontal: se ve desde arriba y desde el lado.
    m.vertice([p0[0], y, p0[2] - g], ARRIBA, MARCA, 0)
    m.vertice([p1[0], y, p1[2] - g], ARRIBA, MARCA, 0)
    m.vertice([p1[0], y, p1[2] + g], ARRIBA, MARCA, 0)
    m.vertice([p0[0], y, p0[2] + g], ARRIBA, MARCA, 0)
    m.cuadro(k, k + 1, k + 2, k + 3)
  }
}

/**
 * Construye la bahía entera dentro de la malla que se le pase.
 *
 * Recibe la malla en vez de crearla para poder añadirse a la del sujeto: una sola
 * malla, un solo búfer, una sola llamada de dibujo.
 */
export function construirLaboratorio(m: Malla): void {
  disco(m, RADIO_SUELO, 0, SUELO)
  reticula(m)
  ejeSagital(m)
  placa(m)
  bordillo(m)
  estadiometro(m)
}

/** Las medidas de la bahía, para que la interfaz pueda anclar información al espacio. */
export const BAHIA = {
  radioSuelo: RADIO_SUELO,
  radioBahia: RADIO_BAHIA,
  altoBordillo: ALTO_BORDILLO,
  radioPlaca: RADIO_PLACA,
  pasoMenor: PASO_MENOR,
  pasoMayor: PASO_MAYOR,
  marcasAltura: MARCAS_ALTURA,
} as const
