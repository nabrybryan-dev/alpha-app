import { grados, V, type Vec3 } from '../../../domain/patrones/algebra'
import { Malla, type Color } from '../../../domain/patrones/malla'
import { BAHIA } from '../../../domain/escenario/laboratorio'

/**
 * DE DÓNDE VIENE `cuadro`, Y POR QUÉ VIVE AQUÍ.
 *
 * En la rama del PR #183 esta primitiva estaba en `domain/escenario/geometria.ts`.
 * Ese archivo **no existe en `main`**, y `src/domain/**` es de solo lectura para este
 * trabajo, así que no se puede crear allí. Se trae la función tal cual —mismo cuerpo,
 * mismo criterio— y se exporta desde aquí, que es el módulo que la usa primero.
 * `tripode.ts` la importa de este archivo en vez de tener su propia copia: dos copias
 * de la regla de enrollado es exactamente cómo vuelven las caras del revés.
 *
 * El motor descarta caras traseras —`gl.CULL_FACE` con `BACK`—, así que el ORDEN de
 * los vértices decide si la cara EXISTE. Enrollada al revés se construye bien, se sube
 * a la tarjeta, pasa por el shader y la GPU la tira en silencio: no falla, no avisa, y
 * cualquier comprobación que mire la malla dice que está perfecta. Por eso la primitiva
 * se orienta sola: se le dice hacia dónde MIRA la cara y ella decide el orden.
 */

/** Producto vectorial de los dos lados de un triángulo: la normal de su enrollado. */
function normalDelEnrollado(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const u: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const v: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
}

/**
 * Un cuadrilátero que mira hacia `n`, en el orden que haga falta.
 *
 * Si el orden recibido produce una cara de espaldas, se invierte. El llamante escribe
 * las esquinas como le resulte natural y declara hacia dónde mira; el resto lo decide
 * la geometría.
 */
export function cuadro(m: Malla, p: [Vec3, Vec3, Vec3, Vec3], n: Vec3, c: Color): void {
  const w = normalDelEnrollado(p[0], p[1], p[2])
  const alReves = w[0] * n[0] + w[1] * n[1] + w[2] * n[2] < 0
  const orden = alReves ? [p[3], p[2], p[1], p[0]] : p
  const base = m.vertices
  for (const v of orden) m.vertice(v, n, c, 0)
  m.cuadro(base, base + 1, base + 2, base + 3)
}

/**
 * La sala que envuelve la bahía, y la estación desde la que se graba.
 *
 * ## Por qué ahora sí hay paredes
 *
 * El primer escenario no las tenía, y por un motivo geométrico: con la cámara orbitando
 * a 6,5 m, un muro cercano se cruza por delante del sujeto en media vuelta.
 *
 * La solución no era quitarlas: era **hacer la sala más grande que la órbita**. Con el
 * radio a 7,0 m —por encima del tope de 6,5— la cámara nunca sale del recinto, así que
 * la pared que se ve es SIEMPRE la del fondo y la de detrás queda a la espalda. Nunca
 * tapa. Es la diferencia entre estar dentro de una sala y dar vueltas alrededor de una
 * caja.
 *
 * ## Los marcadores van repetidos, como en un pabellón
 *
 * Tres paneles idénticos a 120°. No es redundancia: con la órbita libre, cualquier
 * panel único quedaría a la espalda la mitad del tiempo. Repetidos, siempre hay uno al
 * fondo — que es exactamente por lo que un pabellón deportivo tiene marcador en las
 * cuatro caras del cubo central.
 *
 * ## Las cifras son de siete segmentos, y no es nostalgia
 *
 * Un dígito de segmentos es geometría —siete cajas— y no necesita ni tipografía ni
 * textura ni atlas de fuente. Además es lo que lleva un instrumento de verdad: la
 * báscula, el cronómetro de pared, el display de la prensa. Encaja con lo que esta app
 * es y se lee de reojo a tres metros, que es la distancia real de lectura.
 *
 * ## La estación de grabación
 *
 * Es la pieza que convierte la sala en herramienta. El sitio marcado en el suelo **es
 * donde va el móvil de verdad**: mismo ángulo, misma distancia, misma altura. Y el cono
 * pintado alrededor no es decorativo — es la tolerancia que el propio encoder aplica:
 * hasta 30° de desvío se da la toma por buena si se ve un disco, y solo 12° si no.
 * Ensayar el encuadre en la sala deja de ser un juego y pasa a ser la puesta a punto.
 */

// ---------------------------------------------------------------------------
// La sala
// ---------------------------------------------------------------------------

