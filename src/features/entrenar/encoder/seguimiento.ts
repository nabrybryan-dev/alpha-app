/**
 * Dónde mirar en el fotograma de ahora — la política de seguimiento.
 *
 * El núcleo sabe decir «este color está en estos píxeles» y «este contorno es un
 * disco de radio r». Lo que no sabe, porque no ve más que un fotograma suelto,
 * es **dónde conviene mirar**. Eso lo decide la app, y hasta ahora lo decidía
 * dentro del bucle de `useCaptura`, mezclado con el canvas y con React.
 *
 * Sacarlo aquí no es orden por el orden. Es que la calidad de la medida vive
 * justo en estas tres decisiones, y dentro de un hook con cámara no se pueden
 * probar sin un navegador:
 *
 * 1. **Mirar el fotograma entero es lo que deja entrar a los intrusos.** Un
 *    disco pintado, una camiseta, el logo de la pared: cualquier cosa del color
 *    del marcador entra en la nube, y `separarMarcadores` devuelve un centroide
 *    a mitad de camino entre la marca y el intruso. No falla: devuelve un
 *    número, y ese número se guarda. `nucleo/analisis.js` ya traía
 *    `centroideEnVentana` con el comentario de que la ventana «es la misma reja
 *    de plausibilidad que usa el disco» — estaba escrita, tipada, y sin usar.
 *
 * 2. **La predicción del disco se hacía sin velocidad.** `detectarDisco` pide
 *    «posición anterior + velocidad» y se le pasaba solo la posición anterior.
 *    Con su reja de 40 px, en cuanto caen un par de fotogramas la barra recorre
 *    más de lo que la reja admite y el fotograma se descarta — y se descarta en
 *    la parte RÁPIDA de la repetición, que es justo la que decide el %PV.
 *
 * 3. **Los mínimos de saturación y brillo eran fijos.** Un marcador pastel
 *    —rosa claro, amarillo flúor descolorido— no llega a 0,35 de saturación y
 *    entonces no casa NUNCA con nada. En pantalla eso se lee como «la cámara va
 *    mal», y lo que pasa es que el filtro descartó la marca antes de mirarla.
 *
 * Aquí no hay DOM: entra un `Uint8ClampedArray` y salen números. Eso es lo que
 * permite que `scripts/banco-encoder.mjs` lo corra con `node` a secas.
 */

import {
  centroideEnVentana,
  detectarDianaCuatro,
  distanciaTono,
  pixelesQueCasan,
  rgbAHsv,
  separarMarcadores,
  unSoloMarcador,
  type DianaCuatro,
  type DosMarcadores,
  type Hsv,
  type MarcadorUnico,
  type Nube,
} from './nucleo/analisis.js'
import { detectarDisco, identificarEstructura, type DiscoVisto, type Estructura } from './nucleo/disco.js'
import type { Referencia } from './tanda'

export type Deteccion = DianaCuatro | DosMarcadores | MarcadorUnico | DiscoVisto

export const esDiana = (d: Deteccion | undefined): d is DianaCuatro =>
  d !== undefined && 'nMarcas' in d && d.nMarcas === 4

export const esPareja = (d: Deteccion | undefined): d is DosMarcadores =>
  d !== undefined && 'a' in d && 'b' in d

export const esDisco = (d: Deteccion | undefined): d is DiscoVisto =>
  d !== undefined && 'cobertura' in d

