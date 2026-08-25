/* Tipos escritos a mano para `analisis.js`, que entra VERBATIM desde
 * `herramientas/encoder-camara`. Ver `ORIGEN.md`.
 *
 * Se declara lo que usa la pantalla, no todo el módulo: un `.d.ts` que declara
 * de más miente igual que uno que declara de menos, y aquí lo caro es mentir.
 * Si la pantalla necesita otra función, se añade su firma leyendo el original. */

export interface Hsv { h: number; s: number; v: number }

export interface Nube { xs: Float64Array | number[]; ys: Float64Array | number[]; n: number }

export interface Centroide { x: number; y: number; n: number }

/** Dos marcadores separados: la escala sale de su distancia. */
export interface DosMarcadores {
  a: Centroide
  b: Centroide
  x: number
  y: number
  sepPx: number
  /** 0 = la barra sale horizontal en la imagen. */
  anguloGrados: number
}

/** Cuatro marcas coplanares. Separa escala de escorzo, que con dos es imposible. */
export interface DianaCuatro {
  /** px por metro, ya inmune al escorzo. */
  escalaPxM: number
  cosInclinacion: number
  inclinacionGrados: number
  anguloGrados: number
  rmsPx: number
  ambiguo: boolean
  conAncla: boolean
  deFrente: boolean
  x: number
  y: number
  marcas: Centroide[]
  nMarcas: 4
}

export type NivelCalidad = 'buena' | 'dudosa' | 'descartada'

export interface Calidad {
  nivel: NivelCalidad
  motivos: string[]
}

export interface Repeticion {
  rom: number
  concSeg: number
  vMedia: number
  vPico: number
  vExcPico?: number
}

export interface SerieFallida {
  ok: false
  motivo: string
  detalle?: string
  fpsReal?: number
  deteccion?: number
}

export interface SerieMedida {
  ok: true
  unidad: 'm/s' | 'px/s'
  hayEscala: boolean
  fpsReal: number
  deteccion: number
  sepPxMediana: number
  escalaPxM: number
  conDiana: boolean
  inclinacionGrados: number
  inclinacionMax: number
  anguloMediana: number
  reps: Repeticion[]
  vPrimera: number
  vUltima: number
  pvPct: number
  concSegMedia: number
  romRelativo: number
  compensacion: number
  calidad: Calidad
  serie: { t: number[]; s: number[]; v: number[] }
}

export type ResultadoSerie = SerieMedida | SerieFallida

export interface GravedadFallida {
  ok: false
  motivo: string
}

export interface GravedadMedida {
  ok: true
  aceleracion: number
  errorPct: number
  veredicto: 'VERDE' | 'DUDOSA' | 'ROJO'
  avisos: string[]
  nMuestras: number
  rmsPx: number
  descartadasInicio: number
  descartadasFinal: number
  sepPx: number
  dispersionSep: number
  estabilidad: number
  escalaPxM: number
  gRef: number
  inclinacionGrados: number
  referencia: 'cuatro marcas' | 'dos marcadores'
  fpsReal: number
}

export type ResultadoGravedad = GravedadMedida | GravedadFallida

/** Una muestra por fotograma. `t` en segundos, del reloj que se haya elegido. */
export interface Muestra {
  t: number
  /** NaN cuando el fotograma no vio la referencia. Es la marca de "perdido". */
  y: number
  x?: number
  sepPx?: number
  anguloGrados?: number
  escalaPxM?: number
  inclinacionGrados?: number
  nMarcas?: number
  fiable?: boolean
}

export function rgbAHsv(r: number, g: number, b: number): Hsv

/** Distancia angular entre dos tonos, en grados (0-180). El tono es circular:
 *  el rojo a 359° y el rojo a 1° distan 2, no 358. La usa `seguimiento.ts` para
 *  hacer la MISMA prueba de color que el núcleo dentro de una ventana. */
export function distanciaTono(a: number, b: number): number

export function pixelesQueCasan(
  datos: Uint8ClampedArray,
  ancho: number,
  alto: number,
  objetivo: Hsv,
  opciones?: { tolTono?: number; minSat?: number; minVal?: number; paso?: number },
): Nube

export function centroideEnVentana(
  datos: Uint8ClampedArray,
  ancho: number,
  alto: number,
  objetivo: Hsv,
  centro: { x: number; y: number },
  radio: number,
  opciones?: {
    tolTono?: number
    minSat?: number
    minVal?: number
    paso?: number
    minPixeles?: number
  },
): Centroide | undefined

export function separarMarcadores(nube: Nube, minPixeles?: number): DosMarcadores | undefined

/** Un solo marcador visible. Sirve para %PV, no para m/s: sin dos puntos no
 *  hay escala, y por eso `sepPx` y `anguloGrados` salen NaN a proposito. */
export interface MarcadorUnico {
  x: number
  y: number
  sepPx: number
  anguloGrados: number
  n: number
}

export function unSoloMarcador(nube: Nube, minPixeles?: number): MarcadorUnico | undefined

export function detectarDianaCuatro(
  nube: Nube,
  anchoMm: number,
  altoMm: number,
  minPixeles?: number,
): DianaCuatro | undefined

export function analizarSerie(
  muestras: Muestra[],
  opciones?: { sepMm?: number; sentido?: 'subir' | 'bajar' },
): ResultadoSerie

export function pruebaDeGravedad(
  muestras: Muestra[],
  sepMm: number,
  opciones?: { gRef?: number },
): ResultadoGravedad

export function pruebaSintetica(opciones?: {
  nReps?: number
  vInicial?: number
  pvObjetivo?: number
  fps?: number
  ruidoPx?: number
}): unknown

/** g del sitio. 9,81 es un promedio: en los Andes el valor real ronda 9,775. */
export function gLocal(latitudGrados: number, altitudM?: number): number

/** Donde la MEDICION deja de valer. */
export const INCLINACION_CALIDAD_GRADOS: number
/** Donde el GIRO —la referencia torcida como un cuadro mal colgado, dentro del
 *  plano de la imagen— tumba la toma. No es lo mismo que la inclinación, que es
 *  escorzo. Enseñar solo la inclinación en vivo mientras la puerta rechazaba por
 *  giro costó la tanda entera del 22 de agosto de 2026: diez tomas grabadas con
 *  el indicador en verde y descartadas después. */
export const GIRO_CALIDAD_GRADOS: number
/** Donde la GEOMETRIA de las cuatro esquinas pierde precision. No es el mismo. */
export const INCLINACION_MAX_GRADOS: number