/** Radio de la pared. POR ENCIMA del tope de órbita (6,5) a propósito: la cámara
 *  siempre queda dentro y ninguna pared se interpone jamás. */
const RADIO_SALA = 7.0

/** Alto de la pared. Suficiente para que no se vea el borde superior desde la
 *  elevación de uso, sin construir un techo que solo se vería mirando hacia arriba. */
const ALTO_SALA = 4.2

/** Dónde se cuelgan los marcadores: a la altura de la mirada de quien está de pie. */
const ALTO_PANEL = 1.85

const PARED: Color = [0.062, 0.068, 0.078]
const ZOCALO: Color = [0.095, 0.104, 0.12]
const PANEL: Color = [0.042, 0.046, 0.054]
const MARCO: Color = [0.2, 0.22, 0.26]
const SEGMENTO_VIVO: Color = [0.86, 0.2, 0.2]
const SEGMENTO_APAGADO: Color = [0.115, 0.122, 0.135]

// ---------------------------------------------------------------------------
// La estación de grabación
// ---------------------------------------------------------------------------

/**
 * Dónde se planta el móvil. En −X: perpendicular al plano sagital, que es el único
 * plano en el que una sola cámara puede medir. El sujeto mira a +Z, así que esto lo
 * ve de perfil — su lado derecho.
 */
const DISTANCIA_TRIPODE = 3.0
const ALTURA_TRIPODE = 1.0

/** La tolerancia del encoder, dibujada. Con disco visible admite hasta 30° de desvío;
 *  sin él, 12°. Los dos conos se pintan: el bueno siempre, el amplio como margen. */
const CONO_CON_DISCO = 30
const CONO_SIN_DISCO = 12

const CONO_BUENO: Color = [0.13, 0.3, 0.2]
const CONO_MARGEN: Color = [0.2, 0.18, 0.1]
const TRIPODE: Color = [0.3, 0.33, 0.38]
const MIRA: Color = [0.55, 0.16, 0.16]

const ARRIBA: Vec3 = [0, 1, 0]

// ---------------------------------------------------------------------------

/**
 * Un rectángulo con normal libre. Delega en la primitiva que SE ORIENTA SOLA: se le
 * dice hacia dónde mira la cara y ella decide el enrollado. Escribir el orden a mano
 * fue lo que dejó el escenario entero de espaldas y sin dar un solo error.
 */
const cara = cuadro

/** Una losa horizontal a la altura `y`. */
function losa(m: Malla, x0: number, z0: number, x1: number, z1: number, y: number, c: Color): void {
  // Antihoraria vista desde arriba, o el motor la descarta por trasera.
  cara(
    m,
    [
      [x0, y, z0],
      [x0, y, z1],
      [x1, y, z1],
      [x1, y, z0],
    ],
    ARRIBA,
    c,
  )
}

/**
 * La pared: un cilindro visto por dentro, con su zócalo.
 *
 * Solo la cara interior. La exterior no se ve nunca —la cámara no sale de aquí— y
 * dibujarla sería pagar la mitad de los triángulos de la sala para nada.
 */
function pared(m: Malla, n = 96): void {
  const base = m.vertices
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    const co = Math.cos(a)
    const si = Math.sin(a)
    const haciaDentro: Vec3 = [-co, 0, -si]
    m.vertice([co * RADIO_SALA, 0, si * RADIO_SALA], haciaDentro, ZOCALO, 0)
    m.vertice([co * RADIO_SALA, 0.35, si * RADIO_SALA], haciaDentro, ZOCALO, 0)
    m.vertice([co * RADIO_SALA, ALTO_SALA, si * RADIO_SALA], haciaDentro, PARED, 0)
  }
  for (let i = 0; i < n; i++) {
    const k = base + i * 3
    const s = k + 3
    m.cuadro(k, s, s + 1, k + 1)
    m.cuadro(k + 1, s + 1, s + 2, k + 2)
  }
}

// ---------------------------------------------------------------------------
// Cifras de siete segmentos
// ---------------------------------------------------------------------------

/**
 * Qué segmentos enciende cada signo, en el orden a,b,c,d,e,f,g.
 *
 * Hay una F, y no es un capricho: **el fallo NO es RIR 0**. RIR 0 es la última
 * repetición completa con la parcial en reserva; el fallo es meterse en esa parcial, y
 * es la unidad de cuenta del método. Enseñar un cero donde la prescripción dice FALLO
 * sería decir otra cosa — así que el marcador lo dice con su letra, que además un
 * display de siete segmentos sabe dibujar.
 */