export interface Recuadro {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface AjustesSeguimiento {
  referencia: Referencia
  /** Entre centros de marca, en mm. Solo con diana. */
  dianaMm: [number, number]
  tolTono: number
}

export interface Paso {
  det?: Deteccion
  /** Píxeles que casaron con el color. `null` con disco: ahí no se mira color. */
  nPix: number | null
  /** Dónde se miró. Se dibuja en la capa: una ventana que se sale de la imagen
   *  o que se queda atrás explica el fallo mucho mejor que un contador. */
  ventana?: Recuadro
  /** Fotogramas seguidos sin ver la referencia. */
  perdidos: number
}

/** Tras estos fotogramas seguidos sin ver nada se vuelve a mirar el fotograma
 *  entero. Cinco a 60 fps son 83 ms: lo justo para que una oclusión corta —la
 *  mano del que ayuda, un cruce— no obligue a reenganchar desde cero, y lo
 *  bastante poco para que una pérdida de verdad no tarde en recuperarse. */
const REENGANCHE_TRAS = 5

/** Margen mínimo de la ventana, en píxeles, sobre el tamaño de lo que se
 *  persigue. Por debajo de esto la ventana persigue el ruido del centroide. */
const MARGEN_MIN_PX = 28

/** Cuánto de la velocidad del fotograma anterior se cree para agrandar la
 *  ventana. 1,5 y no 1: la barra acelera dentro de la concéntrica, así que el
 *  desplazamiento del fotograma que viene es mayor que el del que pasó. */
const CREDITO_VELOCIDAD = 1.5

/** Tope del salto que se le admite a la predicción. Sin tope, un fotograma con
 *  la detección mal puesta lanza la ventana al otro lado de la imagen y el
 *  seguimiento no vuelve. */
const SALTO_MAX_PX = 90

/** Radio, en píxeles, donde se busca la marca que se acaba de tocar. */
const RADIO_DEL_TOQUE = 45

/** Al fijar, la referencia se busca en esta fracción de la imagen alrededor del
 *  toque, no en la imagen entera.
 *
 *  Es la corrección más importante de todo el módulo, y la que menos se ve. La
 *  ventana de seguimiento no sirve de nada si el PRIMER fotograma se engancha a
 *  lo que no es: a partir de ahí la ventana persigue al intruso con toda
 *  fidelidad, y el resultado sale limpio, con sus tres repeticiones y su %PV,
 *  midiendo dos tercios de la velocidad real. Medido en el banco: v₁ 0,398
 *  donde la verdad era 0,600, y la puerta de calidad no tenía nada que objetar.
 *
 *  El dato que lo arregla estaba ahí desde el principio: **el sitio donde el
 *  dedo tocó**. Se usaba para leer el color y se tiraba. El 0,4 deja dentro al
 *  otro extremo de una barra que ocupe hasta el 80 % del encuadre y deja fuera
 *  lo que esté en la otra punta de la imagen. */
const ACOTAR_AL_TOQUE = 0.4

/**
 * Fracción de lo mirado que puede casar con el color antes de dar por hecho que
 * lo que se tocó es el FONDO.
 *
 * Hace de contrapeso de `umbralesDelColor`. Bajar los mínimos para que una marca
 * pálida se vea abre la puerta a lo contrario: un gris de pared tiene poca
 * saturación, así que con los mínimos rebajados casa consigo mismo, la nube es
 * la imagen entera, y `separarMarcadores` la parte en dos mitades y devuelve una
 * pareja impecable — que es el suelo y la pared.
 *
 * El criterio no es cuánto color tiene la marca, que en un pastel es poco: es
 * cuánto del encuadre es de ese color. Una marca ocupa décimas de por ciento.
 */
const FRACCION_MAX_DEL_COLOR = 0.2

/**
 * Los mínimos de saturación y brillo que corresponden al color que se fijó.
 *
 * Nunca por encima de los del núcleo —un marcador saturado se sigue filtrando
 * igual de duro— pero sí por debajo cuando la marca es pálida. El 0,6 es el
 * margen para que la misma marca siga casando cuando la luz del gimnasio le
 * quita saturación a media serie.
 */
export function umbralesDelColor(color: Hsv): { minSat: number; minVal: number } {
  return {
    minSat: Math.min(0.35, Math.max(0.08, color.s * 0.6)),
    minVal: Math.min(0.25, Math.max(0.08, color.v * 0.6)),
  }
}

/** El recuadro que envuelve lo detectado, con margen. */
export function recuadroDe(
  puntos: Array<{ x: number; y: number }>,
  margen: number,
  ancho: number,
  alto: number,
): Recuadro | undefined {
  if (puntos.length === 0) return undefined
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of puntos) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x)
    y1 = Math.max(y1, p.y)
  }
  if (!Number.isFinite(x0)) return undefined
  return {
    x0: Math.max(0, Math.floor(x0 - margen)),
    y0: Math.max(0, Math.floor(y0 - margen)),
    x1: Math.min(ancho - 1, Math.ceil(x1 + margen)),
    y1: Math.min(alto - 1, Math.ceil(y1 + margen)),
  }
}

