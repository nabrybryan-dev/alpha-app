import { grados, V, type Vec3 } from '../../../domain/patrones/algebra'
import { Malla, type Color } from '../../../domain/patrones/malla'
import { cuadro } from './piezas'
import { construirMobiliario, construirRellenoDeMuro } from './mobiliario'
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
// La pared a 7 m quedaba demasiado cerca del encuadre móvil (la cámara está a 4,6 m):
// se convertía en una banda curva gigante y no se reconocía como habitación. Abrimos el
// radio para que suelo, paredes y estación se lean alrededor del sujeto.
const RADIO_SALA = 7.0

/** Alto de la pared. Suficiente para que no se vea el borde superior desde la
 *  elevación de uso, sin construir un techo que solo se vería mirando hacia arriba. */
const ALTO_SALA = 4.2

/** Dónde se cuelgan los marcadores: a la altura de la mirada de quien está de pie. */
// 1,62 y no 1,85 desde el 2026-09-03: a 1,85 el marcador caía justo bajo el tablón del
// DOM y se le rozaba. Bajarlo lo deja solo en su banda de muro, que es lo que hace que se
// lea como un display de la sala y no como un fondo del texto.
const ALTO_PANEL = 1.36

// La primera versión usaba valores casi negros: en un móvil el contraste del canvas
// aplastaba paredes, paneles y material contra el fondo y solo se distinguía el sujeto.
// Estos valores siguen siendo carbón, pero dejan leer el volumen de la sala y sus bordes.
const PARED: Color = [0.062, 0.068, 0.078]
const ZOCALO: Color = [0.095, 0.104, 0.12]
const PANEL: Color = [0.028, 0.03, 0.036]
const MARCO: Color = [0.2, 0.22, 0.26]
// El segmento encendido. Sube de 0,86 a 1,0 el 2026-09-03: estas cifras dejaron de ser
// decorado del fondo y pasaron a ser LO QUE SE LEE —la prescripción de la serie ya no se
// escribe en el DOM—, así que tienen que ganarle al mapeo de tonos igual que se lo gana
// un display de verdad en una sala a oscuras.
const SEGMENTO_VIVO: Color = [1.0, 0.24, 0.24]
// El segmento APAGADO baja de 0,115 a 0,055 el 2026-09-03. No es un ajuste de gusto: el
// contraste de un display es la distancia entre lo encendido y lo apagado, y sobre el muro
// hay un degradado de luz que sube el negro. Con el apagado tan claro, las cifras se leían
// como una textura del fondo en vez de como un número.
const SEGMENTO_APAGADO: Color = [0.055, 0.058, 0.066]

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
 * es la unidad de cuenta de esta casa. Enseñar un cero donde la prescripción dice FALLO
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
function marcador(
  m: Malla,
  anguloGrados: number,
  cifras: CifrasDelMuro,
  /**
   * La sala rectangular de Blender, si la hay. Entonces el panel se cuelga del muro plano
   * que el rayo encuentra en esa dirección, PARALELO a ese muro —un panel tangente al
   * cilindro atraviesa una pared plana por las puntas— y sin salirse por la esquina.
   */
  rect?: { medioAncho: number; medioFondo: number },
): void {
  const a = grados(anguloGrados)
  const co = Math.cos(a)
  const si = Math.sin(a)
  // Dónde está el muro en esa dirección, y hacia dónde mira. En el cilindro, la normal es
  // la radial; en el rectángulo, la del muro plano que se ha encontrado.
  const radioDelMuro = rect ? radioDelMuroRectangular(rect.medioAncho, rect.medioFondo, anguloGrados) : RADIO_SALA
  let coN = co
  let siN = si
  if (rect) {
    const muroLargo = Math.abs(radioDelMuro * co) >= rect.medioAncho - 1e-6
    coN = muroLargo ? Math.sign(co) : 0
    siN = muroLargo ? 0 : Math.sign(si)
  }
  // Un pelo por dentro de la pared para que no pelee con ella por el mismo píxel.
  const r = radioDelMuro - 0.02
  const haciaDentro: Vec3 = [-coN, 0, -siN]
  // El eje horizontal del panel: tangente a la pared.
  const tang: Vec3 = [-siN, 0, coN]

  // EL CUERPO DE LAS CIFRAS, y por qué 0,38 y no 0,44.
  //
  // A 0,44 el panel entero mide 2,29 m y el muro que se ve en un 390×844 son 2,37: el
  // 97 %. Medido el 2026-09-03 apagando la capa de letras con `--sin-letras`, el marcador
  // salía CORTADO por los dos lados — cabía sobre el papel y no en la pantalla. A 0,38 seguía rozando los dos bordes en
  // la pantalla de verdad; a 0,30 el panel ocupa el 66 % del muro visible, entra entero, y
  // el dígito mide 49 px de alto — más que cualquier cifra que la interfaz haya escrito
  // nunca ahí. El número sale de mirar la captura, no de la cuenta: la cuenta decía que a
  // 0,38 cabía.
  const alto = 0.3
  const acotar = (v: number, cifras: number) =>
    String(Math.max(0, Math.min(cifras === 1 ? 9 : 99, Math.round(v)))).padStart(cifras, '0')
  const grupos = [
    { texto: acotar(cifras.veces, 2), cifras: 2 },
    { texto: acotar(cifras.cuanto, 2), cifras: 2 },
  ]
  // LA TERCERA CASILLA SE APAGA CUANDO NO HAY ESFUERZO ESCRITO, y no se pone a cero.
  //
  // El fallo se escribe con su letra, porque un cero ahí diría «RIR 0», que es otra cosa.
  // Y un día de cardio cuyo coach no escribió ni zona ni RPE **no tiene** ese dato: un `0`
  // sería inventarlo, y encima con el significado de otro. Sin casilla, el muro dice lo
  // único cierto — que eso no está escrito.
  if (cifras.esfuerzo !== undefined) {
    grupos.push({ texto: cifras.esfuerzo === 'FALLO' ? 'F' : acotar(cifras.esfuerzo, 1), cifras: 1 })
  }
  const hueco = alto * 0.62
  const anchoTotal =
    grupos.reduce((s, g) => s + anchoDe(g.cifras, alto), 0) + hueco * (grupos.length - 1)

  // Fondo del panel y su marco, para que las cifras no floten sobre la pared.
  const margen = alto * 0.42
  // El centro del panel: donde el rayo toca el muro. En el rectángulo se corre a lo largo
  // del muro lo justo para que las puntas no se metan en la pared de al lado.
  let cx = co * r
  let cz = si * r
  if (rect) {
    const medioPanel = anchoTotal / 2 + margen + 0.05
    const tope = (coN !== 0 ? rect.medioFondo : rect.medioAncho) - medioPanel
    const alTangente = cx * tang[0] + cz * tang[2]
    const acotado = Math.max(-tope, Math.min(tope, alTangente))
    cx += tang[0] * (acotado - alTangente)
    cz += tang[2] * (acotado - alTangente)
  }
  const pon = (u: number, v: number, prof: number): Vec3 => [
    cx + haciaDentro[0] * prof + tang[0] * u,
    v,
    cz + haciaDentro[2] * prof + tang[2] * u,
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
export interface OpcionesDeSala {
  /**
   * LA SALA HECHA EN BLENDER, si está cargada. Entonces la pared y el hierro de cajas no
   * se construyen —los trae la pieza— y los marcadores se cuelgan del muro rectangular
   * de esa sala, a la distancia que toque en cada dirección, en vez de en el cilindro.
   */
  salaDeBlender?: { medioAncho: number; medioFondo: number }
}

/**
 * A qué distancia queda el muro de una sala RECTANGULAR en una dirección dada.
 *
 * Es lo que permite colgar los marcadores de las paredes de la sala de Blender: un
 * rayo desde el centro en el ángulo pedido choca antes con el muro largo o con el corto,
 * y el marcador se pone justo ahí. Pura, y probada contra las cuatro paredes.
 */
export function radioDelMuroRectangular(medioAncho: number, medioFondo: number, anguloGrados: number): number {
  const a = grados(anguloGrados)
  const co = Math.abs(Math.cos(a))
  const si = Math.abs(Math.sin(a))
  const porAncho = co > 1e-9 ? medioAncho / co : Infinity
  const porFondo = si > 1e-9 ? medioFondo / si : Infinity
  return Math.min(porAncho, porFondo)
}

/**
 * HASTA DÓNDE PUEDE ALEJARSE LA CÁMARA SIN SALIRSE DE LA SALA.
 *
 * La órbita se aleja hasta 6,5 m. En la sala cilíndrica de 7 m eso siempre caía dentro; en
 * la sala rectangular de Blender, **el muro corto está a 5,5**, así que al alejarse hacia
 * el fondo la cámara se salía de la habitación y se veían las paredes desde fuera,
 * atravesándose unas con otras. Lo vio Bryan navegando el 2026-09-05: «se cruzan paredes
 * que no se debían cruzar».
 *
 * El tope no es un número: **depende de hacia dónde se mire**. Mirando al muro largo caben
 * 8 metros; al corto, 5,5. Y depende de la elevación, porque lo que acerca la cámara a la
 * pared es su distancia HORIZONTAL, no la que la separa del sujeto.
 *
 * Devuelve una función porque el centro de la órbita se mueve con el ejercicio —el encuadre
 * mira al centro del cuerpo— y el tope hay que recalcularlo con él.
 */
export function topeDeDistanciaEnSala(
  sala: { medioAncho: number; medioFondo: number; alto: number },
  margen = 0.35,
): (centro: readonly [number, number, number], azimutGrados: number, elevacionGrados: number) => number {
  const limX = sala.medioAncho - margen
  const limZ = sala.medioFondo - margen
  const limY = sala.alto - margen
  return (centro, azimutGrados, elevacionGrados) => {
    const a = grados(azimutGrados)
    const e = grados(elevacionGrados)
    // La misma cuenta que `Orbita.ojo()`: el ojo va en centro + [sen a·cos e, sen e, cos a·cos e]·d.
    const dir: Vec3 = [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)]
    const limites = [limX, limY, limZ]
    let tope = Infinity
    for (let k = 0; k < 3; k++) {
      const v = dir[k]
      // Casi paralelo a esa pared: nunca la alcanza por ese eje.
      if (Math.abs(v) < 1e-6) continue
      // El suelo no cuenta como pared: por debajo la limita la elevación, no la sala.
      const limite = v > 0 ? limites[k] : k === 1 ? Infinity : -limites[k]
      if (!Number.isFinite(limite)) continue
      const d = (limite - centro[k]) / v
      if (d > 0) tope = Math.min(tope, d)
    }
    return tope
  }
}

/**
 * Los ángulos de la ÓRBITA en que la sala de Blender no deja nada detrás del sujeto.
 *
 * Medido sobre `public/piezas/sala-gimnasio.pieza`, que es lo que se descarga: en estos
 * once, todo lo que queda en el cuadro por detrás son vértices de la parte `hormigon`. La
 * lista va aquí escrita a mano y no se calcula en ejecución a propósito —recorrer 38.000
 * vértices por 36 ángulos no es trabajo de un fotograma— y `piezas3d.test.ts` la comprueba
 * contra la pieza real: si alguien reexporta la sala y mueve el hierro, se pone rojo
 * pidiendo que se actualice.
 */
export const ANGULOS_SIN_FONDO = [0, 10, 20, 170, 180, 190, 200, 210, 330, 340, 350] as const

export function construirSala(
  m: Malla,
  /**
   * Las tres cifras del marcador, o `undefined` cuando no hay nada que marcar.
   *
   * **La sala se construye igual.** Hasta el 2026-09-10 esto era obligatorio y la
   * habitación colgaba de ello, así que un día de cardio —que no tiene números de serie—
   * se quedaba sin gimnasio: el sujeto salía sobre negro y con el encuadre de estudiar un
   * patrón en vez del del salón. Una sala es una sala haya o no serie; lo que depende de
   * los números es el MARCADOR, y solo él.
   */
  cifras: CifrasDelMuro | undefined,
  azimutDeEntrada?: number,
  opciones: OpcionesDeSala = {},
): void {
  const blender = opciones.salaDeBlender
  if (!blender) pared(m)
  // TRES MARCADORES FIJOS, COMO EN UN PABELLÓN — más uno en el muro que se está mirando.
  //
  // Los tres de siempre cuelgan a 90°, 210° y 330°, que son ángulos de la SALA y no del
  // ejercicio. Eso está bien para que la sala tenga marcadores mires donde mires, y mal
  // para lo único que importa al abrir: con la sentadilla se entra a 72°, el muro de
  // enfrente cae en 252°, y el marcador más cercano queda a más de cuarenta grados. O
  // sea: las cifras estaban en la pared y no se veían.
  //
  // El cuarto se cuelga enfrente de quien entra. Es lo que permitió quitar el letrero que
  // flotaba sobre el sujeto: los números que Bryan quería «literal en una pared» ya no
  // necesitan un panel encima del cuerpo, porque están en la pared de verdad y en
  // geometría de siete segmentos, no en HTML.
  const angulos = [90, 210, 330]
  if (azimutDeEntrada !== undefined) {
    // El azimut de la órbita mide desde +Z; el de la sala, desde +X. La media vuelta pone
    // el muro de enfrente, y los 90 traducen entre las dos convenciones.
    angulos.push(90 - (azimutDeEntrada + 180))
  }
  if (cifras) for (const a of angulos) marcador(m, a, cifras, blender)
  estacion(m)
  // EL HIERRO. Va el último porque es lo que menos cambia: la pared y los marcadores se
  // rehacen cuando avanza la serie, y el mobiliario no depende de ningún dato.
  //
  // Con la sala de Blender el hierro viene dentro de la pieza… casi. Medido el 2026-09-06
  // sobre la pieza que se descarga: viene apelotonado en los dos muros largos, y en ONCE de
  // los 36 ángulos de la órbita lo único que queda detrás del sujeto es hormigón pelado.
  // Eso tira por tierra la regla que `mobiliario.ts` dejó escrita tras medirla —«se mire por
  // donde se mire tiene que haber algo detrás»— así que esos once se rellenan aquí.
  //
  // No con las estaciones de siempre: su anillo es circular y esta sala es rectangular, y
  // contra un muro corto no cabe ni un árbol de discos. Cabe un estante de pared, y es lo
  // que va. El porqué, con los números pieza a pieza, está en `mobiliario.ts`.
  if (blender) construirRellenoDeMuro(m, ANGULOS_SIN_FONDO, blender.medioAncho, blender.medioFondo)
  else construirMobiliario(m, RADIO_SALA, ALTO_SALA)
}

/** Los números de la serie que se está haciendo, que son los que van al marcador. */
export interface DatosDeSerie {
  series: number
  reps: number
  /** El RIR objetivo, o el FALLO — que NO es lo mismo que un RIR 0. */
  rir: number | 'FALLO'
}

/**
 * LAS TRES CIFRAS DEL MARCADOR DEL MURO, ya traducidas.
 *
 * El marcador es un marcador de pabellón: tres cifras de siete segmentos, sin un rótulo que
 * las nombre. Por eso funciona con cualquier trabajo — siempre responde a las mismas tres
 * preguntas, y solo cambia la ropa:
 *
 * | | cuántas veces | cuánto cada vez | con cuánto esfuerzo |
 * | --- | --- | --- | --- |
 * | hierro | series | repeticiones | RIR (o `FALLO`) |
 * | cardio | tramos | minutos | RPE o zona |
 *
 * Los tamaños son los del panel y no se negocian: dos dígitos, dos dígitos y uno. Los
 * tramos y los minutos caben en dos; el RPE y la zona son de una cifra por definición.
 */
export interface CifrasDelMuro {
  /** Dos dígitos: cuántas veces. */
  veces: number
  /** Dos dígitos: cuánto dura cada vez. */
  cuanto: number
  /** Un dígito. `undefined` apaga la casilla: no está escrito, y no se inventa. */
  esfuerzo: number | 'FALLO' | undefined
}

/** Lo que marca el muro un día de hierro. */
export function cifrasDeLaSerie(datos: DatosDeSerie): CifrasDelMuro {
  return { veces: datos.series, cuanto: datos.reps, esfuerzo: datos.rir }
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
  /**
   * CUÁNTO PUEDE INCLINARSE LA CÁMARA DEL SALÓN HACIA EL SUELO, en grados.
   *
   * **Es del SALÓN, no del patrón.** Cada patrón trae su elevación de estudio
   * (`patron.camara.elevacion`) y en el catálogo va de 2° a 56°, porque un ejercicio
   * tumbado se estudia desde arriba. Ese ángulo sigue mandando cuando el visor monta el
   * patrón solo, que es para lo que se eligió: ver el movimiento.
   *
   * Pero el salón no es un estudio, es una habitación, y una habitación tiene paredes.
   * Medido el 2026-09-03: **a partir de 32° no se ve ni un punto del muro** de 6,8 m —el
   * cono de la cámara cae entero sobre el suelo—, así que los cuadros colgados quedaban
   * entre 629 y 861 px por encima de la pantalla y el salón se abría sin una letra
   * dentro. A 46°, la altura de muro más alta que entra en el cuadro es −1,98 m.
   *
   * **Diez otra vez.** Fue diez, bajó a ocho el 2026-09-03 al componer el tablón —un
   * tablón más alto necesita más muro— y vuelve a diez el mismo día, cuando las cifras se
   * mudaron a la geometría del muro y el tablón pasó de declarar 1,5 m a 0,85. Los dos
   * grados no se recuperan por gusto: cada grado que este tope sube es un patrón más que
   * entra en el salón con su ángulo de estudio intacto. El número lo mide
   * `geometriaDeCuadro.test.ts`, que lo recalcula y lo compara; si alguien vuelve a
   * engordar el tablón, esa prueba lo dice y este número baja.
   *
   * El techo real está clavado en `geometriaDeCuadro.test.ts`, y si alguien le añade una
   * línea al tablón baja y esa prueba lo dice. La cuenta al día de hoy: 18 de los 32
   * patrones entran por debajo del tope y a 14 se les acota la entrada.
   *
   * Lo que se paga: un press tumbado se ve casi de perfil en vez de desde arriba. Lo
   * decidió Bryan el 2026-09-03, viendo las dos capturas. Y lo que NO toca: el ángulo y
   * la distancia de la estación de grabación, que son el contrato de medida del encoder
   * y no se mueven por motivos de encuadre.
   */
  // Nueve desde el 2026-09-06: la prescripción volvió al muro, grande y sin retirarse, por
  // orden de Bryan («pegada en la pared y muy grande»). El tablón declara 1,2 m en vez de
  // 0,85 y el techo baja un grado. Y SIETE desde el 2026-09-07: el margen de arriba pasa de
  // 28 a 72 px para que el tablón no se meta bajo la banda de la sesión (captura de Bryan).
  // `geometriaDeCuadro.test.ts` lo recalcula.
  elevacionMaxima: 7,
} as const

/**
 * La elevación con la que el SALÓN mira al sujeto, dada la del patrón.
 *
 * Función y no un `Math.min` suelto en el visor por una razón práctica: el visor monta
 * la órbita dentro del efecto que crea el contexto WebGL, y jsdom no tiene WebGL — ahí
 * dentro no hay prueba que llegue. Sacada aquí, la regla se comprueba contra el catálogo
 * entero sin abrir un navegador.
 */
export function elevacionDelSalon(elevacionDelPatron: number): number {
  return Math.min(elevacionDelPatron, ENCUADRE_SALA.elevacionMaxima)
}

/** Cuánto aire se deja bajo el techo y sobre el suelo al inclinar la cámara a mano. */
export const HOLGURA_DEL_TECHO = 0.45
export const HOLGURA_DEL_SUELO = 0.25
/** Y los topes que no se cruzan ni con todo el aire del mundo: un poco desde abajo, y no
 *  tanto desde arriba que el muro de enfrente se vaya de la pantalla. */
export const INCLINACION_A_MANO = { min: -6, max: 22 }

/**
 * HASTA DÓNDE SE PUEDE INCLINAR LA CÁMARA A MANO DENTRO DE LA SALA.
 *
 * La entrada de cada patrón se acota a `ENCUADRE_SALA.elevacionMaxima` para que el tablón
 * del muro entre en el cuadro. Orbitar con el dedo es otra cosa: quien gira quiere ver la
 * sala y puede perder el tablón un momento; lo que no puede es meter la cámara bajo el
 * suelo ni por encima del techo. Medido el 2026-09-06 con toques emulados: con los ±78°
 * del estudio, el dedo dejaba la cámara a −78°, mirando la sala desde debajo del suelo.
 *
 * Se calcula contra el centro y la distancia reales: el ojo está a
 * `centro.y + distancia · sin(elevación)`, así que un sujeto colgado de una barra —centro
 * más alto— llega antes al techo con el mismo ángulo.
 */
export function topesDeElevacion(centro: readonly number[], distancia: number): { min: number; max: number } {
  const d = Math.max(distancia, 0.01)
  const seno = (v: number) => Math.max(-1, Math.min(1, v))
  const aGrados = (r: number) => (r * 180) / Math.PI
  const arriba = aGrados(Math.asin(seno((ALTO_SALA - HOLGURA_DEL_TECHO - centro[1]) / d)))
  const abajo = aGrados(Math.asin(seno((HOLGURA_DEL_SUELO - centro[1]) / d)))
  return {
    min: Math.max(INCLINACION_A_MANO.min, abajo),
    max: Math.min(INCLINACION_A_MANO.max, arriba),
  }
}