const SEGMENTOS: Record<string, string> = {
  0: 'abcdef',
  1: 'bc',
  2: 'abdeg',
  3: 'abcdg',
  4: 'bcfg',
  5: 'acdfg',
  6: 'acdefg',
  7: 'abc',
  8: 'abcdefg',
  9: 'abcdfg',
  F: 'aefg',
}

/**
 * Un dígito en el plano XY local, con la esquina inferior izquierda en el origen.
 *
 * `colocar` lleva ese plano a su sitio en la pared. Se pasa como función en vez de
 * construir aquí con ángulos para que el mismo dígito sirva en los tres paneles sin
 * repetir la trigonometría tres veces.
 *
 * Los segmentos apagados TAMBIÉN se dibujan, en gris muy oscuro. Es lo que hace que
 * se lea como un display y no como cifras flotantes: el ocho fantasma de detrás.
 */
function digito(
  m: Malla,
  valor: string,
  alto: number,
  colocar: (x: number, y: number) => Vec3,
  normal: Vec3,
): void {
  const encendidos = SEGMENTOS[valor] ?? ''
  const g = alto * 0.115 // grosor del segmento
  const w = alto * 0.56 // ancho del dígito
  const m2 = alto / 2

  // Cada segmento: [x0, y0, x1, y1] en el marco local del dígito.
  const trazos: Record<string, [number, number, number, number]> = {
    a: [g, alto - g, w - g, alto],
    b: [w - g, m2 + g * 0.5, w, alto - g],
    c: [w - g, g, w, m2 - g * 0.5],
    d: [g, 0, w - g, g],
    e: [0, g, g, m2 - g * 0.5],
    f: [0, m2 + g * 0.5, g, alto - g],
    g: [g, m2 - g * 0.5, w - g, m2 + g * 0.5],
  }

  for (const [nombre, [x0, y0, x1, y1]] of Object.entries(trazos)) {
    const c = encendidos.includes(nombre) ? SEGMENTO_VIVO : SEGMENTO_APAGADO
    cara(m, [colocar(x0, y0), colocar(x1, y0), colocar(x1, y1), colocar(x0, y1)], normal, c)
  }
}

/** El ancho que ocupa un número de `n` dígitos de altura `alto`, con sus separaciones. */
function anchoDe(n: number, alto: number): number {
  return n * alto * 0.56 + (n - 1) * alto * 0.16
}

/**
 * Un marcador en la pared: series, repeticiones y proximidad al fallo.
 *
 * Los tres van juntos y en ese orden porque es el orden en que se leen durante la
 * serie: cuántas llevo, de cuántas, y con cuánto margen las estoy haciendo.
 */
function marcador(m: Malla, anguloGrados: number, series: number, reps: number, rir: number | 'FALLO'): void {
  const a = grados(anguloGrados)
  const co = Math.cos(a)
  const si = Math.sin(a)
  // Un pelo por dentro de la pared para que no pelee con ella por el mismo píxel.
  const r = RADIO_SALA - 0.02
  const haciaDentro: Vec3 = [-co, 0, -si]
  // El eje horizontal del panel: tangente a la pared.
  const tang: Vec3 = [-si, 0, co]

  const alto = 0.44
  const acotar = (v: number, cifras: number) =>
    String(Math.max(0, Math.min(cifras === 1 ? 9 : 99, Math.round(v)))).padStart(cifras, '0')
  const grupos = [
    { texto: acotar(series, 2), cifras: 2 },
    { texto: acotar(reps, 2), cifras: 2 },
    // El fallo se escribe con su letra. Un cero aquí diría «RIR 0», que es otra cosa.
    { texto: rir === 'FALLO' ? 'F' : acotar(rir, 1), cifras: 1 },
  ]
  const hueco = alto * 0.62
  const anchoTotal =
    grupos.reduce((s, g) => s + anchoDe(g.cifras, alto), 0) + hueco * (grupos.length - 1)

  // Fondo del panel y su marco, para que las cifras no floten sobre la pared.
  const margen = alto * 0.42
  const pon = (u: number, v: number, prof: number): Vec3 => [
    co * (r - prof) + tang[0] * u,
    v,
    si * (r - prof) + tang[2] * u,
  ]
  const u0 = -anchoTotal / 2 - margen
  const u1 = anchoTotal / 2 + margen
  const v0 = ALTO_PANEL - margen
  const v1 = ALTO_PANEL + alto + margen
  cara(m, [pon(u0, v0, 0.01), pon(u1, v0, 0.01), pon(u1, v1, 0.01), pon(u0, v1, 0.01)], haciaDentro, PANEL)
  // Filete inferior: da borde sin construir cuatro lados.
  cara(
    m,
    [pon(u0, v0, 0.014), pon(u1, v0, 0.014), pon(u1, v0 + 0.012, 0.014), pon(u0, v0 + 0.012, 0.014)],
    haciaDentro,
    MARCO,
  )

  let u = -anchoTotal / 2
  for (const g of grupos) {
    for (const ch of g.texto) {
      digito(m, ch, alto, (x, y) => pon(u + x, ALTO_PANEL + y, 0.02), haciaDentro)
      u += alto * 0.56 + alto * 0.16
    }
    u += hueco - alto * 0.16
  }
}