/**
 * La nube de píxeles del color, mirando SOLO dentro del recuadro.
 *
 * La prueba del color es la del núcleo —`rgbAHsv` y `distanciaTono`, las mismas
 * funciones— porque duplicarla aquí crearía un segundo criterio parecido al
 * primero sin serlo, y el día que alguien afinara uno el otro seguiría igual.
 * Lo único que cambia es por dónde pasa el bucle.
 *
 * Las coordenadas que salen son las de la IMAGEN, no las del recuadro: quien
 * llama no tiene que deshacer ningún desplazamiento, y por tanto no puede
 * olvidarse de deshacerlo.
 */
export function nubeEnRecuadro(
  datos: Uint8ClampedArray,
  ancho: number,
  alto: number,
  objetivo: Hsv,
  recuadro: Recuadro,
  opciones: { tolTono?: number; minSat?: number; minVal?: number; paso?: number } = {},
): Nube {
  const { tolTono = 22, minSat = 0.35, minVal = 0.25, paso = 1 } = opciones
  const xs: number[] = []
  const ys: number[] = []
  const yFin = Math.min(alto - 1, recuadro.y1)
  const xFin = Math.min(ancho - 1, recuadro.x1)
  for (let y = Math.max(0, recuadro.y0); y <= yFin; y += paso) {
    for (let x = Math.max(0, recuadro.x0); x <= xFin; x += paso) {
      const i = (y * ancho + x) * 4
      const r = datos[i]
      const g = datos[i + 1]
      const b = datos[i + 2]
      if (r < 45 && g < 45 && b < 45) continue
      const hsv = rgbAHsv(r, g, b)
      if (hsv.s < minSat || hsv.v < minVal) continue
      if (distanciaTono(hsv.h, objetivo.h) > tolTono) continue
      xs.push(x)
      ys.push(y)
    }
  }
  return { xs, ys, n: xs.length }
}

/** ¿La detección incluye la marca que se tocó?
 *
 *  Es la pregunta que separa «he encontrado la referencia» de «he encontrado
 *  algo». Sin ella, `separarMarcadores` puede devolver la marca de la izquierda
 *  emparejada con el logo de la pared, y eso no es un fallo que se vea: es una
 *  pareja con su separación, su ángulo y su punto medio, que se mueve la mitad
 *  de lo que se mueve la barra. */
function tocaAlguna(det: Deteccion, tocada: { x: number; y: number; n: number }): boolean {
  if (esDisco(det)) return Math.hypot(det.x - tocada.x, det.y - tocada.y) <= det.r
  // La tolerancia sale del tamaño de la propia mancha, no de un número fijo: con
  // 14 px fijos, una marca grande —un círculo de 5 cm a medio metro— se
  // rechazaba a sí misma, porque el centroide de la ventana del toque y el de la
  // detección completa no tienen por qué caer en el mismo píxel.
  const radio = Math.sqrt(tocada.n / Math.PI)
  const tolerancia = Math.max(14, radio * 1.5)
  return puntosDe(det).some((p) => Math.hypot(p.x - tocada.x, p.y - tocada.y) <= tolerancia)
}

/** Las dos esquinas que envuelven un círculo. */
function esquinasDe(c: { x: number; y: number; r: number }): Array<{ x: number; y: number }> {
  return [
    { x: c.x - c.r, y: c.y - c.r },
    { x: c.x + c.r, y: c.y + c.r },
  ]
}

/** Los puntos que definen dónde está la referencia, para envolverlos. */
function puntosDe(det: Deteccion): Array<{ x: number; y: number }> {
  if (esDiana(det)) return det.marcas
  if (esPareja(det)) return [det.a, det.b]
  if (esDisco(det)) return esquinasDe(det)
  return [{ x: det.x, y: det.y }]
}

export interface Seguimiento {
  /** Fija la referencia tocando la imagen. */
  fijarColor(
    datos: Uint8ClampedArray,
    ancho: number,
    alto: number,
    x: number,
    y: number,
    ajustes: AjustesSeguimiento,
  ): { ok: boolean; color: Hsv; nPix: number; det?: Deteccion; esFondo?: boolean }
  fijarDisco(datos: Uint8ClampedArray, ancho: number, alto: number, x: number, y: number, opciones?: { radioMax?: number }): Estructura
  /** Un fotograma. */
  paso(datos: Uint8ClampedArray, ancho: number, alto: number, ajustes: AjustesSeguimiento): Paso
  /** ¿Hay ya una referencia fijada? */
  readonly fijado: boolean
  readonly color: Hsv | null
  readonly radioDisco: number | null
  reiniciar(): void
}