// ---------------------------------------------------------------------------

/** Un sector de anillo en el suelo: los conos de tolerancia del encuadre. */
function sector(m: Malla, desde: number, hasta: number, r0: number, r1: number, y: number, c: Color): void {
  const n = 24
  const base = m.vertices
  for (let i = 0; i <= n; i++) {
    const a = grados(desde + ((hasta - desde) * i) / n)
    const co = Math.cos(a)
    const si = Math.sin(a)
    m.vertice([co * r0, y, si * r0], ARRIBA, c, 0)
    m.vertice([co * r1, y, si * r1], ARRIBA, c, 0)
  }
  for (let i = 0; i < n; i++) {
    const k = base + i * 2
    m.cuadro(k, k + 2, k + 3, k + 1)
  }
}

/**
 * La estación de grabación: dónde va el móvil, y hasta dónde puede desviarse.
 *
 * El eje de la estación es −X, o sea 180°: perpendicular al plano sagital del sujeto,
 * que mira a +Z. Es el único sitio desde el que una cámara sola puede medir velocidad
 * de barra, y por eso no es una elección estética.
 */
function estacion(m: Malla): void {
  const eje = 180
  const r0 = DISTANCIA_TRIPODE - 0.8
  const r1 = DISTANCIA_TRIPODE + 0.8

  // El margen amplio primero, debajo: solo vale si se ve un disco en la toma.
  sector(m, eje - CONO_CON_DISCO, eje + CONO_CON_DISCO, r0, r1, 0.0055, CONO_MARGEN)
  // Y encima el cono bueno: el que vale siempre, se vea disco o no.
  sector(m, eje - CONO_SIN_DISCO, eje + CONO_SIN_DISCO, r0, r1, 0.006, CONO_BUENO)

  // La huella del trípode y su vástago, a la altura real a la que se pone el móvil.
  const cx = Math.cos(grados(eje)) * DISTANCIA_TRIPODE
  const cz = Math.sin(grados(eje)) * DISTANCIA_TRIPODE
  losa(m, cx - 0.16, cz - 0.16, cx + 0.16, cz + 0.16, 0.0065, TRIPODE)

  // Vástago: un prisma fino hasta la altura del móvil.
  const g = 0.022
  for (let i = 0; i < 4; i++) {
    const a0 = (i / 4) * Math.PI * 2
    const a1 = ((i + 1) / 4) * Math.PI * 2
    const p0: Vec3 = [cx + Math.cos(a0) * g, 0, cz + Math.sin(a0) * g]
    const p1: Vec3 = [cx + Math.cos(a1) * g, 0, cz + Math.sin(a1) * g]
    const nr = V.normalizar([(p0[0] + p1[0]) / 2 - cx, 0, (p0[2] + p1[2]) / 2 - cz])
    cara(
      m,
      [p0, [p0[0], ALTURA_TRIPODE, p0[2]], [p1[0], ALTURA_TRIPODE, p1[2]], p1],
      nr,
      TRIPODE,
    )
  }

  // La mira: una línea en el suelo del trípode a la placa. Es el eje de medida, y
  // que se vea dibujado es lo que enseña que la cámara mira al sujeto de perfil.
  const hacia = V.normalizar([-cx, 0, -cz])
  const largo = DISTANCIA_TRIPODE - BAHIA.radioPlaca
  const ancho = 0.012
  const perp: Vec3 = [-hacia[2], 0, hacia[0]]
  const q0: Vec3 = [cx + perp[0] * ancho, 0.0062, cz + perp[2] * ancho]
  const q1: Vec3 = [cx - perp[0] * ancho, 0.0062, cz - perp[2] * ancho]
  cara(
    m,
    [
      q0,
      q1,
      [q1[0] + hacia[0] * largo, 0.0062, q1[2] + hacia[2] * largo],
      [q0[0] + hacia[0] * largo, 0.0062, q0[2] + hacia[2] * largo],
    ],
    ARRIBA,
    MIRA,
  )
}