export function nuevoSeguimiento(): Seguimiento {
  let color: Hsv | null = null
  let umbrales = { minSat: 0.35, minVal: 0.25 }
  let radioDisco: number | null = null
  let ultima: { x: number; y: number } | null = null
  let penultima: { x: number; y: number } | null = null
  /** Las marcas de la última detección, no su punto medio. La ventana envuelve
   *  ESTO. Envolver el punto medio con un margen que cubriera hasta la marca
   *  más lejana daba un cuadrado de lado igual a la barra entera: 102.000
   *  píxeles a mirar donde el fotograma completo a paso 2 eran 57.600. La
   *  ventana salía más cara que no tener ventana. */
  let ultimosPuntos: Array<{ x: number; y: number }> = []
  /** La separación entre marcas de la última detección completa. Es lo que
   *  permite distinguir «la referencia» de «algo con forma de referencia»:
   *  una barra no se estira entre dos fotogramas. */
  let ultimaSep: number | null = null
  let perdidos = 0

  /** Dónde estará la referencia en este fotograma, según lo que hizo en el
   *  anterior. `detectarDisco` pide exactamente esto, y estaba sin dárselo. */
  function prediccion(): { x: number; y: number } | null {
    if (!ultima) return null
    if (!penultima) return ultima
    const dx = ultima.x - penultima.x
    const dy = ultima.y - penultima.y
    const salto = Math.hypot(dx, dy)
    const k = salto > SALTO_MAX_PX ? SALTO_MAX_PX / salto : 1
    return { x: ultima.x + dx * k, y: ultima.y + dy * k }
  }

  function velocidadPx(): number {
    if (!ultima || !penultima) return 0
    return Math.hypot(ultima.x - penultima.x, ultima.y - penultima.y)
  }

  function anotar(det: Deteccion | undefined) {
    if (!det) {
      perdidos++
      return
    }
    const anterior = ultima
    perdidos = 0
    penultima = ultima
    const sep = esDiana(det) ? det.escalaPxM : esPareja(det) ? det.sepPx : NaN
    if (Number.isFinite(sep) && sep > 0) ultimaSep = sep
    const puntos = puntosDe(det)

    if (puntos.length >= ultimosPuntos.length || !anterior) {
      ultima = { x: det.x, y: det.y }
      ultimosPuntos = puntos
      return
    }

    // Se ha visto MENOS de lo que había: una marca de las dos, tres de las
    // cuatro. Dos cosas que NO hay que hacer aquí, y las dos parecen lo natural:
    //
    // 1. Encoger la ventana alrededor de lo poco que se vio. Es una trampa de un
    //    solo sentido: lo que queda fuera ya no puede volver a entrar, porque la
    //    ventana del fotograma siguiente se dibuja sobre lo que se vio en éste.
    // 2. Tomar el centro de lo visto como centro del conjunto. El centro de una
    //    pareja está en medio de las dos marcas; el de una marca sola, encima de
    //    ella. Con las marcas a 240 px, eso es un salto de 120 px que no ha dado
    //    nadie — y arrastra la ventana medio encuadre de golpe, justo cuando lo
    //    que hacía falta era no moverla.
    //
    // Lo que se hace es medir cuánto se ha movido lo que SÍ se ve respecto de
    // donde estaba, y mover el conjunto entero esa misma cantidad.
    let sx = 0
    let sy = 0
    for (const p of puntos) {
      let cerca = ultimosPuntos[0]
      for (const q of ultimosPuntos) {
        if (Math.hypot(p.x - q.x, p.y - q.y) < Math.hypot(p.x - cerca.x, p.y - cerca.y)) cerca = q
      }
      sx += p.x - cerca.x
      sy += p.y - cerca.y
    }
    const dx = sx / puntos.length
    const dy = sy / puntos.length
    ultimosPuntos = ultimosPuntos.map((p) => ({ x: p.x + dx, y: p.y + dy }))
    ultima = { x: anterior.x + dx, y: anterior.y + dy }
  }

  /** La ventana de este fotograma, o `undefined` si toca mirarlo entero. */
  function ventana(ancho: number, alto: number): Recuadro | undefined {
    if (!ultima || perdidos >= REENGANCHE_TRAS || ultimosPuntos.length === 0) return undefined
    const p = prediccion()!
    // Las marcas de antes, movidas adonde la velocidad dice que estarán ahora.
    const dx = p.x - ultima.x
    const dy = p.y - ultima.y
    const movidos = ultimosPuntos.map((q) => ({ x: q.x + dx, y: q.y + dy }))
    const margen = MARGEN_MIN_PX + velocidadPx() * CREDITO_VELOCIDAD
    // Al perder fotogramas la ventana se abre: la referencia puede haber
    // seguido moviéndose mientras no se la veía.
    return recuadroDe(movidos, margen * (1 + perdidos * 0.5), ancho, alto)
  }

  /** Detecta dentro de un recuadro, o en el fotograma entero si no hay. */
  function detectarEn(
    datos: Uint8ClampedArray,
    ancho: number,
    alto: number,
    ajustes: AjustesSeguimiento,
    marco: Recuadro | undefined,
  ): { det?: Deteccion; nPix: number; escaneados: number } {
    const objetivo = color
    if (!objetivo) return { nPix: 0, escaneados: 1 }
    // Con ventana se mira píxel a píxel aunque sean dos marcadores: el área es
    // una fracción del fotograma, así que el paso 2 —que existía para llegar a
    // 60 fps— ya no hace falta, y el centroide sale de cuatro veces más píxeles.
    const paso = marco ? 1 : ajustes.referencia === 'diana4' ? 1 : 2
    const opciones = { tolTono: ajustes.tolTono, ...umbrales, paso }
    const nube = marco
      ? nubeEnRecuadro(datos, ancho, alto, objetivo, marco, opciones)
      : pixelesQueCasan(datos, ancho, alto, objetivo, opciones)
    const det =
      ajustes.referencia === 'diana4'
        ? (detectarDianaCuatro(nube, ajustes.dianaMm[0], ajustes.dianaMm[1]) ?? unSoloMarcador(nube))
        : (separarMarcadores(nube) ?? unSoloMarcador(nube))
    const ancho0 = marco ? marco.x1 - marco.x0 + 1 : ancho
    const alto0 = marco ? marco.y1 - marco.y0 + 1 : alto
    return { det, nPix: nube.n, escaneados: Math.max(1, (ancho0 * alto0) / (paso * paso)) }
  }

  function detectarPorColor(
    datos: Uint8ClampedArray,
    ancho: number,
    alto: number,
    ajustes: AjustesSeguimiento,
  ): Paso {
    if (!color) return { nPix: null, perdidos }
    const marco = ventana(ancho, alto)
    const { det, nPix } = detectarEn(datos, ancho, alto, ajustes, marco)

    // Un fallo DENTRO de la ventana puede ser que la referencia se salió de
    // ella. Se reintenta el fotograma entero en el acto en vez de esperar a
    // gastar el contador de reenganche: son cinco fotogramas de diferencia, y a
    // 60 fps eso es todo el arranque de una repetición.
    //
    // «Fallo» incluye ver UNA marca donde se esperaban dos o cuatro, y eso no es
    // un detalle: `unSoloMarcador` devuelve un punto, la ventana del fotograma
    // siguiente se encoge alrededor de ese punto, y entonces la otra marca ya no
    // cabe dentro **nunca más**. Una oclusión de tres fotogramas —la mano del
    // que ayuda cruzando por delante— dejaba la serie entera midiendo con un
    // solo marcador: sin escala, en píxeles por segundo, y sin un mal aviso,
    // porque un solo marcador es una detección legítima.
    if ((!det || degradada(det, ajustes)) && marco) {
      const entero = detectarEn(datos, ancho, alto, ajustes, undefined)
      // Si en la ventana NO había nada, la referencia se fue de ella y el
      // fotograma entero es la única opción que queda: se acepta lo que dé.
      if (!det) {
        anotar(entero.det)
        return { det: entero.det, nPix: entero.nPix, perdidos }
      }
      // Si en la ventana SÍ había algo —una marca de las dos— la referencia
      // está donde se está mirando y lo que falta es una marca tapada. Aquí el
      // fotograma entero solo vale si lo que trae CUADRA con lo que se venía
      // siguiendo. Sin esa condición, este reintento es la puerta trasera por
      // la que vuelve a entrar el intruso: encuentra una pareja perfecta hecha
      // de la marca visible y el logo de la pared, y como es una pareja y no un
      // marcador suelto, gana.
      if (entero.det && !degradada(entero.det, ajustes) && cuadra(entero.det)) {
        anotar(entero.det)
        return { det: entero.det, nPix: entero.nPix, perdidos }
      }
    }

    anotar(det)
    return { det, nPix, ventana: marco, perdidos }
  }

  /** ¿La detección es de menos categoría que la referencia que se pidió? */
  function degradada(det: Deteccion, ajustes: AjustesSeguimiento): boolean {
    if (ajustes.referencia === 'diana4') return !esDiana(det)
    if (ajustes.referencia === 'marcadores') return !esPareja(det)
    return false
  }

  /**
   * ¿Lo que trae el fotograma entero es la MISMA referencia que se venía
   * siguiendo, o es otra cosa que también tiene forma de referencia?
   *
   * Dos condiciones, y las dos son geometría, no confianza: la separación entre
   * marcas no cambia de golpe —la barra no se estira— y el conjunto no se
   * teletransporta entre dos fotogramas. Una pareja hecha de la marca buena y
   * un intruso falla las dos: su separación no tiene nada que ver con la de
   * antes, y su punto medio está a media imagen de donde estaba.
   */
  function cuadra(det: Deteccion): boolean {
    if (!ultima) return true
    if (Math.hypot(det.x - ultima.x, det.y - ultima.y) > SALTO_MAX_PX) return false
    if (ultimaSep === null) return true
    const sep = esDiana(det) ? det.escalaPxM : esPareja(det) ? det.sepPx : NaN
    if (!Number.isFinite(sep) || sep <= 0) return true
    return Math.abs(sep - ultimaSep) / ultimaSep <= 0.35
  }

  function detectarPorDisco(datos: Uint8ClampedArray, ancho: number, alto: number): Paso {
    if (radioDisco === null) return { nPix: null, perdidos }
    const centro = prediccion() ?? { x: ancho / 2, y: alto / 2 }
    const opciones = { radioMax: Math.round(radioDisco * 1.35) }
    let d = detectarDisco(datos, ancho, alto, centro, radioDisco, opciones)

    // Si la predicción falló, se prueba con la posición anterior a secas: la
    // barra pudo frenar en seco —el final de la concéntrica hace exactamente
    // eso— y entonces la predicción se pasa de largo.
    if (!d.ok && ultima && (centro.x !== ultima.x || centro.y !== ultima.y)) {
      d = detectarDisco(datos, ancho, alto, ultima, radioDisco, opciones)
    }

    if (d.ok) {
      // El radio esperado se deja llevar despacio: si el asesorado se acerca a
      // la cámara, el disco crece, y con el radio congelado la banda de
      // búsqueda (±25 %) acaba dejando fuera el disco de verdad. La escala de
      // cada fotograma NO sale de aquí, sale del ajuste de ese fotograma; esto
      // solo mueve dónde se busca.
      radioDisco = radioDisco * 0.9 + d.r * 0.1
      anotar(d)
      // La ventana que se enseña es DONDE SE BUSCÓ —el círculo de rayos
      // alrededor de la predicción—, no el disco que se encontró. Enseñar el
      // hallazgo no informa de nada: siempre encaja consigo mismo.
      return {
        det: d,
        nPix: null,
        ventana: recuadroDe([centro], radioDisco * 1.35, ancho, alto),
        perdidos,
      }
    }

    anotar(undefined)
    // Reenganche: se vuelve a identificar la estructura desde la última
    // posición conocida, que es más caro y por eso no se hace cada fotograma.
    if (perdidos >= REENGANCHE_TRAS && ultima) {
      const e = identificarEstructura(datos, ancho, alto, ultima, {
        radioMax: Math.round(radioDisco * 1.8),
      })
      if (e.tipo === 'disco') {
        radioDisco = e.ajuste.r
        perdidos = 0
        penultima = null
        ultima = { x: e.ajuste.x, y: e.ajuste.y }
        ultimosPuntos = esquinasDe(e.ajuste)
      }
    }
    return { nPix: null, perdidos }
  }

  return {
    get fijado() {
      return color !== null || radioDisco !== null
    },
    get color() {
      return color
    },
    get radioDisco() {
      return radioDisco
    },

    reiniciar() {
      color = null
      radioDisco = null
      ultima = null
      penultima = null

      perdidos = 0
    },

    fijarColor(datos, ancho, alto, x, y, ajustes) {
      // Media de 7x7 para que un píxel raro no fije el tono de toda la tanda.
      const x0 = Math.max(0, Math.min(ancho - 7, x - 3))
      const y0 = Math.max(0, Math.min(alto - 7, y - 3))
      let sr = 0
      let sg = 0
      let sb = 0
      let n = 0
      for (let py = y0; py < y0 + 7; py++) {
        for (let px = x0; px < x0 + 7; px++) {
          const i = (py * ancho + px) * 4
          sr += datos[i]
          sg += datos[i + 1]
          sb += datos[i + 2]
          n++
        }
      }
      color = rgbAHsv(sr / n, sg / n, sb / n)
      umbrales = umbralesDelColor(color)
      ultima = null
      penultima = null
      perdidos = 0

      // La marca que se tocó, primero. Si aquí no hay nada de ese color, no hay
      // nada que fijar — y decirlo ahora es mucho mejor que decir después «no
      // veo la marca» cuando la serie ya se hizo.
      const tocada = centroideEnVentana(
        datos,
        ancho,
        alto,
        color,
        { x, y },
        RADIO_DEL_TOQUE,
        { tolTono: ajustes.tolTono, ...umbrales },
      )

      // Se comprueba EN EL ACTO que con ese color hay algo que medir. Antes se
      // daba «listo para grabar» sin mirar, y el fallo aparecía después de la
      // serie, con el asesorado ya sentado: la toma se perdía entera.
      const acotada = recuadroDe(
        [{ x, y }],
        Math.max(ancho, alto) * ACOTAR_AL_TOQUE,
        ancho,
        alto,
      )
      let intento = detectarEn(datos, ancho, alto, ajustes, acotada)
      // Solo si alrededor del toque no sale la referencia se abre a la imagen
      // entera: una barra que ocupe casi todo el encuadre cabe en el 40 %, pero
      // una diana pegada a dos esquinas opuestas no.
      let acertada = intento.det !== undefined && (!tocada || tocaAlguna(intento.det, tocada))
      if (!acertada) {
        const entero = detectarEn(datos, ancho, alto, ajustes, undefined)
        if (entero.det && (!tocada || tocaAlguna(entero.det, tocada))) {
          intento = entero
          acertada = true
        } else if (!intento.det) {
          intento = entero
        }
      }

      // Ese color no es una marca, es el decorado.
      const esElFondo = intento.nPix > intento.escaneados * FRACCION_MAX_DEL_COLOR
      if (esElFondo) {
        color = null
        return { ok: false, color: rgbAHsv(sr / n, sg / n, sb / n), nPix: intento.nPix, esFondo: true }
      }

      // Encontrar algo no es encontrar lo que se tocó. Si ninguno de los dos
      // intentos incluye la marca del dedo, lo que se ha encontrado es otra
      // cosa, y arrancar el seguimiento sobre otra cosa es lo que produce una
      // serie entera midiendo bien un objeto equivocado.
      //
      // Red de seguridad, y conviene saberlo: acotar al toque ya hace que esto
      // casi nunca salte, porque la marca del dedo suele caer dentro de la nube
      // que se acaba agrupando. No hay ningún caso del banco ni de los tests que
      // lo dispare — se queda porque es barato y porque el día que `acotada` se
      // afloje, esto es lo único que separa «he encontrado la referencia» de
      // «he encontrado algo».
      if (!acertada) {
        color = null
        return { ok: false, color: rgbAHsv(sr / n, sg / n, sb / n), nPix: intento.nPix }
      }

      anotar(intento.det)
      return {
        ok: intento.det !== undefined,
        color,
        nPix: tocada ? Math.max(intento.nPix, tocada.n) : intento.nPix,
        det: intento.det,
      }
    },

    fijarDisco(datos, ancho, alto, x, y, opciones = {}) {
      const e = identificarEstructura(datos, ancho, alto, { x, y }, opciones)
      if (e.tipo !== 'disco') {
        radioDisco = null
        ultima = null
        penultima = null
        ultimosPuntos = []
        return e
      }
      color = null
      radioDisco = e.ajuste.r
      ultima = { x: e.ajuste.x, y: e.ajuste.y }
      penultima = null
      ultimosPuntos = esquinasDe(e.ajuste)
      perdidos = 0
      return e
    },

    paso(datos, ancho, alto, ajustes) {
      if (ajustes.referencia === 'disco') return detectarPorDisco(datos, ancho, alto)
      return detectarPorColor(datos, ancho, alto, ajustes)
    },
  }
}