/**
 * Construye la sala entera: paredes, tres marcadores y la estación de grabación.
 *
 * Los números se pasan desde fuera porque son los de la serie que se está haciendo:
 * la sala no sabe de entrenamiento, solo sabe dibujar lo que le den.
 */
export function construirSala(m: Malla, datos: DatosDeSerie): void {
  pared(m)
  for (const a of [90, 210, 330]) marcador(m, a, datos.series, datos.reps, datos.rir)
  estacion(m)
}

/** Los números de la serie que se está haciendo, que son los que van al marcador. */
export interface DatosDeSerie {
  series: number
  reps: number
  /** El RIR objetivo, o el FALLO — que NO es lo mismo que un RIR 0. */
  rir: number | 'FALLO'
}

/** Las medidas de la sala, para anclar interfaz al espacio. */
export const SALA = {
  radio: RADIO_SALA,
  alto: ALTO_SALA,
  altoPanel: ALTO_PANEL,
  /** Dónde va el móvil de verdad: ángulo, distancia y altura. */
  estacion: { anguloGrados: 180, distancia: DISTANCIA_TRIPODE, altura: ALTURA_TRIPODE },
  /** La tolerancia de encuadre del encoder, en grados de desvío. */
  tolerancia: { conDisco: CONO_CON_DISCO, sinDisco: CONO_SIN_DISCO },
} as const

/**
 * La vista desde el trípode: lo que va a ver el móvil.
 *
 * Es la pieza que convierte la sala en ensayo. Tocar «grabar» no abre un menú: lleva la
 * cámara EXACTAMENTE a donde va a estar el teléfono —mismo ángulo, misma distancia,
 * misma altura— y desde ahí se ve el encuadre real antes de plantar el trípode. Si el
 * sujeto no cabe, o el disco queda de canto, se descubre aquí y no con la serie hecha.
 *
 * La órbita del motor sitúa el ojo en
 *
 *     centro + [sin(az)·cos(el), sin(el), cos(az)·cos(el)] · distancia
 *
 * así que hay que resolver los tres parámetros que ponen ese ojo en la estación. El
 * azimut sale de que la estación está sobre el eje X y el sujeto mira a +Z; la
 * elevación, de la diferencia entre la altura del móvil y la del centro de la escena
 * —pequeña, porque un trípode a un metro está casi a la altura de las caderas.
 */
export function vistaDeGrabacion(centro: readonly [number, number, number]): {
  azimut: number
  elevacion: number
  distancia: number
} {
  const a = grados(SALA.estacion.anguloGrados)
  const ojo: Vec3 = [
    Math.cos(a) * SALA.estacion.distancia,
    SALA.estacion.altura,
    Math.sin(a) * SALA.estacion.distancia,
  ]
  const d: Vec3 = [ojo[0] - centro[0], ojo[1] - centro[1], ojo[2] - centro[2]]
  const distancia = V.largo(d) || 1
  // `asin` del componente vertical: la elevación es el ángulo sobre el plano del suelo.
  const elevacion = (Math.asin(d[1] / distancia) * 180) / Math.PI
  // Y el azimut, del par (x, z) — en ese orden, que es el que usa la órbita.
  const azimut = (Math.atan2(d[0], d[2]) * 180) / Math.PI
  return { azimut, elevacion, distancia }
}

/**
 * El encuadre de la SALA, que no es el del cuerpo.
 *
 * `encuadrar()` enmarca al sujeto, y hace bien: para estudiar un patrón lo que importa
 * es el cuerpo. Pero con la sala construida ese encuadre la deja fuera — medido: a la
 * distancia del patrón el borde inferior del cuadro cae en y = 0,23 m, o sea **por
 * encima del suelo**, así que el laboratorio entero quedaba recortado y el sujeto
 * parecía flotar en un vacío. La escena estaba ahí y no se veía.
 *
 * Con 34° de campo vertical, para que entren el suelo y algo de pared hace falta un
 * cuadro de unos 2,8 m de alto centrado en 1,2 — que sale a 4,6 m de distancia. El
 * sujeto se ve más pequeño, y eso es exactamente el punto: **está DENTRO de un sitio**,
 * no recortado contra el fondo.
 */
export const ENCUADRE_SALA = {
  /** Metros: el cuadro va del suelo a algo más de dos metros. */
  distancia: 4.6,
  /** A la altura del pecho, no de la cadera: deja ver el suelo sin perder la cabeza. */
  centro: [0, 1.2, 0] as [number, number, number],
} as const
